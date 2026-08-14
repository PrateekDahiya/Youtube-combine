const axios = require("axios");
const { createNewConnection, getConnection } = require("../db");
const { API_KEYS } = require("../config");
const {
    convertToMySQLDatetime,
    convertImageUrl,
    convertDurationToSeconds,
    getCategoryName,
    createFeedAndGenerateSQL,
} = require("../utils");

let currentApiKeyIndex = 0;

const fetchAndStoreVideos = async (
    channelId,
    totalResults,
    startingPageToken = null
) => {
    try {
        const connection = await createNewConnection();
        let nextPageToken = startingPageToken;
        let fetchedResults = 0;

        const apiKey = API_KEYS[currentApiKeyIndex];
        currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;

        const channelResponse = await axios.get(
            "https://www.googleapis.com/youtube/v3/channels",
            {
                params: {
                    key: apiKey,
                    id: channelId,
                    part: "snippet,statistics,brandingSettings",
                },
            }
        );

        if (
            !channelResponse.data.items ||
            channelResponse.data.items.length === 0
        ) {
            console.log(`Channel not found: ${channelId}`);
            return;
        }

        const channel = channelResponse.data.items[0];
        const snippet = channel.snippet;
        const statistics = channel.statistics;
        const brandingSettings = channel.brandingSettings;

        const channelDetails = {
            id: channel.id,
            name: snippet.title,
            description: snippet.description || "N/A",
            dateCreated: convertToMySQLDatetime(snippet.publishedAt),
            location: snippet.country || "N/A",
            subscribers: statistics.subscriberCount || 0,
            icon: convertImageUrl(snippet.thumbnails.high.url),
            banner: brandingSettings.image
                ? brandingSettings.image.bannerExternalUrl +
                  "=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj"
                : "N/A",
            videoCount: statistics.videoCount || 0,
            totalViews: statistics.viewCount || 0,
            customUrl: snippet.customUrl || "N/A",
            keywords:
                (brandingSettings &&
                    brandingSettings.channel &&
                    brandingSettings.channel.keywords) ||
                "N/A",
        };

        await connection.execute(
            `INSERT INTO channels (channel_id, channel_name, subscribers, date_created, short_desc, location, channel_icon, channel_banner, video_count, total_views, custom_url,keywords)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
             ON DUPLICATE KEY UPDATE channel_name = VALUES(channel_name), subscribers = VALUES(subscribers), date_created = VALUES(date_created), short_desc = VALUES(short_desc), location = VALUES(location), channel_icon = VALUES(channel_icon), channel_banner = VALUES(channel_banner), video_count = VALUES(video_count), total_views = VALUES(total_views), custom_url = VALUES(custom_url), keywords = VALUES(keywords)`,
            [
                channelDetails.id,
                channelDetails.name,
                channelDetails.subscribers,
                channelDetails.dateCreated,
                channelDetails.description,
                channelDetails.location,
                channelDetails.icon,
                channelDetails.banner,
                channelDetails.videoCount,
                channelDetails.totalViews,
                channelDetails.customUrl,
                channelDetails.keywords,
            ]
        );

        while (fetchedResults < totalResults) {
            const remainingResults = totalResults - fetchedResults;
            const maxResults = remainingResults > 50 ? 50 : remainingResults;

            try {
                const searchResponse = await axios.get(
                    "https://www.googleapis.com/youtube/v3/search",
                    {
                        params: {
                            key: apiKey,
                            channelId: channelId,
                            part: "snippet",
                            order: "date",
                            maxResults: maxResults,
                            pageToken: nextPageToken,
                        },
                    }
                );

                const videoIds = searchResponse.data.items
                    .map((item) => item.id.videoId)
                    .filter((videoId) => videoId);

                if (videoIds.length === 0) {
                    break;
                }

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
                    const duration = convertDurationToSeconds(
                        item.contentDetails.duration
                    );
                    const isShort = duration <= 61;
                    return {
                        videoId: item.id,
                        title: item.snippet.title || "N/A",
                        description: item.snippet.description || "N/A",
                        thumbnail: item.snippet.thumbnails.high.url || "N/A",
                        uploadTime: convertToMySQLDatetime(
                            item.snippet.publishedAt
                        ),
                        views: item.statistics.viewCount || 0,
                        likes: item.statistics.likeCount || 0,
                        dislikes: item.statistics.dislikeCount || 0,
                        link: `https://www.youtube.com/watch?v=${item.id}`,
                        duration: convertDurationToSeconds(
                            item.contentDetails.duration
                        ),
                        channelId: item.snippet.channelId,
                        tags: item.snippet.tags
                            ? item.snippet.tags.join(", ")
                            : "",
                        category:
                            getCategoryName(item.snippet.categoryId) || "N/A",
                        isShort: isShort,
                    };
                });

                const videoPromises = videos.map((video) => {
                    return connection.execute(
                        `INSERT INTO videos (video_id, title, views, likes, dislikes, link, upload_time, channel_id, thumbnail_link, video_description, duration, tags, category, isShort)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE title = VALUES(title), views = VALUES(views), likes = VALUES(likes), dislikes = VALUES(dislikes), link = VALUES(link), upload_time = VALUES(upload_time), thumbnail_link = VALUES(thumbnail_link), video_description = VALUES(video_description), duration = VALUES(duration), tags = VALUES(tags), category = VALUES(category), isShort =VALUES(isShort)`,
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
                });

                await Promise.all(videoPromises);

                // Only videos that were actually just inserted have a row to
                // FK against; videoIds can include ones videos.list dropped
                // (private/deleted/restricted). Sequential, not Promise.all,
                // to keep concurrent writes to `comments` low and avoid
                // InnoDB deadlocks under parallel channel processing.
                for (const video of videos) {
                    try {
                        await fetchAndCacheYoutubeComments(video.videoId);
                    } catch (commentError) {
                        console.log(
                            "Error caching comments for video " +
                                video.videoId +
                                ": " +
                                (commentError.response
                                    ? JSON.stringify(commentError.response.data)
                                    : commentError.message)
                        );
                    }
                }

                fetchedResults += videos.length;
                nextPageToken = searchResponse.data.nextPageToken;

                if (!nextPageToken) {
                    break;
                }
            } catch (searchError) {
                if (searchError.response) {
                    console.log(
                        "Error during search API request:",
                        searchError.response.data
                    );
                } else {
                    console.log(
                        "Error during search API request:",
                        searchError.message
                    );
                }
                console.log("Request params:", {
                    key: apiKey,
                    channelId: channelId,
                    part: "snippet",
                    order: "date",
                    maxResults: maxResults,
                    pageToken: nextPageToken,
                });
                break;
            }
        }

        await connection.end();
    } catch (error) {
        if (error.response) {
            console.log(
                "Error fetching and storing videos:",
                error.response.data
            );
        } else {
            console.log("Error fetching and storing videos:", error.message);
        }
    }
};

async function getChannelIds(offset, limit) {
    const connection = await createNewConnection();
    return new Promise((resolve, reject) => {
        const query = `SELECT channel_id FROM channels LIMIT ? OFFSET ?`;
        connection.query(query, [limit, offset], (error, results) => {
            connection.end();
            if (error) {
                return reject(error);
            }
            const channelIds = results.map((row) => row.channel_id);
            resolve(channelIds);
        });
    });
}

async function processChannels(channelIds, totalResults = 5) {
    const startingPageToken = null;

    const fetchPromises = channelIds.map((channelId) => {
        return fetchAndStoreVideos(channelId, totalResults, startingPageToken);
    });
    await Promise.all(fetchPromises);
}

const getNewChannelId = async () => {
    const apiKey = API_KEYS[currentApiKeyIndex];
    const category = getRandomCategory();
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=US&videoCategoryId=${category}&maxResults=1&key=${apiKey}`
    );
    const data = await response.json();

    if (data.items && data.items.length > 0) {
        return data.items[0].snippet.channelId;
    } else {
        console.error("No popular videos found.");
        return null;
    }
};

const addNewChannel = async (channelId) => {
    const totalResults = 50;
    const startingPageToken = null;
    if (channelId && channelId.length > 20) {
        fetchAndStoreVideos(channelId, totalResults, startingPageToken).catch(
            (error) => {
                return "False";
            }
        );
    }
    return "True";
};

const youtubeCategories = [
    "1",
    "2",
    "10",
    "15",
    "17",
    "20",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "29",
];

function getRandomCategory() {
    const randomIndex = Math.floor(Math.random() * youtubeCategories.length);
    return youtubeCategories[randomIndex];
}

const fetchVideoHistory = async (user_id) => {
    const connection = getConnection();
    return new Promise((resolve, reject) => {
        const query = `SELECT v.*, c.*, h.watched_time FROM history h JOIN videos v ON h.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE h.user_id = ? ORDER BY h.watched_time DESC LIMIT 100`;
        connection.query(query, [user_id], (error, results) => {
            if (error) {
                return reject(error);
            }
            resolve(results);
        });
    });
};

const fetchRelatedVideos = async (video_id) => {
    const connection = getConnection();
    return new Promise((resolve, reject) => {
        const fetchTagsQuery = `SELECT tags FROM videos WHERE video_id = ?`;
        connection.query(fetchTagsQuery, [video_id], (error, results) => {
            if (error) {
                return reject(new Error("Database error"));
            }

            if (results.length === 0) {
                const notFound = new Error("Video not found");
                notFound.statusCode = 404;
                return reject(notFound);
            }

            const tags = results[0].tags
                ? results[0].tags
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter((tag) => tag)
                : [];

            if (tags.length === 0) {
                const noTags = new Error("No tags available for this video");
                noTags.statusCode = 400;
                return reject(noTags);
            }

            const sqlQuery = createFeedAndGenerateSQL(tags);

            connection.query(sqlQuery, (feedError, relatedVideos) => {
                if (feedError) {
                    console.log("Error fetching related videos:", feedError.message);
                    console.log("Generated SQL Query:", sqlQuery);
                    return reject(new Error("Database error"));
                }

                resolve({ page: "related_videos", videos: relatedVideos });
            });
        });
    });
};

const fetchYoutubeComments = async (videoId, pageToken = null) => {
    const apiKey = API_KEYS[currentApiKeyIndex];
    currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;

    try {
        const response = await axios.get(
            "https://www.googleapis.com/youtube/v3/commentThreads",
            {
                params: {
                    key: apiKey,
                    videoId,
                    part: "snippet",
                    maxResults: 10,
                    order: "relevance",
                    textFormat: "plainText",
                    pageToken: pageToken || undefined,
                },
            }
        );

        const comments = (response.data.items || []).map((item) => {
            const top = item.snippet.topLevelComment.snippet;
            return {
                id: item.id,
                author: top.authorDisplayName,
                authorAvatar: top.authorProfileImageUrl,
                text: top.textDisplay,
                likeCount: top.likeCount || 0,
                publishedAt: top.publishedAt,
            };
        });

        return {
            comments,
            nextPageToken: response.data.nextPageToken || null,
            disabled: false,
        };
    } catch (error) {
        const status = error.response && error.response.status;
        if (status === 403 || status === 404) {
            // Comments disabled on the video, or the video doesn't exist on YouTube.
            return { comments: [], nextPageToken: null, disabled: true };
        }
        throw error;
    }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const upsertYoutubeComments = async (videoId, comments, attempt = 0) => {
    if (!comments || comments.length === 0) return;

    const connection = getConnection();
    const query = `INSERT INTO comments (video_id, source, external_id, author_name, author_avatar, like_count, comment_text, comment_time)
                   VALUES ?
                   ON DUPLICATE KEY UPDATE like_count = VALUES(like_count), comment_text = VALUES(comment_text), author_name = VALUES(author_name), author_avatar = VALUES(author_avatar)`;
    const values = comments.map((c) => [
        videoId,
        "youtube",
        c.id,
        c.author,
        c.authorAvatar || "",
        c.likeCount || 0,
        c.text,
        c.publishedAt ? convertToMySQLDatetime(c.publishedAt) : null,
    ]);

    try {
        await new Promise((resolve, reject) => {
            connection.query(query, [values], (error) => {
                if (error) return reject(error);
                resolve();
            });
        });
    } catch (error) {
        const isDeadlock = error.code === "ER_LOCK_DEADLOCK" || error.errno === 1213;
        if (isDeadlock && attempt < 2) {
            await sleep(150 * (attempt + 1));
            return upsertYoutubeComments(videoId, comments, attempt + 1);
        }
        throw error;
    }
};

const fetchAndCacheYoutubeComments = async (videoId, pageToken = null) => {
    const result = await fetchYoutubeComments(videoId, pageToken);
    try {
        await upsertYoutubeComments(videoId, result.comments);
    } catch (error) {
        console.log(
            "Error caching YouTube comments for " + videoId + ": " + error.message
        );
    }
    return result;
};

module.exports = {
    fetchAndStoreVideos,
    getChannelIds,
    processChannels,
    getNewChannelId,
    addNewChannel,
    getRandomCategory,
    fetchVideoHistory,
    fetchRelatedVideos,
    fetchYoutubeComments,
    fetchAndCacheYoutubeComments,
    getCurrentApiKeyIndex: () => currentApiKeyIndex,
    setCurrentApiKeyIndex: (val) => { currentApiKeyIndex = val; },
};