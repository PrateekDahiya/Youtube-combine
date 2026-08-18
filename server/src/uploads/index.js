const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { MAX_VIDEO_SIZE_MB } = require("../config");

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

function removeLocalFile(filePath) {
    fs.unlink(filePath, () => {});
}

module.exports = {
    upload,
    videoUpload,
    uploadsDir,
    removeLocalFile,
    MAX_VIDEO_SIZE_MB,
};