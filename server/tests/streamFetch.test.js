const { test } = require("node:test");
const assert = require("node:assert");
const { isAllowedStreamUrl } = require("../src/routes/stream");

test("allows https googlevideo videoplayback urls", () => {
    assert.equal(
        isAllowedStreamUrl("https://rr1---sn-i5uif5t-cagz.googlevideo.com/videoplayback?expire=1&ip=1.2.3.4&id=x&itag=18&sig=abc"),
        true
    );
});

test("rejects non-googlevideo hosts", () => {
    assert.equal(isAllowedStreamUrl("https://evil.com/videoplayback?x=1"), false);
    assert.equal(isAllowedStreamUrl("https://googlevideo.com.evil.com/videoplayback?x=1"), false);
    assert.equal(isAllowedStreamUrl("https://fakegooglevideo.com/videoplayback?x=1"), false);
});

test("rejects non-https, wrong path, and garbage", () => {
    assert.equal(isAllowedStreamUrl("http://rr1---sn-x.googlevideo.com/videoplayback?x=1"), false);
    assert.equal(isAllowedStreamUrl("https://rr1---sn-x.googlevideo.com/other?x=1"), false);
    assert.equal(isAllowedStreamUrl("not a url"), false);
    assert.equal(isAllowedStreamUrl(undefined), false);
    assert.equal(isAllowedStreamUrl(""), false);
});
