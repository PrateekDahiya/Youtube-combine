const http = require("http");
const fs = require("fs");
const path = require("path");
const store = require("./store");
const downloader = require("./downloader");

const PORT = Number(process.env.PORT || 5001);
const QUALITIES = [144, 240, 360, 480, 720, 1080, 1440, 2160, 4320];
const inflight = new Map();

function send(res, status, body) {
    const payload = JSON.stringify(body);
    res.writeHead(status, {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "Access-Control-Allow-Origin": "*",
    });
    res.end(payload);
}

function readJson(req) {
    return new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", (chunk) => {
            raw += chunk;
            if (raw.length > 1024 * 1024) {
                reject(new Error("body too large"));
                req.destroy();
            }
        });
        req.on("end", () => {
            try {
                resolve(raw ? JSON.parse(raw) : {});
            } catch (error) {
                reject(new Error("invalid json"));
            }
        });
        req.on("error", reject);
    });
}

function baseUrl(req) {
    const proto = req.headers["x-forwarded-proto"] || "http";
    return `${proto}://${req.headers.host}`;
}

function serveFile(req, res, videoId, quality) {
    const manifest = store.loadManifest();
    const entry = manifest[store.keyOf(videoId, quality)];
    const filePath = entry && path.join(store.MEDIA_DIR, path.basename(entry.file));
    if (!entry || !fs.existsSync(filePath)) {
        return send(res, 404, { success: false, message: "File not cached" });
    }
    store.touch(manifest, store.keyOf(videoId, quality));
    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    if (!range) {
        res.writeHead(200, {
            "Content-Length": stat.size,
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
        });
        fs.createReadStream(filePath).pipe(res);
        return;
    }
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (match[1] === "" && match[2] === "")) {
        res.writeHead(416);
        return res.end();
    }
    let start;
    let end;
    if (match[1] === "") {
        const suffix = parseInt(match[2], 10);
        if (Number.isNaN(suffix)) {
            res.writeHead(416);
            return res.end();
        }
        start = Math.max(0, stat.size - suffix);
        end = stat.size - 1;
    } else {
        start = parseInt(match[1], 10);
        end = match[2] === "" ? stat.size - 1 : parseInt(match[2], 10);
        if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
            res.writeHead(416);
            return res.end();
        }
        end = Math.min(end, stat.size - 1);
    }
    if (start >= stat.size) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        return res.end();
    }
    res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Content-Type": "video/mp4",
        "Access-Control-Allow-Origin": "*",
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
}

async function ensure(videoId, quality, req) {
    const key = store.keyOf(videoId, quality);
    const manifest = store.loadManifest();
    const entry = manifest[key];
    const filePath = entry && path.join(store.MEDIA_DIR, path.basename(entry.file));
    if (entry && fs.existsSync(filePath)) {
        store.touch(manifest, key);
        return { status: "ready", url: `${baseUrl(req)}/api/file/${videoId}/${quality}`, size: entry.size };
    }
    if (inflight.has(key)) {
        return inflight.get(key);
    }
    const job = (async () => {
        const checked = await downloader.inspect(videoId, quality);
        if (!checked.ok) {
            return { status: checked.reason === "too-big" ? "too-big" : "failed", reason: checked.reason, size: checked.size || null };
        }
        const destFile = `${key}.mp4`;
        await downloader.download(videoId, quality, destFile);
        const full = path.join(store.MEDIA_DIR, destFile);
        const stat = fs.statSync(full);
        const fresh = store.loadManifest();
        fresh[key] = { file: destFile, size: stat.size, lastAccess: Date.now(), videoId, quality };
        store.evict(fresh);
        store.saveManifest(fresh);
        return { status: "ready", url: `${baseUrl(req)}/api/file/${videoId}/${quality}`, size: stat.size };
    })();
    inflight.set(key, job);
    try {
        return await job;
    } finally {
        inflight.delete(key);
    }
}

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, "http://local");
        if (req.method === "GET" && url.pathname === "/api/health") {
            return send(res, 200, { success: true, message: "stream-service ok" });
        }
        if (req.method === "POST" && url.pathname === "/api/ensure") {
            const body = await readJson(req);
            const videoId = body.video_id;
            const quality = Number(body.quality);
            if (!videoId || !store.YOUTUBE_ID_REGEX.test(videoId)) {
                return send(res, 400, { success: false, message: "A valid 11-character video_id is required" });
            }
            if (!QUALITIES.includes(quality)) {
                return send(res, 400, { success: false, message: "Unsupported quality" });
            }
            try {
                const result = await ensure(videoId, quality, req);
                if (result.status === "ready") {
                    return send(res, 200, { success: true, data: result });
                }
                if (result.status === "too-big") {
                    return send(res, 404, { success: false, too_big: true, message: "File exceeds size cap", size: result.size });
                }
                return send(res, 502, { success: false, message: "Download failed", reason: result.reason || null });
            } catch (error) {
                console.log("Ensure failed:", error.message);
                return send(res, 502, { success: false, message: "Download failed: " + error.message });
            }
        }
        const fileMatch = /^\/api\/file\/([a-zA-Z0-9-_]{11})\/(\d+)$/.exec(url.pathname);
        if (req.method === "GET" && fileMatch) {
            return serveFile(req, res, fileMatch[1], Number(fileMatch[2]));
        }
        return send(res, 404, { success: false, message: "Not found" });
    } catch (error) {
        console.log("Request failed:", error.message);
        return send(res, 500, { success: false, message: "Internal error" });
    }
});

setInterval(() => {
    try {
        const manifest = store.loadManifest();
        const removed = store.evict(manifest);
        if (removed.length > 0) {
            console.log(`Evicted ${removed.length} idle file(s)`);
        }
    } catch (error) {
        console.log("Evict sweep failed:", error.message);
    }
}, 30000);

server.listen(PORT, () => {
    console.log(`stream-service on port ${PORT}`);
    downloader.checkTools().then((tools) => {
        console.log(`tools: yt-dlp=${tools.ytdlp} ffmpeg=${tools.ffmpeg}`);
        if (!tools.ytdlp || !tools.ffmpeg) {
            console.log("WARNING: downloads will fail until yt-dlp and ffmpeg are on PATH (see YT_DLP_PATH)");
        }
    });
});

module.exports = server;
