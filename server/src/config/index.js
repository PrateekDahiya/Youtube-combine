const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const API_KEYS = JSON.parse(process.env.API_KEYS || "[]");

function isCloudinaryConfigured() {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
}

const MAX_VIDEO_SIZE_MB = 100;

function cloudinaryErrorMessage(err) {
    if (!err) return "Cloudinary upload failed";
    const httpCode = err.http_code || err.statusCode || err.status;
    const message = (err.message || String(err));
    if (httpCode === 413 || /413/.test(message)) {
        return `This video is too large to upload. Please use a file under ${MAX_VIDEO_SIZE_MB}MB.`;
    }
    return message;
}

module.exports = {
    cloudinary,
    isCloudinaryConfigured,
    cloudinaryErrorMessage,
    MAX_VIDEO_SIZE_MB,
    API_KEYS,
};