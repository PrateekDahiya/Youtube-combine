const { test } = require("node:test");
const assert = require("node:assert");
const { formatSelector, pickSize, runYtDlp, ytDlpCommands } = require("../downloader");

test("formatSelector prefers exact height with mp4 fallbacks", () => {
    const sel = formatSelector(720);
    assert.ok(sel.startsWith("bv*[height=720][vcodec^=avc]+ba[acodec^=mp4a]/"));
    assert.ok(sel.includes("bv*[height<=720]+ba"));
});

test("pickSize sums known sizes and bails on unknown", () => {
    assert.equal(pickSize([{ filesize: 100 }, { filesize_approx: 50 }]), 150);
    assert.equal(pickSize([{ filesize: 100 }, {}]), null);
});

test("ytDlpCommands honors YT_DLP_PATH override", () => {
    process.env.YT_DLP_PATH = "node";
    assert.deepEqual(ytDlpCommands(), [["node", []]]);
    delete process.env.YT_DLP_PATH;
    assert.deepEqual(ytDlpCommands()[0], ["yt-dlp", []]);
});

test("runYtDlp uses the YT_DLP_PATH override", async () => {
    process.env.YT_DLP_PATH = "node";
    const out = await runYtDlp(["--version"], 30000);
    assert.ok(out.trim().startsWith("v"));
    delete process.env.YT_DLP_PATH;
});
