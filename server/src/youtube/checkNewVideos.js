const cron = require("node-cron");
const axios = require("axios");
const { getConnection, createNewConnection, createNewPromiseConnection } = require("../db");
const { API_KEYS } = require("../config");
const { convertToMySQLDatetime, convertImageUrl, convertDurationToSeconds, getCategoryName } = require("../utils");

let currentApiKeyIndex = 0;

function guardConnection(connection, label) {
    connection.on("error", (err) => {
        console.log(`MySQL connection error (${label}):`, err.message);
    });
    return connection;
}

function getNextApiKey() {
    const apiKey = API_KEYS[currentApiKeyIndex];
    currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;
    return apiKey;
}

async function checkSubscribedChannelsForNewVideos() {
    console.log("Starting scheduled check for new videos from subscribed channels...");
    
    const connection = getConnection();
    
    try {
        // Get all users who have subscriptions
        const usersWithSubsQuery = `
            SELECT DISTINCT s.user_id
            FROM subscriptions s
        `;
        
        const usersWithSubs = await new Promise((resolve, reject) => {
            connection.query(usersWithSubsQuery, (error, results) => {
                if (error) return reject(error);
                resolve(results.map(r => r.user_id));
            });
        });
        
        if (usersWithSubs.length === 0) {
            console.log("No users with subscriptions found");
            return;
        }
        
        console.log(`Found ${usersWithSubs.length} users with subscriptions`);
        
        for (const userId of usersWithSubs) {
            try {
                await checkUserSubscriptions(userId);
            } catch (error) {
                console.error(`Error checking subscriptions for user ${userId}:`, error.message);
            }
        }
        
        console.log("Finished scheduled check for new videos");
    } catch (error) {
        console.error("Error in scheduled check:", error.message);
    }
}

async function checkUserSubscriptions(userId) {
    const connection = getConnection();
    
    // Get all channels this user is subscribed to
    const subsQuery = `
        SELECT s.channel_id, c.channel_name, c.channel_icon
        FROM subscriptions s
        JOIN channels c ON c.channel_id = s.channel_id
        WHERE s.user_id = ?
    `;
    
    const subscriptions = await new Promise((resolve, reject) => {
        connection.query(subsQuery, [userId], (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
    
    if (subscriptions.length === 0) return;
    
    console.log(`User ${userId} has ${subscriptions.length} subscriptions`);
    
    for (const sub of subscriptions) {
        try {
            await checkChannelForNewVideos(userId, sub.channel_id, sub.channel_name, sub.channel_icon);
        } catch (error) {
            console.error(`Error checking channel ${sub.channel_id}:`, error.message);
        }
    }
}

async function checkChannelForNewVideos(userId, channelId, channelName, channelIcon) {
    const apiKey = getNextApiKey();
    const connection = getConnection();
    
    // Get the latest video upload time we have for this channel
    const latestVideoQuery = `
        SELECT MAX(upload_time) as last_upload
        FROM videos
        WHERE channel_id = ?
    `;
    
    const latestVideo = await new Promise((resolve, reject) => {
        connection.query(latestVideoQuery, [channelId], (error, results) => {
            if (error) return reject(error);
            resolve(results[0]?.last_upload || null);
        });
    });
    
    // Fetch latest videos from YouTube API
    try {
        const searchResponse = await axios.get(
            "https://www.googleapis.com/youtube/v3/search",
            {
                params: {
                    key: apiKey,
                    channelId: channelId,
                    part: "snippet",
                    order: "date",
                    maxResults: 5,
                },
            }
        );
        
        const videoIds = searchResponse.data.items
            .map((item) => item.id.videoId)
            .filter((videoId) => videoId);
        
        if (videoIds.length === 0) {
            return;
        }
        
        // Get video details
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
        
        // Store new videos and create notifications
        const videoConn = guardConnection(await createNewPromiseConnection(), "checkChannelForNewVideos");
        
        for (const video of videos) {
            // Check if video already exists
            const existingVideo = await videoConn.execute(
                `SELECT video_id FROM videos WHERE video_id = ? LIMIT 1`,
                [video.videoId]
            );
            
            const isNewVideo = existingVideo[0].length === 0;
            
            if (isNewVideo) {
                // Insert the new video
                await videoConn.execute(
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
                
                // Create notification
                await createNotification(
                    userId,
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
        
        await videoConn.end();
        
    } catch (error) {
        if (error.response) {
            console.log(`YouTube API error for channel ${channelId}:`, error.response.data);
        } else {
            console.log(`Error checking channel ${channelId}:`, error.message);
        }
    }
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

function startNotificationCron() {
    // Run every 15 minutes
    cron.schedule("*/15 * * * *", () => {
        checkSubscribedChannelsForNewVideos().catch(err => {
            console.error("Cron job error:", err);
        });
    });
    
    console.log("Notification cron job started (runs every 15 minutes)");
}

module.exports = {
    checkSubscribedChannelsForNewVideos,
    checkUserSubscriptions,
    checkChannelForNewVideos,
    createNotification,
    startNotificationCron,
};