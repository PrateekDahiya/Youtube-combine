const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const { asyncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, sendResponse } = require("../utils/responseWrapper");

const MEDIA_DIR = path.join(__dirname, "../../media");
const MANIFEST_PATH = path.join(MEDIA_DIR, "manifest.json");
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9-_]{11}$/;

function loadManifest() {
    try {
        return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    } catch (error) {
        return {};
    }
}

function saveManifest(manifest) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 4));
}

function streamUrl(req, videoId, label) {
    const base = `${req.protocol}://${req.get("host")}`;
    return `${base}/api/local-stream/${videoId}/${label}`;
}

router.get("/local-stream/list", (req, res) => {
    const manifest = loadManifest();
    const out = {};
    for (const [videoId, entry] of Object.entries(manifest)) {
        out[videoId] = {
            qualities: (entry.qualities || [])
                .filter((q) => q && q.label && q.file)
                .map((q) => ({ label: q.label, url: streamUrl(req, videoId, q.label) })),
        };
    }
    sendResponse(res, successResponse(out, "Local media list retrieved successfully"));
});

router.get("/local-stream/:videoId/:quality", (req, res) => {
    const { videoId, quality } = req.params;
    if (!YOUTUBE_ID_REGEX.test(videoId)) {
        return sendResponse(res, validationErrorResponse("Invalid videoId"));
    }
    const manifest = loadManifest();
    const entry = manifest[videoId];
    const match = entry && (entry.qualities || []).find((q) => q.label === quality);
    if (!match) {
        return sendResponse(res, errorResponse("Local stream not found", 404));
    }
    const filePath = path.join(MEDIA_DIR, path.basename(match.file));
    if (!fs.existsSync(filePath)) {
        return sendResponse(res, errorResponse("Local media file missing", 404));
    }
    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    if (!range) {
        res.writeHead(200, {
            "Content-Length": stat.size,
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes",
        });
        fs.createReadStream(filePath).pipe(res);
        return;
    }
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
    if (isNaN(start) || isNaN(end) || start >= stat.size || end >= stat.size || start > end) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        return res.end();
    }
    res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": "video/mp4",
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
});

router.post("/local-stream/add", asyncHandler(async (req, res) => {
    const { video_id: videoId } = req.body || {};
    if (!videoId || !YOUTUBE_ID_REGEX.test(videoId)) {
        return sendResponse(res, validationErrorResponse("A valid 11-character video_id is required"));
    }
    const manifest = loadManifest();
    if (manifest[videoId]) {
        return sendResponse(res, successResponse({ video_id: videoId, already: true }, "Video already in local media"));
    }
    const { resolveStream } = require("../youtube/streamResolver");
    let resolved;
    try {
        resolved = await resolveStream(videoId);
    } catch (error) {
        return sendResponse(res, errorResponse("Stream resolver failed: " + error.message));
    }
    const progressive = (resolved && resolved.progressive) || [];
    const playable = progressive
        .filter((f) => f.url && (f.mimeType || "").includes("mp4"))
        .sort((a, b) => (b.resolution || 0) - (a.resolution || 0))[0];
    if (!playable) {
        return sendResponse(res, errorResponse("No downloadable progressive stream found", 404));
    }
    const label = `${playable.resolution || 360}p`;
    const fileName = `${videoId}.${label}.mp4`;
    const dest = path.join(MEDIA_DIR, fileName);
    try {
        const response = await fetch(playable.url, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
                Accept: "*/*",
            },
        });
        if (!response.ok) {
            throw new Error("Download failed with status " + response.status);
        }
        fs.writeFileSync(dest, Buffer.from(await response.arrayBuffer()));
    } catch (error) {
        try {
            fs.unlinkSync(dest);
        } catch (cleanupError) {
            console.log("Error cleaning partial download:", cleanupError.message);
        }
        return sendResponse(res, errorResponse("Download failed: " + error.message));
    }
    const fresh = loadManifest();
    fresh[videoId] = { qualities: [{ label, file: fileName }] };
    saveManifest(fresh);
    sendResponse(res, successResponse({
        video_id: videoId,
        qualities: [{ label, url: streamUrl(req, videoId, label) }],
        note: "Stored on ephemeral disk; will be lost on next deploy unless committed to git",
    }, "Video added to local media"));
}));

module.exports = router;
