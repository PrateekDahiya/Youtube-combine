const { createNewConnection, createNewPromiseConnection, getConnection } = require("../db");
const { API_KEYS } = require("../config");
const {
    convertToMySQLDatetime,
    convertImageUrl,
    convertDurationToSeconds,
    getCategoryName,
    extractFrequentWords,
    buildTastePrefilterQuery,
    createFeedAndGenerateSQL,
} = require("../utils");
const { checkFullTextAvailability, isFullTextAvailable } = require("../utils/fulltext");
const { apiGet } = require("./syncQueue");

let currentApiKeyIndex = 0;

// mysql2's raw (non-pooled) Connection emits connection-level failures (auth
// errors, "too many connections", dropped sockets) as an 'error' event that
// is separate from any query callback. With no listener, Node treats that as
// an uncaught exception and crashes the whole process — this attaches a
// no-op logger so those failures are handled like any other connection error
// instead of taking the server down.
function guardConnection(connection, label) {
    connection.on("error", (err) => {
        console.log(`MySQL connection error (${label}):`, err.message);
    });
    return connection;
}

// Batched upsert of typeahead terms for freshly synced videos: full titles
// (popularity refreshed to latest views) plus individual tags (popularity
// accumulated across videos). Inserted in chunks to bound statement size.
async function upsertSuggestionTerms(connection, freshVideos) {
    const seen = new Set();
    const titleRows = [];
    const tagRows = [];
    for (const video of freshVideos) {
        const views = Number(video.views) || 0;
        const title = String(video.title || "").trim().substring(0, 128);
        if (title && title !== "N/A") {
            const key = `video|${title}|${video.videoId}`;
            if (!seen.has(key)) {
                seen.add(key);
                titleRows.push([title, "video", video.videoId, views]);
            }
        }
        const tags = String(video.tags || "")
            .split(",")
            .map((tag) => tag.trim().toLowerCase().substring(0, 128))
            .filter((tag) => tag);
        for (const tag of tags.slice(0, 10)) {
            const key = `tag|${tag}|`;
            if (!seen.has(key)) {
                seen.add(key);
                tagRows.push([tag, "tag", "", views]);
            }
        }
    }

    const CHUNK = 500;
    for (let i = 0; i < titleRows.length; i += CHUNK) {
        const chunk = titleRows.slice(i, i + CHUNK);
        const placeholders = chunk.map(() => "(?, ?, ?, ?)").join(", ");
        await connection.execute(
            `INSERT INTO search_suggestions (term, kind, ref_id, popularity)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE popularity = VALUES(popularity)`,
            chunk.flat()
        );
    }
    for (let i = 0; i < tagRows.length; i += CHUNK) {
        const chunk = tagRows.slice(i, i + CHUNK);
        const placeholders = chunk.map(() => "(?, ?, ?, ?)").join(", ");
        await connection.execute(
            `INSERT INTO search_suggestions (term, kind, ref_id, popularity)
             VALUES ${placeholders}
             ON DUPLICATE KEY UPDATE popularity = popularity + VALUES(popularity)`,
            chunk.flat()
        );
    }
}

const fetchAndStoreVideos = async (
    channelId,
    totalResults,
    startingPageToken = null
) => {
    let connection;
    const syncedVideos = [];
    try {
        connection = guardConnection(await createNewPromiseConnection(), "fetchAndStoreVideos");
        let nextPageToken = startingPageToken;

        const channelResponse = await apiGet(
            "https://www.googleapis.com/youtube/v3/channels",
            {
                id: channelId,
                part: "snippet,statistics,brandingSettings",
            },
            "pool"
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

        // Known video ids for this channel, so the paging loop below can skip
        // already-synced videos and keep walking into older history until it
        // has collected `totalResults` NEW videos (backfill), instead of
        // stopping after the newest page.
        const [knownRows] = await connection.execute(
            `SELECT video_id FROM videos WHERE channel_id = ?`,
            [channelId]
        );
        const knownIds = new Set(knownRows.map((row) => row.video_id));
        let newCount = 0;
        let pagesFetched = 0;
        const BACKFILL_MAX_PAGES = 10;
        // Scale the per-run target with channel size (10% of the channel's
        // total videos, minimum 50) so large channels backfill faster while
        // small channels keep the cheap single-page behavior.
        const dynamicTotal = Math.max(
            totalResults,
            Math.min(Math.ceil((channelDetails.videoCount || 0) * 0.1), BACKFILL_MAX_PAGES * 50)
        );

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

        // Keep the typeahead index warm. Best-effort: a missing table (old
        // DB without migration 012) must never break the video sync.
        try {
            const subs = Number(channelDetails.subscribers) || 0;
            await connection.execute(
                `INSERT INTO search_suggestions (term, kind, ref_id, popularity)
                 VALUES (?, 'channel', ?, ?)
                 ON DUPLICATE KEY UPDATE popularity = VALUES(popularity)`,
                [
                    String(channelDetails.name || "").substring(0, 128),
                    channelDetails.id,
                    subs,
                ]
            );
            const keywordTerms = new Set();
            for (const piece of String(channelDetails.keywords || "").split(",")) {
                const cleaned = piece.replace(/["'#]/g, " ").trim().toLowerCase();
                if (cleaned.length >= 3) {
                    keywordTerms.add(cleaned.substring(0, 128));
                }
                for (const word of cleaned.split(/[\s,]+/)) {
                    if (word.length >= 3) {
                        keywordTerms.add(word.substring(0, 128));
                    }
                }
            }
            keywordTerms.delete("n/a");
            const keywordRows = Array.from(keywordTerms)
                .slice(0, 30)
                .map((kw) => [kw, "channel", channelDetails.id, subs]);
            if (keywordRows.length > 0) {
                const placeholders = keywordRows.map(() => "(?, ?, ?, ?)").join(", ");
                await connection.execute(
                    `INSERT INTO search_suggestions (term, kind, ref_id, popularity)
                     VALUES ${placeholders}
                     ON DUPLICATE KEY UPDATE popularity = VALUES(popularity)`,
                    keywordRows.flat()
                );
            }
        } catch (suggestError) {
            console.log("Error caching channel suggestion for " + channelId + ": " + suggestError.message);
        }

        const uploadsPlaylistId =
            channelId.startsWith("UC") ? "UU" + channelId.slice(2) : null;
        if (!uploadsPlaylistId) {
            console.log(`Cannot derive uploads playlist for channel: ${channelId}`);
            return;
        }

        while (newCount < dynamicTotal && pagesFetched < BACKFILL_MAX_PAGES) {
            const maxResults = 50;

            try {
                const playlistResponse = await apiGet(
                    "https://www.googleapis.com/youtube/v3/playlistItems",
                    {
                        playlistId: uploadsPlaylistId,
                        part: "snippet,contentDetails",
                        maxResults: maxResults,
                        pageToken: nextPageToken,
                    },
                    "pool"
                );

                const videoIds = (playlistResponse.data.items || [])
                    .map((item) => item.snippet && item.snippet.resourceId && item.snippet.resourceId.videoId)
                    .filter((videoId) => videoId);

                if (videoIds.length === 0) {
                    break;
                }

                const pageKnown = videoIds.filter((videoId) => knownIds.has(videoId));
                const pageFresh = videoIds.filter((videoId) => !knownIds.has(videoId));

                if (pageKnown.length === videoIds.length) {
                    break;
                }

                let videos = [];
                for (let i = 0; i < videoIds.length; i += 50) {
                    const batch = videoIds.slice(i, i + 50);
                    const videoStatsResponse = await apiGet(
                        "https://www.googleapis.com/youtube/v3/videos",
                        {
                            id: batch.join(","),
                            part: "snippet,statistics,contentDetails",
                        },
                        "pool"
                    );
                    videos.push(...(videoStatsResponse.data.items || []));
                }

                const freshIds = new Set(pageFresh);
                const pageVideos = videos.map((item) => {
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

                const freshVideos = pageVideos.filter((video) => freshIds.has(video.videoId));
                pageVideos.forEach((video) => knownIds.add(video.videoId));

                const videoPromises = pageVideos.map((video) => {
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

                // Feed the typeahead index with titles + tags. Best-effort:
                // failures here must not fail the video sync.
                try {
                    await upsertSuggestionTerms(connection, freshVideos);
                } catch (suggestError) {
                    console.log("Error caching video suggestions: " + suggestError.message);
                }

                // Only videos that were actually just inserted have a row to
                // FK against; videoIds can include ones videos.list dropped
                // (private/deleted/restricted). Comment caching happens
                // after this connection is released (see below) — it uses
                // the pool, not this raw connection, and can be slow.
                syncedVideos.push(...freshVideos);

                newCount += freshVideos.length;
                pagesFetched += 1;
                nextPageToken = playlistResponse.data.nextPageToken;

                if (!nextPageToken) {
                    break;
                }
            } catch (searchError) {
                if (searchError && searchError.isQuotaExhausted) {
                    throw searchError;
                }
                if (searchError.response) {
                    console.log(
                        "Error during playlist API request:",
                        searchError.response.data
                    );
                } else {
                    console.log(
                        "Error during playlist API request:",
                        searchError.message
                    );
                }
                console.log("Request params:", {
                    channelId: channelId,
                    part: "snippet,contentDetails",
                    maxResults: maxResults,
                    pageToken: nextPageToken,
                });
                break;
            }
        }
    } catch (error) {
        if (error && error.isQuotaExhausted) {
            throw error;
        }
        if (error.response) {
            console.log(
                "Error fetching and storing videos:",
                error.response.data
            );
        } else {
            console.log("Error fetching and storing videos:", error.message);
        }
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (endError) {
                console.log("Error closing connection:", endError.message);
            }
        }
    }

    // Best-effort, sequential (not Promise.all) to keep concurrent writes to
    // `comments` low and avoid InnoDB deadlocks under parallel channel
    // processing. Runs after the raw connection above is released — this
    // uses the pool instead, and can take a while across many videos.
    // Capped per run to bound quota spend; quota death stops warming but
    // never fails the video sync itself.
    const MAX_COMMENT_WARM_PER_RUN = 20;
    for (const video of syncedVideos.slice(0, MAX_COMMENT_WARM_PER_RUN)) {
        try {
            await fetchAndCacheYoutubeComments(video.videoId);
        } catch (commentError) {
            if (commentError && commentError.isQuotaExhausted) {
                break;
            }
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
};

const getNewChannelId = async () => {
    try {
        const apiKey = API_KEYS[currentApiKeyIndex];
        currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;
        const category = getRandomCategory();
        // maxResults=50 (not 1) + a random pick from the page: the #1 slot
        // for a category barely changes day to day, so always taking it
        // meant repeated calls kept re-rolling the same handful of already-
        // known channels. Sampling across the whole chart page gives many
        // more distinct candidates to try.
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=US&videoCategoryId=${category}&maxResults=50&key=${apiKey}`
        );
        const data = await response.json();

        if (data.items && data.items.length > 0) {
            const randomIndex = Math.floor(Math.random() * data.items.length);
            return data.items[randomIndex].snippet.channelId;
        }
        console.error("No popular videos found:", data.error ? data.error.message : data);
        return null;
    } catch (error) {
        console.error("Error fetching a new channel id:", error.message);
        return null;
    }
};

// Keeps drawing candidate channel ids until one isn't already in `channels`,
// instead of returning on the first (likely already-known) pick.
async function findNewChannelId() {
    while (true) {
        const channelId = await getNewChannelId();
        if (!channelId) continue;
        try {
            const exists = await channelExists(channelId);
            if (!exists) return channelId;
        } catch (error) {
            console.log("Error checking channel existence:", error.message);
        }
    }
}

async function channelExists(channelId) {
    const connection = getConnection();
    return new Promise((resolve, reject) => {
        connection.query(
            `SELECT 1 FROM channels WHERE channel_id = ? LIMIT 1`,
            [channelId],
            (error, rows) => {
                if (error) return reject(error);
                resolve(rows.length > 0);
            }
        );
    });
}

const addNewChannel = async (channelId, totalResults = 50) => {
    const startingPageToken = null;
    if (!channelId || channelId.length <= 20) {
        return false;
    }

    try {
        await fetchAndStoreVideos(channelId, totalResults, startingPageToken);
        try {
            const { enqueueChannel } = require("./syncQueue");
            await enqueueChannel(channelId);
        } catch (queueError) {
            console.log("Error enqueueing new channel " + channelId + ": " + queueError.message);
        }
        return true;
    } catch (error) {
        if (error && error.isQuotaExhausted) {
            throw error;
        }
        console.log("Error adding new channel " + channelId + ": " + error.message);
        return false;
    }
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

            const runScoredQuery = (candidateIds) => {
                const sqlQuery = createFeedAndGenerateSQL(tags, [], 5, 24, null, candidateIds);

                connection.query(sqlQuery, (feedError, relatedVideos) => {
                    if (feedError) {
                        console.log("Error fetching related videos:", feedError.message);
                        console.log("Generated SQL Query:", sqlQuery);
                        return reject(new Error("Database error"));
                    }

                    resolve({ page: "related_videos", videos: relatedVideos });
                });
            };

            checkFullTextAvailability(() => {
                if (!isFullTextAvailable()) {
                    return runScoredQuery(null);
                }
                const ftQuery = buildTastePrefilterQuery(extractFrequentWords(tags));
                if (!ftQuery) {
                    return runScoredQuery(null);
                }
                connection.query(
                    `SELECT video_id,
                            MATCH(title, tags, video_description) AGAINST (? IN BOOLEAN MODE) AS rel
                     FROM videos
                     WHERE MATCH(title, tags, video_description) AGAINST (? IN BOOLEAN MODE)
                     ORDER BY rel DESC, views DESC
                     LIMIT 1000`,
                    [ftQuery, ftQuery],
                    (candidateError, candidateRows) => {
                        if (candidateError) {
                            console.log("Error fetching related candidates:", candidateError.message);
                            return runScoredQuery(null);
                        }
                        const candidateIds = (candidateRows || []).map((row) => row.video_id);
                        runScoredQuery(candidateIds.length > 0 ? candidateIds : null);
                    }
                );
            });
        });
    });
};

const fetchYoutubeComments = async (videoId, pageToken = null) => {
    try {
        const response = await apiGet(
            "https://www.googleapis.com/youtube/v3/commentThreads",
            {
                videoId,
                part: "snippet",
                maxResults: 10,
                order: "relevance",
                textFormat: "plainText",
                pageToken: pageToken || undefined,
            },
            "pool"
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
        // video_id no longer exists in `videos` (deleted/replaced between
        // being synced and comments being fetched) — same "nothing to
        // attach to" case as comments being disabled, not worth erroring.
        const isMissingVideo = error.code === "ER_NO_REFERENCED_ROW_2" || error.errno === 1452;
        if (isMissingVideo) {
            return;
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
    getNewChannelId,
    findNewChannelId,
    addNewChannel,
    channelExists,
    getRandomCategory,
    fetchVideoHistory,
    fetchRelatedVideos,
    fetchYoutubeComments,
    fetchAndCacheYoutubeComments,
    getCurrentApiKeyIndex: () => currentApiKeyIndex,
    setCurrentApiKeyIndex: (val) => { currentApiKeyIndex = val; },
};