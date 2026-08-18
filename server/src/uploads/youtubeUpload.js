const fs = require("fs");
const { google } = require("googleapis");

const CATEGORY_MAP = {
    "Music": "10",
    "Gaming": "20",
    "Movies": "1",
    "News": "25",
    "Sports": "17",
    "Education": "27",
    "Entertainment": "24",
    "Other": "22",
};

function getYouTubeClient() {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
        throw new Error("YouTube OAuth2 credentials not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN");
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    return google.youtube({ version: "v3", auth: oauth2Client });
}

function mapCategory(category) {
    return CATEGORY_MAP[category] || "22";
}

function sanitizeMetadata(metadata) {
    const title = (metadata.title || "Untitled").substring(0, 100);
    const description = (metadata.description || "").substring(0, 5000);
    let tags = metadata.tags || "";
    if (tags) {
        const tagList = tags.split(",").map(t => t.trim()).filter(Boolean);
        const limited = tagList.slice(0, 30).map(t => t.substring(0, 500));
        tags = limited.join(", ");
    }
    return {
        title,
        description,
        tags,
        categoryId: mapCategory(metadata.category),
    };
}

async function uploadToYouTube(videoFile, thumbFile, metadata, onProgress) {
    const youtube = getYouTubeClient();
    const filePath = videoFile.path;
    const fileSize = videoFile.size || fs.statSync(filePath).size;

    const uploadMetadata = sanitizeMetadata(metadata);
    uploadMetadata.fileSize = fileSize;

    if (metadata.type === "short") {
        const tagList = uploadMetadata.tags.split(",").map(t => t.trim()).filter(Boolean);
        if (!tagList.some(t => /shorts?/i.test(t))) {
            tagList.push("shorts");
        }
        uploadMetadata.tags = tagList.join(",");
    }

    if (onProgress) onProgress(0);

    const media = {
        mimeType: "video/*",
        body: fs.createReadStream(filePath),
    };

    const response = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
            snippet: {
                title: uploadMetadata.title,
                description: uploadMetadata.description,
                tags: uploadMetadata.tags ? uploadMetadata.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
                categoryId: uploadMetadata.categoryId,
            },
            status: {
                privacyStatus: "unlisted",
                selfDeclaredMadeForKids: false,
                embeddable: true,
            },
        },
        media,
        params: { notifySubscribers: false },
    });

    const videoId = response.data.id;
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

    if (thumbFile) {
        try {
            await youtube.thumbnails.set({
                videoId,
                media: {
                    mimeType: "image/jpeg",
                    body: fs.createReadStream(thumbFile.path),
                },
            });
        } catch (thumbError) {
            console.log("Thumbnail upload failed (using auto-generated):", thumbError.message);
        }
    }

    return {
        videoId,
        watchUrl,
        thumbnailUrl,
    };
}

async function deleteYouTubeVideo(videoId) {
    try {
        const youtube = getYouTubeClient();
        await youtube.videos.delete({ id: videoId });
        return true;
    } catch (error) {
        console.log("Failed to delete YouTube video:", error.message);
        return false;
    }
}

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
    if (message.includes("invalid argument")) {
        return "YouTube rejected the video metadata. Check title length (max 100 chars), description (max 5000), tags, and category.";
    }
    if (message.includes("unauthorized") || message.includes("forbidden")) {
        return "YouTube upload unauthorized. OAuth token may not have access to this channel.";
    }
    return message;
}

module.exports = {
    uploadToYouTube,
    deleteYouTubeVideo,
    getYouTubeClient,
    youtubeErrorMessage,
    CATEGORY_MAP,
};