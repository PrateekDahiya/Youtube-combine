const axios = require("axios");
const { createNewConnection } = require("../db");
const { API_KEYS } = require("../config");
const {
    convertToMySQLDatetime,
    convertImageUrl,
    convertDurationToSeconds,
    getCategoryName,
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

module.exports = {
    fetchAndStoreVideos,
    getChannelIds,
    processChannels,
    getNewChannelId,
    addNewChannel,
    getRandomCategory,
    getCurrentApiKeyIndex: () => currentApiKeyIndex,
    setCurrentApiKeyIndex: (val) => { currentApiKeyIndex = val; },
};