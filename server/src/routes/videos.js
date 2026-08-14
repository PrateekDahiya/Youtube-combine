const express = require("express");
const router = express.Router();
const path = require("path");
const { getConnection, acquireConnection } = require("../db");
const { syncHandler, asyncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, forbiddenResponse, sendResponse } = require("../utils/responseWrapper");
const { getVideosByType } = require("../feed");
const { removeLocalFile, uploadsDir } = require("../uploads");

router.post("/videos", asyncHandler(async (req, res) => {
    try {
        const payload = await getVideosByType(req.body.type, req.body);
        sendResponse(res, successResponse(payload, "Videos retrieved successfully"));
    } catch (error) {
        if (error.statusCode) {
            return sendResponse(res, {
                success: false,
                data: null,
                message: error.message,
                statusCode: error.statusCode,
            });
        }
        console.log(error);
        sendResponse(res, errorResponse("Failed to fetch videos"));
    }
}));

router.get("/uploadStatus", syncHandler((req, res) => {
    const video_id = req.query.video_id;
    const query = `SELECT video_id, upload_status, upload_progress, link, upload_error FROM videos WHERE video_id = ?`;

    const connection = getConnection();
    connection.query(query, [video_id], (error, results) => {
        if (error) {
            console.log("UploadStatus: " + error);
            return sendResponse(res, errorResponse("Internal server error"));
        }
        sendResponse(res, successResponse({ upload: results[0] || null }, "Upload status retrieved successfully"));
    });
}));

router.get("/uploadingVideos", syncHandler((req, res) => {
    const channel_id = req.query.channel_id;
    const query = `SELECT video_id, title, upload_status, upload_progress, upload_error, thumbnail_link, link, video_description, tags, category, isShort FROM videos WHERE channel_id = ? AND (upload_status != 0 OR link LIKE 'https://res.cloudinary.com/%' OR link LIKE '/uploads/%') ORDER BY upload_time DESC LIMIT 100`;

    const connection = getConnection();
    connection.query(query, [channel_id], (error, results) => {
        if (error) {
            console.log("UploadingVideos: " + error);
            return sendResponse(res, errorResponse("Internal server error"));
        }
        sendResponse(res, successResponse({ uploads: results }, "Uploading videos retrieved successfully"));
    });
}));

router.post("/updateVideo", syncHandler((req, res) => {
    const video_id = req.body.video_id;
    const user_id = req.body.user_id;
    const title = (req.body.title || "").trim() || "Untitled";
    const description = req.body.description || "";
    const tags = req.body.tags || "";
    const category = req.body.category || "";
    const isShort = req.body.isShort == "short" ? 1 : req.body.isShort == "video" ? 0 : Number(req.body.isShort || 0);
    const thumbnail_link = req.body.thumbnail_link || "";
    const hasLink = Object.prototype.hasOwnProperty.call(req.body, "link");

    const sets = ["title = ?", "video_description = ?", "tags = ?", "category = ?", "isShort = ?", "thumbnail_link = ?"];
    const params = [title, description, tags, category, isShort, thumbnail_link];
    if (hasLink) {
        sets.push("link = ?");
        params.push(req.body.link || "");
    }
    params.push(video_id, user_id);

    const query = `UPDATE videos SET ${sets.join(", ")} WHERE video_id = ? AND channel_id = ?`;

    const connection = getConnection();
    connection.query(
        query,
        params,
        (error, results) => {
            if (error) {
                console.log("UpdateVideo: " + error);
                return sendResponse(res, errorResponse("Failed to update video"));
            }
            if (results.affectedRows === 0) {
                return sendResponse(res, forbiddenResponse("Video not found or not authorized"));
            }
            sendResponse(res, successResponse(null, "Video updated successfully"));
        }
    );
}));

router.post("/deleteVideo", asyncHandler(async (req, res) => {
    const video_id = req.body.video_id;
    const user_id = req.body.user_id;

    if (!video_id || !user_id) {
        return sendResponse(res, errorResponse("video_id and user_id are required"));
    }

    const connection = await acquireConnection();

    const fail = (err, label, statusResponse) => {
        console.log(`Error ${label}: ` + err);
        connection.rollback(() => {
            connection.release();
            sendResponse(res, statusResponse || errorResponse("Failed to delete video"));
        });
    };

    connection.query(
        `SELECT channel_id, link, upload_status FROM videos WHERE video_id = ?`,
        [video_id],
        (lookupErr, rows) => {
            if (lookupErr) {
                connection.release();
                console.log("DeleteVideo lookup: " + lookupErr);
                return sendResponse(res, errorResponse("Failed to delete video"));
            }
            const video = rows[0];
            if (!video || String(video.channel_id) !== String(user_id)) {
                connection.release();
                return sendResponse(res, forbiddenResponse("Video not found or not authorized"));
            }

            connection.beginTransaction((err) => {
                if (err) {
                    connection.release();
                    console.log("Error starting transaction: " + err);
                    return sendResponse(res, errorResponse("Failed to delete video"));
                }

                const queries = [
                    ["DELETE FROM history WHERE video_id = ?", [video_id]],
                    ["DELETE FROM watchlater WHERE video_id = ?", [video_id]],
                    ["DELETE FROM likedvideos WHERE video_id = ?", [video_id]],
                    ["DELETE FROM videos WHERE video_id = ? AND channel_id = ?", [video_id, user_id]],
                ];
                if (video.upload_status === 0) {
                    queries.push([
                        "UPDATE channels SET video_count = GREATEST(video_count - 1, 0) WHERE channel_id = ?",
                        [user_id],
                    ]);
                }

                const runQuery = (index) => {
                    if (index >= queries.length) {
                        return connection.commit((commitErr) => {
                            if (commitErr) {
                                return fail(commitErr, "committing transaction");
                            }
                            connection.release();
                            if (video.link && video.link.startsWith("/uploads/")) {
                                removeLocalFile(path.join(uploadsDir, path.basename(video.link)));
                            }
                            sendResponse(res, successResponse(null, "Video deleted successfully"));
                        });
                    }
                    connection.query(queries[index][0], queries[index][1], (qErr) => {
                        if (qErr) {
                            return fail(qErr, "deleting video data");
                        }
                        runQuery(index + 1);
                    });
                };

                runQuery(0);
            });
        }
    );
}));

module.exports = router;