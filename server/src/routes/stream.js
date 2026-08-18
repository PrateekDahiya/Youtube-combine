const express = require("express");
const router = express.Router();
const axios = require("axios");
const { asyncHandler } = require("../utils/asyncHandler");
const { successResponse, validationErrorResponse, sendResponse } = require("../utils/responseWrapper");
const { getConnection } = require("../db");

const STREAM_SERVICE_URL = process.env.STREAM_SERVICE_URL;

function extractExpireFromUrls(result) {
    const urls = [];
    if (result.hls_url) urls.push(result.hls_url);
    if (result.progressive) result.progressive.forEach(f => f.url && urls.push(f.url));
    if (result.adaptive?.video) result.adaptive.video.forEach(f => f.url && urls.push(f.url));
    if (result.adaptive?.audio) result.adaptive.audio.forEach(f => f.url && urls.push(f.url));

    let minExpire = null;
    for (const url of urls) {
        const match = url.match(/[?&]expire=(\d+)/);
        if (match) {
            const exp = parseInt(match[1], 10) * 1000; // to ms
            if (!minExpire || exp < minExpire) minExpire = exp;
        }
    }
    return minExpire;
}

async function getCachedStream(videoId) {
    const pool = getConnection();
    return new Promise((resolve, reject) => {
        pool.query(
            `SELECT * FROM stream_cache WHERE video_id = ? AND (expires_at IS NULL OR expires_at > NOW())`,
            [videoId],
            (err, rows) => {
                if (err) return reject(err);
                if (rows.length === 0) return resolve(null);
                const row = rows[0];
                const parseJson = (val) => {
                    if (!val) return val;
                    if (typeof val === 'string') {
                        try { return JSON.parse(val); } catch { return val; }
                    }
                    return val;
                };
                resolve({
                    video_id: row.video_id,
                    hls_url: row.hls_url,
                    progressive: parseJson(row.progressive_json) || [],
                    adaptive: parseJson(row.adaptive_json) || { video: [], audio: [] },
                    extraction_ok: Boolean(row.extraction_ok),
                });
            }
        );
    });
}

async function setCachedStream(videoId, result, expiresAt) {
    const pool = getConnection();
    return new Promise((resolve, reject) => {
        pool.query(
            `INSERT INTO stream_cache (video_id, hls_url, progressive_json, adaptive_json, extraction_ok, expires_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 hls_url = VALUES(hls_url),
                 progressive_json = VALUES(progressive_json),
                 adaptive_json = VALUES(adaptive_json),
                 extraction_ok = VALUES(extraction_ok),
                 expires_at = VALUES(expires_at),
                 cached_at = CURRENT_TIMESTAMP`,
            [
                videoId,
                result.hls_url || null,
                result.progressive ? JSON.stringify(result.progressive) : null,
                result.adaptive ? JSON.stringify(result.adaptive) : null,
                result.extraction_ok ? 1 : 0,
                expiresAt ? new Date(expiresAt).toISOString().slice(0, 19).replace('T', ' ') : null,
            ],
            (err) => err ? reject(err) : resolve()
        );
    });
}

async function resolveViaExternalService(videoId) {
    const url = `${STREAM_SERVICE_URL.replace(/\/$/, "")}/api/stream/${videoId}`;
    const response = await axios.get(url, { timeout: 120000 });
    return response.data.data;
}

router.get("/stream/:videoId", asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!videoId) {
        return sendResponse(res, validationErrorResponse("videoId is required"));
    }

    // Try cache first
    let result = await getCachedStream(videoId);
    let fromCache = !!result;

    if (!result) {
        if (STREAM_SERVICE_URL) {
            try {
                result = await resolveViaExternalService(videoId);
            } catch (error) {
                console.error("External stream service failed:", error.message);
                result = { video_id: videoId, hls_url: null, progressive: [], adaptive: { video: [], audio: [] }, extraction_ok: false };
            }
        } else {
            const { resolveStream } = require("../youtube/streamResolver");
            result = await resolveStream(videoId);
        }

        // Cache the result with TTL from URL expire param
        if (result.extraction_ok) {
            const expiresAt = extractExpireFromUrls(result);
            if (expiresAt) {
                try {
                    await setCachedStream(videoId, result, expiresAt);
                } catch (e) {
                    console.error("Stream cache write failed:", e.message);
                }
            }
        }
    }

    sendResponse(res, successResponse(result, fromCache ? "Stream resolved (cached)" : "Stream resolved"));
}));

module.exports = router;