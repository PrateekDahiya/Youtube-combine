const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { generateVideoId } = require("../utils");
const { upload, videoUpload, processVideoUpload, isCloudinaryConfigured, MAX_VIDEO_SIZE_MB } = require("../uploads");
const { syncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, sendResponse } = require("../utils/responseWrapper");

function videoUploadErrorMessage(err) {
    if (err && err.code === "LIMIT_FILE_SIZE") {
        return `This video is too large to upload. Please use a file under ${MAX_VIDEO_SIZE_MB}MB.`;
    }
    return (err && err.message) || "Upload failed";
}

router.post("/upload", syncHandler((req, res) => {
    upload.single("file")(req, res, async (err) => {
        if (err) {
            return sendResponse(res, validationErrorResponse(err.message || "Upload failed"));
        }
        if (!req.file) {
            return sendResponse(res, validationErrorResponse("No file uploaded"));
        }
        if (!isCloudinaryConfigured()) {
            return sendResponse(res, successResponse({ url: `/uploads/${req.file.filename}` }, "File uploaded successfully"));
        }
        try {
            const { cloudinaryUpload, removeLocalFile } = require("../uploads");
            const url = await cloudinaryUpload(req.file.path, "image", "vidvault/photos");
            removeLocalFile(req.file.path);
            sendResponse(res, successResponse({ url }, "Image uploaded successfully"));
        } catch (uploadErr) {
            console.log("Cloudinary image upload: " + JSON.stringify(uploadErr));
            const { removeLocalFile, cloudinaryErrorMessage } = require("../uploads");
            removeLocalFile(req.file.path);
            sendResponse(res, errorResponse(cloudinaryErrorMessage(uploadErr)));
        }
    });
}));

router.post("/uploadVideo", syncHandler((req, res) => {
    videoUpload.fields([
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
    ])(req, res, (err) => {
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
        connection.query(insertQuery, params, (error) => {
            if (error) {
                console.log("UploadVideo insert: " + error);
                return sendResponse(res, errorResponse("Failed to save video details"));
            }
            if (isCloudinaryConfigured()) {
                sendResponse(res, successResponse({
                    video_id,
                    upload_status: 1,
                }, "Video upload started"));
                setTimeout(
                    () =>
                        processVideoUpload(
                            video_id,
                            user_id,
                            videoFile,
                            thumbFile,
                            { keepThumbnail: !thumbFile }
                        ),
                    0
                );
            } else {
                const link = `/uploads/${videoFile.filename}`;
                const thumbnail_link = thumbFile
                    ? `/uploads/${thumbFile.filename}`
                    : "";
                connection.query(
                    `UPDATE videos SET link = ?, thumbnail_link = ?, upload_status = 0, upload_progress = 100 WHERE video_id = ?`,
                    [link, thumbnail_link, video_id],
                    (updateErr) => {
                        if (updateErr) {
                            console.log(
                                "UploadVideo local link update: " + updateErr
                            );
                        }
                        connection.query(
                            `UPDATE channels SET video_count = video_count + 1 WHERE channel_id = ?`,
                            [user_id],
                            (countErr) => {
                                if (countErr) {
                                    console.log(
                                        "UploadVideo count update: " + countErr
                                    );
                                }
                                sendResponse(res, successResponse({
                                    video_id,
                                    upload_status: 0,
                                }, "Video uploaded successfully"));
                            }
                        );
                    }
                );
            }
        });
    });
}));

router.post("/replaceVideo", syncHandler((req, res) => {
    videoUpload.fields([{ name: "video", maxCount: 1 }])(req, res, (err) => {
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
            return sendResponse(res, validationErrorResponse("Missing video_id or user_id"));
        }

        const connection = getConnection();

        if (!isCloudinaryConfigured()) {
            const link = `/uploads/${videoFile.filename}`;
            connection.query(
                `UPDATE videos SET link = ?, upload_status = 0, upload_progress = 100, upload_error = '' WHERE video_id = ? AND channel_id = ?`,
                [link, video_id, user_id],
                (error, results) => {
                    if (error) {
                        console.log("ReplaceVideo local update: " + error);
                        return sendResponse(res, errorResponse("Failed to replace video"));
                    }
                    if (!results.affectedRows) {
                        return sendResponse(res, validationErrorResponse("Video not found or not authorized"));
                    }
                    sendResponse(res, successResponse({
                        video_id,
                        upload_status: 0,
                    }, "Video replaced successfully"));
                }
            );
            return;
        }

        connection.query(
            `UPDATE videos SET upload_status = 1, upload_progress = 0, upload_error = '' WHERE video_id = ? AND channel_id = ?`,
            [video_id, user_id],
            (error, results) => {
                if (error) {
                    console.log("ReplaceVideo status update: " + error);
                    return sendResponse(res, errorResponse("Failed to start video replacement"));
                }
                if (!results.affectedRows) {
                    return sendResponse(res, validationErrorResponse("Video not found or not authorized"));
                }
                sendResponse(res, successResponse({
                    video_id,
                    upload_status: 1,
                }, "Video replacement started"));
                setTimeout(
                    () =>
                        processVideoUpload(video_id, user_id, videoFile, null, {
                            incrementCount: false,
                            keepThumbnail: true,
                        }),
                    0
                );
            }
        );
    });
}));

module.exports = router;