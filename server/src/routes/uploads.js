const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { generateVideoId } = require("../utils");
const { upload, videoUpload, processVideoUpload, isCloudinaryConfigured } = require("../uploads");
const { syncHandler } = require("../utils/asyncHandler");

router.post("/upload", syncHandler((req, res) => {
    upload.single("file")(req, res, async (err) => {
        if (err) {
            return res
                .status(400)
                .json({ error: err.message || "Upload failed" });
        }
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        if (!isCloudinaryConfigured()) {
            return res.status(200).json({ url: `/uploads/${req.file.filename}` });
        }
        try {
            const { cloudinaryUpload, removeLocalFile } = require("../uploads");
            const url = await cloudinaryUpload(req.file.path, "image", "vidvault/photos");
            removeLocalFile(req.file.path);
            res.status(200).json({ url });
        } catch (uploadErr) {
            console.log("Cloudinary image upload: " + JSON.stringify(uploadErr));
            const { removeLocalFile, cloudinaryErrorMessage } = require("../uploads");
            removeLocalFile(req.file.path);
            res.status(500).json({ error: cloudinaryErrorMessage(uploadErr) });
        }
    });
}));

router.post("/uploadVideo", syncHandler((req, res) => {
    videoUpload.fields([
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
    ])(req, res, (err) => {
        if (err) {
            return res
                .status(400)
                .json({ error: err.message || "Upload failed" });
        }
        if (!req.files || !req.files.video) {
            return res.status(400).json({ error: "No video file uploaded" });
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
                return res
                    .status(500)
                    .json({ error: "Failed to save video details" });
            }
            if (isCloudinaryConfigured()) {
                res.status(200).json({
                    message: "Video upload started",
                    video_id,
                    upload_status: 1,
                });
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
                                res.status(200).json({
                                    message: "Video uploaded successfully",
                                    video_id,
                                    upload_status: 0,
                                });
                            }
                        );
                    }
                );
            }
        });
    });
}));

module.exports = router;
