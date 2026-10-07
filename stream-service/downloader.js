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

function execCandidate(cmd, args, opts) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, opts, (error, stdout, stderr) => {
            if (error) {
                const detail = (stderr || error.message || "").trim().split("\n").pop();
                const wrapped = new Error(detail);
                wrapped.code = error.code;
                reject(wrapped);
                return;
            }
            resolve(stdout);
        });
    });
}

function ytDlpCommands() {
    if (process.env.YT_DLP_PATH) {
        return [[process.env.YT_DLP_PATH, []]];
    }
    return [
        ["yt-dlp", []],
        ["python3", ["-m", "yt_dlp"]],
        ["python", ["-m", "yt_dlp"]],
    ];
}

async function runYtDlp(args, timeoutMs = 600000) {
    const opts = { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 };
    let lastError = null;
    for (const [cmd, prefix] of ytDlpCommands()) {
        try {
            return await execCandidate(cmd, [...prefix, ...args], opts);
        } catch (error) {
            lastError = error;
            if (error.code !== "ENOENT") {
                break;
            }
        }
    }
    throw lastError;
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

function execOk(cmd, args) {
    return new Promise((resolve) => {
        execFile(cmd, args, { timeout: 30000 }, (error) => resolve(!error));
    });
}

async function checkTools() {
    let ytdlp = false;
    try {
        await runYtDlp(["--version"], 30000);
        ytdlp = true;
    } catch (error) {
        ytdlp = false;
    }
    return { ytdlp, ffmpeg: await execOk("ffmpeg", ["-version"]) };
}

module.exports = { formatSelector, pickSize, inspect, download, runYtDlp, ytDlpCommands, checkTools };
