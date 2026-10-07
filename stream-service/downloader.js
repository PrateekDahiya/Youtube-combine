const { execFile } = require("child_process");
const path = require("path");
const { MEDIA_DIR, MAX_TOTAL_BYTES } = require("./store");

function formatSelector(quality) {
    const q = Number(quality);
    return (
        `bv*[height=${q}][vcodec^=avc]+ba[acodec^=mp4a]/` +
        `bv*[height=${q}]+ba/` +
        `bv*[height<=${q}][vcodec^=avc]+ba[acodec^=mp4a]/` +
        `bv*[height<=${q}]+ba/b[height<=${q}]/b`
    );
}

function runYtDlp(args, timeoutMs = 600000) {
    return new Promise((resolve, reject) => {
        execFile("yt-dlp", args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error((stderr || error.message || "").trim().split("\n").pop()));
                return;
            }
            resolve(stdout);
        });
    });
}

function pickSize(formats) {
    let total = 0;
    for (const f of formats) {
        const size = f.filesize || f.filesize_approx;
        if (!size) {
            return null;
        }
        total += size;
    }
    return total;
}

async function inspect(videoId, quality) {
    const stdout = await runYtDlp([
        "--js-runtimes", "node",
        "--dump-single-json",
        "--no-download",
        "--no-playlist",
        "-f", formatSelector(quality),
        `https://www.youtube.com/watch?v=${videoId}`,
    ]);
    const info = JSON.parse(stdout);
    const requested = (info.requested_formats || []).filter(Boolean);
    if (requested.length === 0) {
        return { ok: false, reason: "no-format" };
    }
    const size = pickSize(requested);
    if (size !== null && size > MAX_TOTAL_BYTES) {
        return { ok: false, reason: "too-big", size };
    }
    const height = Math.max(...requested.map((f) => f.height || 0));
    return { ok: true, size, height };
}

async function download(videoId, quality, destFile) {
    const maxSize = `${Math.floor(MAX_TOTAL_BYTES / 1024 / 1024)}M`;
    await runYtDlp([
        "--js-runtimes", "node",
        "--no-playlist",
        "--merge-output-format", "mp4",
        "--max-filesize", maxSize,
        "-f", formatSelector(quality),
        "-o", path.join(MEDIA_DIR, destFile),
        `https://www.youtube.com/watch?v=${videoId}`,
    ]);
}

module.exports = { formatSelector, pickSize, inspect, download };
