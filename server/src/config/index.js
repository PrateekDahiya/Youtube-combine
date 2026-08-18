const API_KEYS = JSON.parse(process.env.API_KEYS || "[]");

function isYouTubeUploadConfigured() {
    return !!(
        process.env.YOUTUBE_CLIENT_ID &&
        process.env.YOUTUBE_CLIENT_SECRET &&
        process.env.YOUTUBE_REFRESH_TOKEN
    );
}

const MAX_VIDEO_SIZE_MB = 100;

function youtubeErrorMessage(err) {
    if (!err) return "YouTube upload failed";
    const status = err.response?.status || err.statusCode || err.status;
    const message = err.message || String(err);
    if (status === 403 && /quota/.test(message)) {
        return "YouTube API quota exceeded. Please try again later.";
    }
    if (status === 401) {
        return "YouTube authentication failed. Check OAuth credentials.";
    }
    return message;
}

module.exports = {
    isYouTubeUploadConfigured,
    youtubeErrorMessage,
    MAX_VIDEO_SIZE_MB,
    API_KEYS,
};