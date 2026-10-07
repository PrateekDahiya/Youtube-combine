const { test } = require("node:test");
const assert = require("node:assert");
const { formatSelector, pickSize } = require("../downloader");

test("formatSelector prefers exact height with mp4 fallbacks", () => {
    const sel = formatSelector(720);
    assert.ok(sel.startsWith("bv*[height=720][vcodec^=avc]+ba[acodec^=mp4a]/"));
    assert.ok(sel.includes("bv*[height<=720]+ba"));
});

test("pickSize sums known sizes and bails on unknown", () => {
    assert.equal(pickSize([{ filesize: 100 }, { filesize_approx: 50 }]), 150);
    assert.equal(pickSize([{ filesize: 100 }, {}]), null);
});
