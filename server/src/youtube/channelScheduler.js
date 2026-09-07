const cron = require("node-cron");
const {
    getChannelIdsNeedingUpdate,
    processChannels,
    getNewChannelId,
    channelExists,
    addNewChannel,
    fetchAndStoreVideos,
} = require("./index");
const { getConnection, createNewPromiseConnection } = require("../db");
const { convertToMySQLDatetime, convertImageUrl, convertDurationToSeconds, getCategoryName } = require("../utils");

const DEFAULT_CHANNEL_UPDATE_CRON = "*/15 * * * *";
const DEFAULT_NEW_CHANNEL_CRON = "*/15 * * * *";
const CHANNEL_UPDATE_BATCH_SIZE = 5;
const CHANNEL_STALE_DAYS = 3;
const NEW_CHANNEL_TOTAL_RESULTS = 50;

let isUpdatingChannels = false;
let isAddingChannel = false;
let offset = 0;

let channelUpdateCronJob = null;
let newChannelCronJob = null;

async function getSchedulerSettings() {
    const connection = getConnection();
    return new Promise((resolve, reject) => {
        connection.query(
            `SELECT setting_key, setting_value FROM scheduler_settings WHERE setting_key IN (?, ?)`,
            ["channel_update_cron", "new_channel_cron"],
            (error, results) => {
                if (error) return reject(error);
                const settings = {};
                results.forEach(row => {
                    settings[row.setting_key] = row.setting_value;
                });
                resolve(settings);
            }
        );
    });
}

async function initializeSchedulerSettings() {
    const connection = getConnection();
    const defaults = {
        channel_update_cron: DEFAULT_CHANNEL_UPDATE_CRON,
        new_channel_cron: DEFAULT_NEW_CHANNEL_CRON,
    };
    return new Promise((resolve, reject) => {
        connection.query(
            `INSERT IGNORE INTO scheduler_settings (setting_key, setting_value) VALUES (?, ?), (?, ?)`,
            ["channel_update_cron", defaults.channel_update_cron, "new_channel_cron", defaults.new_channel_cron],
            (error) => {
                if (error) return reject(error);
                resolve(defaults);
            }
        );
    });
}

function guardConnection(connection, label) {
    connection.on("error", (err) => {
        console.log(`MySQL connection error (${label}):`, err.message);
    });
    return connection;
}

async function getSubscribersForChannel(channelId) {
    const connection = getConnection();
    return new Promise((resolve, reject) => {
        connection.query(
            `SELECT s.user_id, c.channel_name, c.channel_icon
             FROM subscriptions s
             JOIN channels c ON c.channel_id = s.channel_id
             WHERE s.channel_id = ?`,
            [channelId],
            (error, results) => {
                if (error) return reject(error);
                resolve(results);
            }
        );
    });
}

async function createNotification(userId, videoId, channelId, type, title, channelName, channelIcon, thumbnailLink, uploadTime) {
    const connection = getConnection();
    const sql = `
        INSERT INTO notifications (user_id, video_id, channel_id, type, title, channel_name, channel_icon, thumbnail_link, upload_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    return new Promise((resolve, reject) => {
        connection.query(sql, [userId, videoId, channelId, type, title, channelName, channelIcon, thumbnailLink, uploadTime], (error, result) => {
            if (error) {
                console.error("Error creating notification:", error.message);
                return reject(error);
            }
            console.log(`Notification created for user ${userId}, video ${videoId}`);
            resolve(result);
        });
    });
}

async function checkAndNotifyNewVideos(channelId, channelName, channelIcon) {
    const subscribers = await getSubscribersForChannel(channelId);
    if (subscribers.length === 0) return;

    const connection = guardConnection(await createNewPromiseConnection(), `checkNewVideos-${channelId}`);
    
    try {
        // Get the latest video upload time we have for this channel
        const latestVideoQuery = `SELECT MAX(upload_time) as last_upload FROM videos WHERE channel_id = ?`;
        const [latestVideoResult] = await connection.execute(latestVideoQuery, [channelId]);
        const lastUpload = latestVideoResult[0]?.last_upload || null;

        // Fetch latest videos from YouTube API
        const { API_KEYS } = require("../config");
        let currentApiKeyIndex = 0;
        function getNextApiKey() {
            const apiKey = API_KEYS[currentApiKeyIndex];
            currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;
            return apiKey;
        }

        const apiKey = getNextApiKey();
        const axios = require("axios");

        const searchResponse = await axios.get(
            "https://www.googleapis.com/youtube/v3/search",
            {
                params: {
                    key: apiKey,
                    channelId: channelId,
                    part: "snippet",
                    order: "date",
                    maxResults: 10,
                },
            }
        );

        const videoIds = searchResponse.data.items
            .map((item) => item.id.videoId)
            .filter((videoId) => videoId);

        if (videoIds.length === 0) return;

        const videoStatsResponse = await axios.get(
            "https://www.googleapis.com/youtube/v3/videos",
            {
                params: {
                    key: apiKey,
                    id: videoIds.join(","),
                    part: "snippet,statistics,contentDetails",
                },
            }
        );

        const videos = videoStatsResponse.data.items.map((item) => {
            const duration = convertDurationToSeconds(item.contentDetails.duration);
            const isShort = duration <= 61;
            return {
                videoId: item.id,
                title: item.snippet.title || "N/A",
                description: item.snippet.description || "N/A",
                thumbnail: item.snippet.thumbnails.high?.url || "N/A",
                uploadTime: convertToMySQLDatetime(item.snippet.publishedAt),
                views: item.statistics.viewCount || 0,
                likes: item.statistics.likeCount || 0,
                dislikes: item.statistics.dislikeCount || 0,
                link: `https://www.youtube.com/watch?v=${item.id}`,
                duration: duration,
                channelId: item.snippet.channelId,
                tags: item.snippet.tags ? item.snippet.tags.join(", ") : "",
                category: getCategoryName(item.snippet.categoryId) || "N/A",
                isShort: isShort,
            };
        });

        // Check for new videos and notify
        for (const video of videos) {
            const existingVideo = await connection.execute(
                `SELECT video_id FROM videos WHERE video_id = ? LIMIT 1`,
                [video.videoId]
            );

            const isNewVideo = existingVideo[0].length === 0;

            if (isNewVideo) {
                // Insert the new video
                await connection.execute(
                    `INSERT INTO videos (video_id, title, views, likes, dislikes, link, upload_time, channel_id, thumbnail_link, video_description, duration, tags, category, isShort)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        video.videoId,
                        video.title,
                        video.views,
                        video.likes,
                        video.dislikes,
                        video.link,
                        video.uploadTime,
                        video.channelId,
                        video.thumbnail,
                        video.description,
                        video.duration,
                        video.tags,
                        video.category,
                        video.isShort,
                    ]
                );

                console.log(`New ${video.isShort ? 'Short' : 'video'} found: ${video.title} from ${channelName}`);

                // Notify all subscribers
                for (const sub of subscribers) {
                    await createNotification(
                        sub.user_id,
                        video.videoId,
                        channelId,
                        video.isShort ? 'new_short' : 'new_video',
                        video.title,
                        channelName,
                        channelIcon,
                        video.thumbnail,
                        video.uploadTime
                    );
                }
            }
        }
    } catch (error) {
        console.error(`Error checking new videos for channel ${channelId}:`, error.message);
    } finally {
        try {
            await connection.end();
        } catch (e) {
            console.error("Error closing connection:", e.message);
        }
    }
}

async function notifyNewChannel(channelId) {
    const connection = guardConnection(await createNewPromiseConnection(), `notifyNewChannel-${channelId}`);
    try {
        // Get channel details
        const [channelRows] = await connection.execute(
            `SELECT channel_id, channel_name, channel_icon FROM channels WHERE channel_id = ?`,
            [channelId]
        );
        if (channelRows.length === 0) return;

        const channel = channelRows[0];
        
        // Get all users to notify about new channel discovery
        const [users] = await connection.execute(
            `SELECT user_id FROM user WHERE user_id != 'Guest'`
        );

        for (const user of users) {
            await createNotification(
                user.user_id,
                null,
                channelId,
                'new_channel',
                `New channel discovered: ${channel.channel_name}`,
                channel.channel_name,
                channel.channel_icon,
                channel.channel_icon,
                new Date().toISOString().slice(0, 19).replace('T', ' ')
            );
        }
        console.log(`Notified ${users.length} users about new channel: ${channelId}`);
    } catch (error) {
        console.error("Error notifying about new channel:", error.message);
    } finally {
        try {
            await connection.end();
        } catch (e) {
            console.error("Error closing connection:", e.message);
        }
    }
}

function startChannelUpdateScheduler(cronExpression = DEFAULT_CHANNEL_UPDATE_CRON) {
    if (channelUpdateCronJob) {
        channelUpdateCronJob.stop();
    }
    channelUpdateCronJob = cron.schedule(cronExpression, async () => {
        if (isUpdatingChannels) {
            console.log("Channel update already in progress, skipping");
            return;
        }
        isUpdatingChannels = true;
        try {
            const channelIds = await getChannelIdsNeedingUpdate(offset, CHANNEL_UPDATE_BATCH_SIZE, CHANNEL_STALE_DAYS);
            if (channelIds.length === 0) {
                offset = 0;
                console.log("No channels need update, offset reset to 0");
            } else {
                // Process channels and check for new videos
                for (const channelId of channelIds) {
                    // Get channel info for notifications
                    const connection = guardConnection(await createNewPromiseConnection(), `getChannelInfo-${channelId}`);
                    try {
                        const [channelRows] = await connection.execute(
                            `SELECT channel_id, channel_name, channel_icon FROM channels WHERE channel_id = ?`,
                            [channelId]
                        );
                        if (channelRows.length > 0) {
                            const channel = channelRows[0];
                            // Check for new videos and notify subscribers
                            await checkAndNotifyNewVideos(channelId, channel.channel_name, channel.channel_icon);
                        }
                    } finally {
                        try {
                            await connection.end();
                        } catch (e) {
                            console.error("Error closing connection:", e.message);
                        }
                    }
                }
                
                // Also run the standard processChannels for batch updates
                await processChannels(channelIds, NEW_CHANNEL_TOTAL_RESULTS);
                offset += CHANNEL_UPDATE_BATCH_SIZE;
                console.log(`Updated ${channelIds.length} channels, offset now ${offset}`);
            }
        } catch (error) {
            console.error("Error in channel update scheduler:", error.message);
        } finally {
            isUpdatingChannels = false;
        }
    });
    console.log(`Channel update scheduler started (cron: ${cronExpression})`);
}

function startNewChannelScheduler(cronExpression = DEFAULT_NEW_CHANNEL_CRON) {
    if (newChannelCronJob) {
        newChannelCronJob.stop();
    }
    newChannelCronJob = cron.schedule(cronExpression, async () => {
        if (isAddingChannel) {
            console.log("Add channel already in progress, skipping");
            return;
        }
        isAddingChannel = true;
        try {
            while (true) {
                const channelId = await getNewChannelId();
                if (!channelId) {
                    console.log("No channel ID returned from YouTube API, retrying...");
                    continue;
                }
                const exists = await channelExists(channelId);
                if (!exists) {
                    const success = await addNewChannel(channelId, NEW_CHANNEL_TOTAL_RESULTS);
                    if (success) {
                        console.log(`Successfully added new channel: ${channelId}`);
                        // Notify all users about new channel discovery
                        await notifyNewChannel(channelId);
                    } else {
                        console.log(`Failed to add channel: ${channelId}`);
                    }
                    break;
                }
                console.log(`Channel ${channelId} already exists, searching for another...`);
            }
        } catch (error) {
            console.error("Error in new channel scheduler:", error.message);
        } finally {
            isAddingChannel = false;
        }
    });
    console.log(`New channel scheduler started (cron: ${cronExpression})`);
}

async function updateSchedulerSetting(settingKey, settingValue) {
    const connection = getConnection();
    return new Promise((resolve, reject) => {
        connection.query(
            `INSERT INTO scheduler_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?`,
            [settingKey, settingValue, settingValue],
            (error) => {
                if (error) return reject(error);
                resolve();
            }
        );
    });
}

async function initializeAndStartSchedulers() {
    await initializeSchedulerSettings();
    const settings = await getSchedulerSettings();
    startChannelUpdateScheduler(settings.channel_update_cron || DEFAULT_CHANNEL_UPDATE_CRON);
    startNewChannelScheduler(settings.new_channel_cron || DEFAULT_NEW_CHANNEL_CRON);
}

module.exports = {
    startChannelUpdateScheduler,
    startNewChannelScheduler,
    initializeAndStartSchedulers,
    updateSchedulerSetting,
    getSchedulerSettings,
};