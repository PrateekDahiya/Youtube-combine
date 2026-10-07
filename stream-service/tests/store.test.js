process.env.MEDIA_DIR = "D:/Documents/Projects/Youtube-combine/stream-service/tests/tmp-media";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const store = require("../store");

function resetTmp() {
    fs.rmSync(process.env.MEDIA_DIR, { recursive: true, force: true });
    fs.mkdirSync(process.env.MEDIA_DIR, { recursive: true });
}

test("keyOf builds video-quality keys", () => {
    assert.equal(store.keyOf("YpNT0_sT_mc", 720), "YpNT0_sT_mc.720p");
});

test("evict removes idle entries and drops missing files", () => {
    resetTmp();
    const now = Date.now();
    fs.writeFileSync(path.join(process.env.MEDIA_DIR, "a.240p.mp4"), "x".repeat(10));
    fs.writeFileSync(path.join(process.env.MEDIA_DIR, "b.240p.mp4"), "x".repeat(10));
    const manifest = {
        "a.240p": { file: "a.240p.mp4", size: 10, lastAccess: now - 10 * 60 * 1000 },
        "b.240p": { file: "b.240p.mp4", size: 10, lastAccess: now },
        "gone.240p": { file: "gone.240p.mp4", size: 10, lastAccess: now },
    };
    const removed = store.evict(manifest, now);
    assert.ok(removed.includes("a.240p"));
    assert.ok(removed.includes("gone.240p"));
    assert.ok(!removed.includes("b.240p"));
    assert.equal(fs.existsSync(path.join(process.env.MEDIA_DIR, "a.240p.mp4")), false);
    assert.equal(fs.existsSync(path.join(process.env.MEDIA_DIR, "b.240p.mp4")), true);
    fs.rmSync(process.env.MEDIA_DIR, { recursive: true, force: true });
});

test("evict enforces the total size cap by oldest access", () => {
    resetTmp();
    const now = Date.now();
    fs.writeFileSync(path.join(process.env.MEDIA_DIR, "old.720p.mp4"), "x".repeat(10));
    fs.writeFileSync(path.join(process.env.MEDIA_DIR, "new.720p.mp4"), "x".repeat(10));
    const manifest = {
        "old.720p": { file: "old.720p.mp4", size: store.MAX_TOTAL_BYTES, lastAccess: now - 1000 },
        "new.720p": { file: "new.720p.mp4", size: 10, lastAccess: now },
    };
    const removed = store.evict(manifest, now);
    assert.ok(removed.includes("old.720p"));
    assert.ok(manifest["new.720p"]);
    fs.rmSync(process.env.MEDIA_DIR, { recursive: true, force: true });
});

test("totalBytes sums entry sizes", () => {
    assert.equal(store.totalBytes({ a: { size: 5 }, b: { size: 7 } }), 12);
});
