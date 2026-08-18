const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { generateVideoId } = require("../utils");
const { upload, videoUpload, removeLocalFile } = require("../uploads");
const { uploadToYouTube, youtubeErrorMessage } = require("../uploads/youtubeUpload");
const { isYouTubeUploadConfigured } = require("../config");
const { syncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, sendResponse } = require("../utils/responseWrapper");

function videoUploadErrorMessage(err) {
    if (err && err.code === "LIMIT_FILE_SIZE") {
        return `This video is too large to upload.`;
    }
    return (err && err.message) || "Upload failed";
}

router.post("/upload", syncHandler((req, res) => {
    upload.single("file")(req, res, (err) => {
        if (err) {
            return sendResponse(res, validationErrorResponse(err.message || "Upload failed"));
        }
        if (!req.file) {
            return sendResponse(res, validationErrorResponse("No file uploaded"));
        }
        sendResponse(res, successResponse({ url: `/uploads/${req.file.filename}` }, "File uploaded successfully"));
    });
}));

router.post("/uploadVideo", syncHandler((req, res) => {
    videoUpload.fields([
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
    ])(req, res, async (err) => {
        console.log("uploadVideo handler - err:", err);
        console.log("uploadVideo handler - req.files:", req.files);
        if (err) {
            return sendResponse(res, validationErrorResponse(videoUploadErrorMessage(err)));
        }
        if (!req.files || !req.files.video) {
            return sendResponse(res, validationErrorResponse("No video file uploaded"));
        }

        const videoFile = req.files.video[0];
        const thumbFile =
            req.files.thumbnail && req.files.thumbnail[0]
                ? req.files.thumbnail[0]
                : null;

        const title = (req.body.title || "").trim() || "Untitled";
        const description = req.body.description || "";
        const tags = req.body.tags || "";
        const category = req.body.category || "";
        const type = req.body.type;
        const user_id = req.body.user_id;
        const duration = parseInt(req.body.duration || 0, 10);
        const isShort = type === "short" ? 1 : 0;
        const video_id = generateVideoId(user_id || "upload");

        const insertQuery = `INSERT INTO videos (video_id, title, views, likes, dislikes, link, upload_time, channel_id, thumbnail_link, video_description, duration, tags, category, isShort, upload_status, upload_progress)
                             VALUES (?, ?, 0, 0, 0, '', NOW(), ?, ?, ?, ?, ?, ?, ?, 1, 0)`;
        const params = [
            video_id,
            title,
            user_id,
            "",
            description,
            duration,
            tags,
            category,
            isShort,
        ];

        const connection = getConnection();
        connection.query(insertQuery, params, async (error) => {
            if (error) {
                console.log("UploadVideo insert error:", error);
                console.log("UploadVideo insert error code:", error.code);
                console.log("UploadVideo insert error errno:", error.errno);
                console.log("UploadVideo insert error sqlMessage:", error.sqlMessage);
                console.log("UploadVideo insert error sqlState:", error.sqlState);
                removeLocalFile(videoFile.path);
                if (thumbFile) removeLocalFile(thumbFile.path);
                return sendResponse(res, errorResponse("Failed to save video details: " + (error.sqlMessage || error.message)));
            }

            if (!isYouTubeUploadConfigured()) {
                const link = `/uploads/${videoFile.filename}`;
                const thumbnail_link = thumbFile
                    ? `/uploads/${thumbFile.filename}`
                    : "";
                connection.query(
                    `UPDATE videos SET link = ?, thumbnail_link = ?, upload_status = 0, upload_progress = 100 WHERE video_id = ?`,
                    [link, thumbnail_link, video_id],
                    (updateErr) => {
                        if (updateErr) {
                            console.log("UploadVideo local link update: " + updateErr);
                        }
                        connection.query(
                            `UPDATE channels SET video_count = video_count + 1 WHERE channel_id = ?`,
                            [user_id],
                            (countErr) => {
                                if (countErr) {
                                    console.log("UploadVideo count update: " + countErr);
                                }
                                sendResponse(res, successResponse({
                                    video_id,
                                    upload_status: 0,
                                }, "Video uploaded successfully (local fallback)"));
                            }
                        );
                    }
                );
                return;
            }

            sendResponse(res, successResponse({
                video_id,
                upload_status: 1,
            }, "Video upload started"));

            try {
                const metadata = { title, description, tags, category, type };
                const result = await uploadToYouTube(videoFile, thumbFile, metadata, (progress) => {
                    connection.query(
                        `UPDATE videos SET upload_progress = ? WHERE video_id = ?`,
                        [progress, video_id],
                        (e) => { if (e) console.log("Progress update error:", e.message); }
                    );
                });

                const link = result.watchUrl;
                const thumbnail_link = result.thumbnailUrl;

                connection.query(
                    `UPDATE videos SET link = ?, thumbnail_link = ?, upload_status = 0, upload_progress = 100, upload_error = '' WHERE video_id = ?`,
                    [link, thumbnail_link, video_id],
                    (updateErr) => {
                        if (updateErr) {
                            console.log("UploadVideo YouTube link update: " + updateErr);
                        }
                        connection.query(
                            `UPDATE channels SET video_count = video_count + 1 WHERE channel_id = ?`,
                            [user_id],
                            (countErr) => {
                                if (countErr) {
                                    console.log("UploadVideo count update: " + countErr);
                                }
                            }
                        );
                    }
                );
            } catch (uploadErr) {
                console.log("YouTube upload error: " + uploadErr.message);
                const errorMsg = youtubeErrorMessage(uploadErr);
                connection.query(
                    `UPDATE videos SET upload_status = 2, upload_error = ? WHERE video_id = ?`,
                    [errorMsg, video_id],
                    (e) => { if (e) console.log("Error update failed:", e.message); }
                );
            }
        });
    });
}));

router.post("/replaceVideo", syncHandler((req, res) => {
    videoUpload.fields([{ name: "video", maxCount: 1 }])(req, res, async (err) => {
        if (err) {
            return sendResponse(res, validationErrorResponse(videoUploadErrorMessage(err)));
        }
        if (!req.files || !req.files.video) {
            return sendResponse(res, validationErrorResponse("No video file uploaded"));
        }
        const videoFile = req.files.video[0];
        const video_id = req.body.video_id;
        const user_id = req.body.user_id;
        if (!video_id || !user_id) {
            removeLocalFile(videoFile.path);
            return sendResponse(res, validationErrorResponse("Missing video_id or user_id"));
        }

        const connection = getConnection();

        connection.query(
            `SELECT link FROM videos WHERE video_id = ? AND channel_id = ?`,
            [video_id, user_id],
            async (error, results) => {
                if (error) {
                    console.log("ReplaceVideo fetch: " + error);
                    removeLocalFile(videoFile.path);
                    return sendResponse(res, errorResponse("Failed to fetch video"));
                }
                if (!results.length) {
                    removeLocalFile(videoFile.path);
                    return sendResponse(res, validationErrorResponse("Video not found or not authorized"));
                }

                const oldLink = results[0].link;
                const oldVideoId = oldLink?.match(/[?&]v=([^&]+)/)?.[1];

                if (!isYouTubeUploadConfigured()) {
                    const link = `/uploads/${videoFile.filename}`;
                    connection.query(
                        `UPDATE videos SET link = ?, upload_status = 0, upload_progress = 100, upload_error = '' WHERE video_id = ? AND channel_id = ?`,
                        [link, video_id, user_id],
                        (updateErr, updateResults) => {
                            if (updateErr) {
                                console.log("ReplaceVideo local update: " + updateErr);
                                return sendResponse(res, errorResponse("Failed to replace video"));
                            }
                            if (!updateResults.affectedRows) {
                                return sendResponse(res, validationErrorResponse("Video not found or not authorized"));
                            }
                            sendResponse(res, successResponse({
                                video_id,
                                upload_status: 0,
                            }, "Video replaced successfully (local fallback)"));
                        }
                    );
                    return;
                }

                connection.query(
                    `UPDATE videos SET upload_status = 1, upload_progress = 0, upload_error = '' WHERE video_id = ? AND channel_id = ?`,
                    [video_id, user_id],
                    async (updateErr, updateResults) => {
                        if (updateErr) {
                            console.log("ReplaceVideo status update: " + updateErr);
                            removeLocalFile(videoFile.path);
                            return sendResponse(res, errorResponse("Failed to start video replacement"));
                        }
                        if (!updateResults.affectedRows) {
                            removeLocalFile(videoFile.path);
                            return sendResponse(res, validationErrorResponse("Video not found or not authorized"));
                        }

                        sendResponse(res, successResponse({
                            video_id,
                            upload_status: 1,
                        }, "Video replacement started"));

                        try {
                            const title = req.body.title || "Untitled";
                            const description = req.body.description || "";
                            const tags = req.body.tags || "";
                            const category = req.body.category || "";
                            const type = req.body.type || "video";

                            const metadata = { title, description, tags, category, type };
                            const result = await uploadToYouTube(videoFile, null, metadata, (progress) => {
                                connection.query(
                                    `UPDATE videos SET upload_progress = ? WHERE video_id = ?`,
                                    [progress, video_id],
                                    (e) => { if (e) console.log("Progress update error:", e.message); }
                                );
                            });

                            const link = result.watchUrl;
                            const thumbnail_link = result.thumbnailUrl;

                            connection.query(
                                `UPDATE videos SET link = ?, thumbnail_link = ?, upload_status = 0, upload_progress = 100, upload_error = '' WHERE video_id = ?`,
                                [link, thumbnail_link, video_id],
                                (e) => { if (e) console.log("ReplaceVideo YouTube link update: " + e.message); }
                            );

                            if (oldVideoId) {
                                const { deleteYouTubeVideo } = require("../uploads/youtubeUpload");
                                deleteYouTubeVideo(oldVideoId).catch(() => {});
                            }
                        } catch (uploadErr) {
                            console.log("YouTube replacement upload error: " + uploadErr.message);
                            const errorMsg = youtubeErrorMessage(uploadErr);
                            connection.query(
                                `UPDATE videos SET upload_status = 2, upload_error = ? WHERE video_id = ?`,
                                [errorMsg, video_id],
                                (e) => { if (e) console.log("Error update failed:", e.message); }
                            );
                        }
                    }
                );
            }
        );
    });
}));

module.exports = router;