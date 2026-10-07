const express = require("express");
const router = express.Router();
const axios = require("axios");
const { asyncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, sendResponse } = require("../utils/responseWrapper");
const { getConnection } = require("../db");
const { httpAgent, httpsAgent } = require("../utils/ipv4");

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
            `SELECT * FROM stream_cache WHERE video_id = ? AND (expires_at IS NULL OR expires_at > DATE_ADD(NOW(), INTERVAL 10 MINUTE))`,
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

function isAllowedStreamUrl(raw) {
    let target;
    try {
        target = new URL(raw);
    } catch (error) {
        return false;
    }
    return (
        target.protocol === "https:" &&
        /(^|\.)googlevideo\.com$/.test(target.hostname) &&
        target.pathname.startsWith("/videoplayback")
    );
}

function shouldRetryProxy(status, attempt) {
    return attempt === 0 && (status === 403 || status === 429);
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const PROXY_CHUNK = 1048576;

function parseRangeHeader(header) {
    if (!header) {
        return { start: 0, end: null };
    }
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!match || (match[1] === "" && match[2] === "")) {
        return null;
    }
    if (match[1] === "") {
        const suffix = parseInt(match[2], 10);
        return Number.isNaN(suffix) ? null : { suffix };
    }
    const start = parseInt(match[1], 10);
    const end = match[2] === "" ? null : parseInt(match[2], 10);
    if (Number.isNaN(start) || (end !== null && (Number.isNaN(end) || end < start))) {
        return null;
    }
    return { start, end };
}

function parseContentRangeTotal(headers) {
    const value = headers && headers["content-range"];
    if (!value) {
        return null;
    }
    const match = /\/(\d+)\s*$/.exec(value);
    return match ? parseInt(match[1], 10) : null;
}

async function fetchChunk(raw, start, end) {
    return axios.get(raw, {
        responseType: "arraybuffer",
        timeout: 60000,
        maxRedirects: 5,
        httpAgent,
        httpsAgent,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36",
            Accept: "*/*",
            Range: `bytes=${start}-${end}`,
        },
        validateStatus: () => true,
    });
}

router.get("/stream/fetch", asyncHandler(async (req, res) => {
    const raw = req.query.u;
    if (!raw || !isAllowedStreamUrl(raw)) {
        return sendResponse(res, validationErrorResponse("A valid googlevideo url query param (u) is required"));
    }
    const range = parseRangeHeader(req.headers.range);
    if (!range) {
        res.status(416);
        return res.end();
    }
    const logFailure = (status) => {
        let tag = "unparseable";
        try {
            const target = new URL(raw);
            tag = `itag=${target.searchParams.get("itag")} ip=${target.searchParams.get("ip")} expire=${target.searchParams.get("expire")}`;
        } catch (parseError) {
            console.log("Stream proxy URL parse note:", parseError.message);
        }
        console.log(`Stream proxy upstream=${status} ${tag} range=${req.headers.range || "none"} ua=${(req.headers["user-agent"] || "").slice(0, 40)}`);
    };
    let start;
    let end;
    let total = null;
    let contentType = "video/mp4";
    try {
        if (range.suffix !== undefined) {
            const probe = await fetchChunk(raw, 0, 0);
            if (probe.status !== 206) {
                logFailure(probe.status);
                res.status(probe.status);
                return res.end();
            }
            total = parseContentRangeTotal(probe.headers);
            if (!total) {
                return sendResponse(res, errorResponse("Stream fetch failed: unknown length", 502));
            }
            contentType = probe.headers["content-type"] || contentType;
            start = Math.max(0, total - range.suffix);
            end = total - 1;
        } else {
            start = range.start;
            end = range.end;
        }
        let first = await fetchChunk(raw, start, end === null ? start + PROXY_CHUNK - 1 : Math.min(end, start + PROXY_CHUNK - 1));
        if (shouldRetryProxy(first.status, 0)) {
            await sleep(1500);
            first = await fetchChunk(raw, start, end === null ? start + PROXY_CHUNK - 1 : Math.min(end, start + PROXY_CHUNK - 1));
        }
        if (first.status === 200) {
            const body = Buffer.from(first.data);
            res.writeHead(200, {
                "Content-Length": body.length,
                "Content-Type": first.headers["content-type"] || contentType,
                "Accept-Ranges": "bytes",
            });
            return res.end(body);
        }
        if (first.status !== 206) {
            logFailure(first.status);
            res.status(first.status);
            return res.end();
        }
        total = total || parseContentRangeTotal(first.headers);
        contentType = first.headers["content-type"] || contentType;
        if (end === null) {
            if (!total) {
                return sendResponse(res, errorResponse("Stream fetch failed: unknown length", 502));
            }
            end = total - 1;
        }
        if (total && start >= total) {
            res.writeHead(416, { "Content-Range": `bytes */${total}` });
            return res.end();
        }
        if (total) {
            end = Math.min(end, total - 1);
        }
        res.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${total === null ? "*" : total}`,
            "Accept-Ranges": "bytes",
            "Content-Length": end - start + 1,
            "Content-Type": contentType,
        });
        let cursor = start;
        let chunk = first;
        let complete = false;
        while (cursor <= end) {
            const body = Buffer.from(chunk.data);
            if (body.length === 0) {
                break;
            }
            if (!res.write(body.slice(0, Math.min(body.length, end - cursor + 1)))) {
                await new Promise((resolve) => res.once("drain", resolve));
            }
            cursor += body.length;
            if (cursor > end) {
                complete = true;
                break;
            }
            chunk = await fetchChunk(raw, cursor, Math.min(end, cursor + PROXY_CHUNK - 1));
            if (chunk.status !== 206) {
                break;
            }
        }
        if (!complete) {
            res.destroy();
            return;
        }
        return res.end();
    } catch (error) {
        if (!res.headersSent) {
            return sendResponse(res, errorResponse("Stream fetch failed: " + error.message, 502));
        }
        res.destroy();
    }
}));

router.get("/stream/:videoId", asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!videoId) {
        return sendResponse(res, validationErrorResponse("videoId is required"));
    }

    // Try cache first (unless a fresh resolve is requested)
    const fresh = req.query.fresh === "1";
    let result = fresh ? null : await getCachedStream(videoId);
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

router.get("/stream/file/:videoId", asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const quality = Number(req.query.quality);
    if (!videoId || !/^[a-zA-Z0-9-_]{11}$/.test(videoId)) {
        return sendResponse(res, validationErrorResponse("A valid 11-character videoId is required"));
    }
    if (!Number.isInteger(quality) || quality <= 0) {
        return sendResponse(res, validationErrorResponse("A numeric quality query param is required"));
    }
    if (!STREAM_SERVICE_URL) {
        return sendResponse(res, errorResponse("File service not configured", 501));
    }
    let response;
    try {
        response = await axios.post(
            `${STREAM_SERVICE_URL.replace(/\/$/, "")}/api/ensure`,
            { video_id: videoId, quality },
            { timeout: 600000 }
        );
    } catch (error) {
        const data = error.response && error.response.data;
        if (data && data.too_big) {
            return sendResponse(res, errorResponse("File exceeds size cap", 404));
        }
        return sendResponse(res, errorResponse("File service failed: " + error.message, 502));
    }
    const data = response.data && response.data.data;
    if (!data || !data.url) {
        return sendResponse(res, errorResponse("File service failed", 502));
    }
    sendResponse(res, successResponse({ video_id: videoId, quality, url: data.url, size: data.size }, "Quality file ready"));
}));

module.exports = router;
module.exports.isAllowedStreamUrl = isAllowedStreamUrl;
module.exports.shouldRetryProxy = shouldRetryProxy;
module.exports.parseRangeHeader = parseRangeHeader;
module.exports.parseContentRangeTotal = parseContentRangeTotal;
module.exports.PROXY_CHUNK = PROXY_CHUNK;