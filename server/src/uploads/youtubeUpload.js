const fs = require("fs");
const { google } = require("googleapis");

const CHUNK_SIZE = 256 * 1024;

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

async function initiateResumableUpload(youtube, metadata) {
    try {
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
                    embeddable: true,
                },
            },
        }, {
            params: { uploadType: "resumable", notifySubscribers: false },
            headers: {
                "X-Upload-Content-Type": "video/*",
                "X-Upload-Content-Length": metadata.fileSize,
            },
        });

        const uploadUrl = response.headers.location || response.data.upload_url;
        if (!uploadUrl) {
            throw new Error("Failed to get resumable upload URL");
        }
        return uploadUrl;
    } catch (error) {
        console.error("YouTube initiate upload error:", error.message);
        if (error.response) {
            console.error("YouTube error response:", JSON.stringify(error.response.data, null, 2));
            console.error("YouTube error status:", error.response.status);
        }
        throw error;
    }
}

async function uploadChunked(uploadUrl, filePath, fileSize, onProgress) {
    let bytesUploaded = 0;

    while (bytesUploaded < fileSize) {
        const chunkEnd = Math.min(bytesUploaded + CHUNK_SIZE, fileSize);
        const chunkLength = chunkEnd - bytesUploaded;

        const chunkBuffer = Buffer.alloc(chunkLength);
        const fd = fs.openSync(filePath, "r");
        fs.readSync(fd, chunkBuffer, 0, chunkLength, bytesUploaded);
        fs.closeSync(fd);

        const contentRange = `bytes ${bytesUploaded}-${chunkEnd - 1}/${fileSize}`;

        let response;
        let attempt = 0;
        const MAX_ATTEMPTS = 5;

        while (attempt < MAX_ATTEMPTS) {
            try {
                response = await fetch(uploadUrl, {
                    method: "PUT",
                    body: chunkBuffer,
                    headers: {
                        "Content-Type": "video/*",
                        "Content-Length": chunkLength.toString(),
                        "Content-Range": contentRange,
                    },
                });

                if (response.status === 200 || response.status === 201) {
                    const data = await response.json();
                    return data;
                }

                if (response.status === 308) {
                    break;
                }

                if (response.status >= 500 && response.status < 600) {
                    attempt++;
                    if (attempt >= MAX_ATTEMPTS) {
                        throw new Error(`Upload failed after ${MAX_ATTEMPTS} attempts: ${response.status}`);
                    }
                    await new Promise(r => setTimeout(r, Math.min(2 ** attempt * 1000, 64000)));
                    continue;
                }

                const errorText = await response.text();
                throw new Error(`Upload chunk failed: ${response.status} ${errorText}`);
            } catch (error) {
                if (attempt >= MAX_ATTEMPTS - 1) throw error;
                attempt++;
                await new Promise(r => setTimeout(r, Math.min(2 ** attempt * 1000, 64000)));
            }
        }
        console.error("Upload chunked failed after all attempts for:", uploadMetadata.title);

        const rangeHeader = response?.headers?.get?.("range") || response?.headers?.get?.("Range");
        if (rangeHeader) {
            const match = rangeHeader.match(/bytes=0-(\d+)/);
            if (match) {
                bytesUploaded = parseInt(match[1]) + 1;
            } else {
                bytesUploaded = chunkEnd;
            }
        } else {
            bytesUploaded = chunkEnd;
        }

        if (onProgress && fileSize > 0) {
            onProgress(Math.round((bytesUploaded / fileSize) * 100));
        }
    }

    throw new Error("Upload completed without response");
}

async function uploadThumbnail(youtube, videoId, thumbPath) {
    await youtube.thumbnails.set({
        videoId,
        media: {
            mimeType: "image/jpeg",
            body: fs.createReadStream(thumbPath),
        },
    });
}

async function checkProcessingStatus(youtube, videoId) {
    try {
        const response = await youtube.videos.list({
            id: [videoId],
            part: ["status", "processingDetails"],
        });
        const video = response.data.items?.[0];
        if (!video) return { status: "not_found" };
        return {
            status: video.status?.uploadStatus,
            processingStatus: video.processingDetails?.processingStatus,
            timeLeftMs: video.processingDetails?.processingProgress?.timeLeftMs,
        };
    } catch (error) {
        return { status: "error", error: error.message };
    }
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

    const uploadUrl = await initiateResumableUpload(youtube, uploadMetadata);

    console.log("YouTube upload metadata:", JSON.stringify(uploadMetadata, null, 2));

    const videoResource = await uploadChunked(uploadUrl, filePath, fileSize, onProgress);

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
    return message;
}

async function pollProcessingStatus(videoId, maxWaitMs = 180000) {
    const youtube = getYouTubeClient();
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
        const status = await checkProcessingStatus(youtube, videoId);
        if (status.processingStatus === "succeeded" || status.uploadStatus === "processed") {
            return { ready: true, status };
        }
        if (status.processingStatus === "failed" || status.uploadStatus === "rejected" || status.uploadStatus === "failed") {
            return { ready: false, status };
        }
        const waitMs = Math.min(30000, Math.max(5000, (status.timeLeftMs || 30000) / 2));
        await new Promise(r => setTimeout(r, waitMs));
    }

    return { ready: false, status: { processingStatus: "timeout" } };
}

module.exports = {
    uploadToYouTube,
    deleteYouTubeVideo,
    pollProcessingStatus,
    checkProcessingStatus,
    getYouTubeClient,
    youtubeErrorMessage,
    CATEGORY_MAP,
};