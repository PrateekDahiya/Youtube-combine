const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { cloudinary, isCloudinaryConfigured, cloudinaryErrorMessage, MAX_VIDEO_SIZE_MB } = require("../config");
const { getConnection } = require("../db");

const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid image type"));
        }
    },
});

const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        cb(
            null,
            "vid-" + Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname).toLowerCase()
        );
    },
});

const videoUpload = multer({
    storage: videoStorage,
    limits: { fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^video\//.test(file.mimetype)) {
            cb(null, true);
        } else if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type"));
        }
    },
});

function cloudinaryUpload(filePath, resourceType, folder, onProgress) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: resourceType, folder },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        const total = fs.statSync(filePath).size;
        let sent = 0;
        const reader = fs.createReadStream(filePath);
        reader.on("data", (chunk) => {
            sent += chunk.length;
            if (onProgress && total > 0) {
                onProgress(Math.round((sent / total) * 100));
            }
        });
        reader.on("error", reject);
        reader.pipe(stream);
    });
}

function removeLocalFile(filePath) {
    fs.unlink(filePath, () => {});
}

function processVideoUpload(video_id, user_id, videoFile, thumbFile, options = {}) {
    const incrementCount = options.incrementCount !== false;
    const keepThumbnail = !!options.keepThumbnail;
    const connection = getConnection();

    const update = (fields) => {
        const sets = [];
        const params = [];
        Object.entries(fields).forEach(([col, val]) => {
            sets.push(`${col} = ?`);
            params.push(val);
        });
        params.push(video_id);
        connection.query(
            `UPDATE videos SET ${sets.join(", ")} WHERE video_id = ?`,
            params,
            (error) => {
                if (error) console.log("UploadVideo status update: " + error);
            }
        );
    };

    let lastPersist = 0;
    const persistProgress = (p) => {
        const now = Date.now();
        if (now - lastPersist < 500) return;
        lastPersist = now;
        update({ upload_progress: p });
    };

    const cleanup = () => {
        removeLocalFile(videoFile.path);
        if (thumbFile) removeLocalFile(thumbFile.path);
    };

    const complete = (link, thumbnail_link) => {
        cleanup();
        const fields = {
            link: link || "",
            upload_status: 0,
            upload_progress: 100,
            upload_error: "",
        };
        if (!keepThumbnail) {
            let finalThumbnail = thumbnail_link;
            if (
                !finalThumbnail &&
                typeof link === "string" &&
                link.includes("cloudinary.com")
            ) {
                finalThumbnail = link.replace(/\.[a-zA-Z0-9]+$/, ".jpg");
            }
            fields.thumbnail_link = finalThumbnail;
        }
        update(fields);
        if (incrementCount) {
            connection.query(
                `UPDATE channels SET video_count = video_count + 1 WHERE channel_id = ?`,
                [user_id],
                (updateErr) => {
                    if (updateErr) {
                        console.log("UploadVideo count update: " + updateErr);
                    }
                }
            );
        }
    };

    const fail = (err) => {
        console.log(
            "Cloudinary background upload: " +
                (err && err.message ? err.message : err)
        );
        cleanup();
        update({ upload_status: 2, upload_error: cloudinaryErrorMessage(err) });
    };

    try {
        cloudinaryUpload(videoFile.path, "video", "vidvault/videos", persistProgress)
            .then((link) => {
                if (thumbFile) {
                    update({ upload_progress: 50 });
                    return cloudinaryUpload(
                        thumbFile.path,
                        "image",
                        "vidvault/thumbnails"
                    ).then((thumbnail_link) => complete(link, thumbnail_link));
                }
                complete(link, "");
            })
            .catch(fail);
    } catch (err) {
        fail(err);
    }
}

module.exports = {
    upload,
    videoUpload,
    uploadsDir,
    cloudinaryUpload,
    removeLocalFile,
    processVideoUpload,
    isCloudinaryConfigured,
    cloudinaryErrorMessage,
    MAX_VIDEO_SIZE_MB,
};