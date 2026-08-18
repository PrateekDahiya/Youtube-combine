const fs = require("fs");
const path = require("path");
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

async function getAccessToken() {
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials.access_token;
}

async function initiateResumableUpload(youtube, metadata) {
    const response = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
            snippet: {
                title: metadata.title,
                description: metadata.description,
                tags: metadata.tags ? metadata.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
                categoryId: metadata.categoryId,
            },
            status: {
                privacyStatus: "unlisted",
                selfDeclaredMadeForKids: false,
            },
        },
        media: {
            body: "",
        },
    }, {
        headers: {
            "X-Upload-Content-Type": "video/*",
            "X-Upload-Content-Length": metadata.fileSize,
        },
    });

    const uploadUrl = response.data.upload_url || response.headers.location;
    if (!uploadUrl) {
        throw new Error("Failed to get resumable upload URL");
    }
    return uploadUrl;
}

async function uploadVideoFile(uploadUrl, filePath, onProgress) {
    const fileSize = fs.statSync(filePath).size;
    const chunkSize = 10 * 1024 * 1024;
    let bytesSent = 0;

    return new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(filePath, { highWaterMark: chunkSize });

        readStream.on("data", (chunk) => {
            bytesSent += chunk.length;
            if (onProgress && fileSize > 0) {
                onProgress(Math.round((bytesSent / fileSize) * 100));
            }
        });

        readStream.on("error", reject);

        const upload = async () => {
            try {
                const response = await fetch(uploadUrl, {
                    method: "PUT",
                    body: readStream,
                    headers: {
                        "Content-Type": "video/*",
                        "Content-Length": fileSize,
                        "Content-Range": `bytes 0-${fileSize - 1}/${fileSize}`,
                    },
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Upload failed: ${response.status} ${errorText}`);
                }

                const data = await response.json();
                resolve(data);
            } catch (error) {
                reject(error);
            }
        };

        upload();
    });
}

async function uploadThumbnail(youtube, videoId, thumbPath) {
    const response = await youtube.thumbnails.set({
        videoId,
        media: {
            mimeType: "image/jpeg",
            body: fs.createReadStream(thumbPath),
        },
    });
    return response.data;
}

function mapCategory(category) {
    return CATEGORY_MAP[category] || "22";
}

async function uploadToYouTube(videoFile, thumbFile, metadata, onProgress) {
    const youtube = getYouTubeClient();

    const uploadMetadata = {
        title: metadata.title || "Untitled",
        description: metadata.description || "",
        tags: metadata.tags || "",
        categoryId: mapCategory(metadata.category),
        fileSize: videoFile.size || fs.statSync(videoFile.path).size,
    };

    const uploadUrl = await initiateResumableUpload(youtube, uploadMetadata);

    const videoResource = await uploadVideoFile(uploadUrl, videoFile.path, onProgress);

    const videoId = videoResource.id;
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;

    if (thumbFile) {
        try {
            await uploadThumbnail(youtube, videoId, thumbFile.path);
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

module.exports = {
    uploadToYouTube,
    deleteYouTubeVideo,
    getYouTubeClient,
    CATEGORY_MAP,
};