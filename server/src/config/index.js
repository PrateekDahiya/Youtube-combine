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

function cloudinaryErrorMessage(err) {
    if (!err) return "Cloudinary upload failed";
    if (err.message) return err.message;
    return String(err);
}

module.exports = {
    cloudinary,
    isCloudinaryConfigured,
    cloudinaryErrorMessage,
    API_KEYS,
};