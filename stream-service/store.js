const fs = require("fs");
const path = require("path");

const MEDIA_DIR = process.env.MEDIA_DIR || path.join(__dirname, "media");
const MANIFEST_PATH = path.join(MEDIA_DIR, "manifest.json");
const MAX_TOTAL_BYTES = 3 * 1024 * 1024 * 1024;
const IDLE_TTL_MS = 5 * 60 * 1000;
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9-_]{11}$/;

function keyOf(videoId, quality) {
    return `${videoId}.${quality}p`;
}

function loadManifest() {
    try {
        return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    } catch (error) {
        return {};
    }
}

function saveManifest(manifest) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function touch(manifest, key) {
    if (manifest[key]) {
        manifest[key].lastAccess = Date.now();
        saveManifest(manifest);
    }
}

function totalBytes(manifest) {
    return Object.values(manifest).reduce((sum, entry) => sum + (entry.size || 0), 0);
}

function evict(manifest, now = Date.now()) {
    const removed = [];
    for (const [key, entry] of Object.entries(manifest)) {
        const filePath = path.join(MEDIA_DIR, path.basename(entry.file || ""));
        if (!entry.file || !fs.existsSync(filePath)) {
            delete manifest[key];
            removed.push(key);
            continue;
        }
        if (now - (entry.lastAccess || 0) > IDLE_TTL_MS) {
            try {
                fs.unlinkSync(filePath);
            } catch (error) {
                console.log("Evict unlink note:", error.message);
            }
            delete manifest[key];
            removed.push(key);
        }
    }
    const byAccess = Object.entries(manifest).sort((a, b) => (a[1].lastAccess || 0) - (b[1].lastAccess || 0));
    while (totalBytes(manifest) > MAX_TOTAL_BYTES && byAccess.length > 0) {
        const [key, entry] = byAccess.shift();
        try {
            fs.unlinkSync(path.join(MEDIA_DIR, path.basename(entry.file)));
        } catch (error) {
            console.log("Evict unlink note:", error.message);
        }
        delete manifest[key];
        removed.push(key);
    }
    if (removed.length > 0) {
        saveManifest(manifest);
    }
    return removed;
}

module.exports = {
    MEDIA_DIR,
    MANIFEST_PATH,
    MAX_TOTAL_BYTES,
    IDLE_TTL_MS,
    YOUTUBE_ID_REGEX,
    keyOf,
    loadManifest,
    saveManifest,
    touch,
    totalBytes,
    evict,
};
