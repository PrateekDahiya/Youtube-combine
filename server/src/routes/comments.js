const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler, asyncHandler } = require("../utils/asyncHandler");
const { fetchAndCacheYoutubeComments, fetchYoutubeComments } = require("../youtube");
const {
    successResponse,
    errorResponse,
    validationErrorResponse,
    notFoundResponse,
    forbiddenResponse,
    sendResponse,
} = require("../utils/responseWrapper");

router.get("/comments", syncHandler((req, res) => {
    const video_id = req.query.video_id;
    if (!video_id) {
        return sendResponse(res, validationErrorResponse("video_id is required"));
    }

    const query = `SELECT c.comment_id, c.video_id, c.user_id, c.comment_text, c.comment_time, c.updated_at,
                          ch.channel_name, ch.channel_icon
                   FROM comments c
                   JOIN channels ch ON c.user_id = ch.channel_id
                   WHERE c.video_id = ? AND c.source = 'native'
                   ORDER BY c.comment_time DESC
                   LIMIT 200`;

    const connection = getConnection();
    connection.query(query, [video_id], (error, results) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }
        sendResponse(res, successResponse({ comments: results }, "Comments retrieved successfully"));
    });
}));

router.post("/addComment", syncHandler((req, res) => {
    const video_id = req.body.video_id;
    const user_id = req.body.user_id;
    const comment_text = (req.body.comment_text || "").trim();

    if (!video_id || !user_id || !comment_text) {
        return sendResponse(res, validationErrorResponse("video_id, user_id and comment_text are required"));
    }

    const query = `INSERT INTO comments (video_id, user_id, comment_text) VALUES (?, ?, ?)`;

    const connection = getConnection();
    connection.query(query, [video_id, user_id, comment_text], (error, result) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }

        connection.query(
            `SELECT c.comment_id, c.video_id, c.user_id, c.comment_text, c.comment_time, c.updated_at,
                    ch.channel_name, ch.channel_icon
             FROM comments c
             JOIN channels ch ON c.user_id = ch.channel_id
             WHERE c.comment_id = ?`,
            [result.insertId],
            (fetchError, rows) => {
                if (fetchError) {
                    console.error(fetchError);
                    return sendResponse(res, errorResponse("Database query failed"));
                }
                sendResponse(res, successResponse({ comment: rows[0] || null }, "Comment added successfully"));
            }
        );
    });
}));

router.post("/editComment", syncHandler((req, res) => {
    const comment_id = req.body.comment_id;
    const user_id = req.body.user_id;
    const comment_text = (req.body.comment_text || "").trim();

    if (!comment_id || !user_id || !comment_text) {
        return sendResponse(res, validationErrorResponse("comment_id, user_id and comment_text are required"));
    }

    const query = `UPDATE comments SET comment_text = ? WHERE comment_id = ? AND user_id = ? AND source = 'native'`;

    const connection = getConnection();
    connection.query(query, [comment_text, comment_id, user_id], (error, results) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }
        if (results.affectedRows === 0) {
            return sendResponse(res, forbiddenResponse("Comment not found or not authorized"));
        }
        sendResponse(res, successResponse(null, "Comment updated successfully"));
    });
}));

router.post("/deleteComment", syncHandler((req, res) => {
    const comment_id = req.body.comment_id;
    const user_id = req.body.user_id;

    if (!comment_id || !user_id) {
        return sendResponse(res, validationErrorResponse("comment_id and user_id are required"));
    }

    const query = `DELETE FROM comments WHERE comment_id = ? AND user_id = ? AND source = 'native'`;

    const connection = getConnection();
    connection.query(query, [comment_id, user_id], (error, results) => {
        if (error) {
            console.error(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }
        if (results.affectedRows === 0) {
            return sendResponse(res, notFoundResponse("Comment not found or not authorized"));
        }
        sendResponse(res, successResponse(null, "Comment deleted successfully"));
    });
}));

router.get("/youtubeComments", asyncHandler(async (req, res) => {
    const video_id = req.query.video_id;
    const page_token = req.query.page_token || null;

    if (!video_id) {
        return sendResponse(res, validationErrorResponse("video_id is required"));
    }

    try {
        if (!page_token) {
            const cached = await new Promise((resolve, reject) => {
                getConnection().query(
                    `SELECT external_id AS id, author_name AS author, author_avatar AS authorAvatar,
                            comment_text AS text, like_count AS likeCount, comment_time AS publishedAt
                     FROM comments
                     WHERE video_id = ? AND source = 'youtube'
                     ORDER BY like_count DESC, comment_time DESC
                     LIMIT 10`,
                    [video_id],
                    (error, rows) => {
                        if (error) return reject(error);
                        resolve(rows);
                    }
                );
            });
            if (cached.length > 0) {
                return sendResponse(res, successResponse({
                    comments: cached,
                    nextPageToken: null,
                    disabled: false,
                }, "YouTube comments retrieved successfully"));
            }
        }

        // Caching requires video_id to exist locally (comments.video_id FKs
        // to videos.video_id) — a client can request any video_id, and one
        // that's never been synced by the channel jobs would otherwise fail
        // that FK check on every attempt. Still fetch-and-return live for
        // display, just skip the cache write.
        const videoExists = await new Promise((resolve, reject) => {
            getConnection().query(
                `SELECT 1 FROM videos WHERE video_id = ? LIMIT 1`,
                [video_id],
                (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows.length > 0);
                }
            );
        });

        const result = videoExists
            ? await fetchAndCacheYoutubeComments(video_id, page_token)
            : await fetchYoutubeComments(video_id, page_token);
        sendResponse(res, successResponse(result, "YouTube comments retrieved successfully"));
    } catch (error) {
        console.log(
            "YoutubeComments: " +
                (error.response ? JSON.stringify(error.response.data) : error.message)
        );
        sendResponse(res, errorResponse("Failed to fetch YouTube comments"));
    }
}));

module.exports = router;
