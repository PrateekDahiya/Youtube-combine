const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { generateVideoId } = require("../utils");
const { upload, videoUpload, processVideoUpload, isCloudinaryConfigured } = require("../uploads");
const { cloudinary } = require("../config");
const { syncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, sendResponse } = require("../utils/responseWrapper");

router.post("/uploadSignature", syncHandler((req, res) => {
    if (!isCloudinaryConfigured()) {
        return sendResponse(res, errorResponse("Cloudinary is not configured"));
    }
    const resource_type = req.body.resource_type === "image" ? "image" : "video";
    const folder = resource_type === "image" ? "vidvault/thumbnails" : "vidvault/videos";
    const timestamp = Math.round(Date.now() / 1000);
    const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder },
        process.env.CLOUDINARY_API_SECRET
    );
    sendResponse(res, successResponse({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature,
        folder,
        resource_type,
    }, "Upload signature generated"));
}));

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
            return sendResponse(res, validationErrorResponse(err.message || "Upload failed"));
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
                            thumbFile
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

router.post("/completeVideoUpload", syncHandler((req, res) => {
    const title = (req.body.title || "").trim() || "Untitled";
    const description = req.body.description || "";
    const tags = req.body.tags || "";
    const category = req.body.category || "";
    const type = req.body.type;
    const user_id = req.body.user_id;
    const duration = parseInt(req.body.duration || 0, 10);
    const link = req.body.link || "";
    const thumbnail_link = req.body.thumbnail_link || "";
    if (!user_id) {
        return sendResponse(res, validationErrorResponse("Missing user_id"));
    }
    if (!link) {
        return sendResponse(res, validationErrorResponse("Missing video link"));
    }
    const isShort = type === "short" ? 1 : 0;
    const video_id = generateVideoId(user_id || "upload");

    const insertQuery = `INSERT INTO videos (video_id, title, views, likes, dislikes, link, upload_time, channel_id, thumbnail_link, video_description, duration, tags, category, isShort, upload_status, upload_progress)
                         VALUES (?, ?, 0, 0, 0, ?, NOW(), ?, ?, ?, ?, ?, ?, ?, 0, 100)`;
    const params = [
        video_id,
        title,
        link,
        user_id,
        thumbnail_link,
        description,
        duration,
        tags,
        category,
        isShort,
    ];

    const connection = getConnection();
    connection.query(insertQuery, params, (error) => {
        if (error) {
            console.log("completeVideoUpload insert: " + error);
            return sendResponse(res, errorResponse("Failed to save video details"));
        }
        connection.query(
            `UPDATE channels SET video_count = video_count + 1 WHERE channel_id = ?`,
            [user_id],
            (countErr) => {
                if (countErr) {
                    console.log("completeVideoUpload count update: " + countErr);
                }
                sendResponse(res, successResponse({
                    video_id,
                    upload_status: 0,
                }, "Video uploaded successfully"));
            }
        );
    });
}));

module.exports = router;