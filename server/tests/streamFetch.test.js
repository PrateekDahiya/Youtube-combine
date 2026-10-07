const { test } = require("node:test");
const assert = require("node:assert");
const { isAllowedStreamUrl, shouldRetryProxy, parseRangeHeader, parseContentRangeTotal } = require("../src/routes/stream");

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

test("shouldRetryProxy retries once on 403/429 only", () => {
    assert.equal(shouldRetryProxy(403, 0), true);
    assert.equal(shouldRetryProxy(429, 0), true);
    assert.equal(shouldRetryProxy(403, 1), false);
    assert.equal(shouldRetryProxy(206, 0), false);
    assert.equal(shouldRetryProxy(404, 0), false);
    assert.equal(shouldRetryProxy(500, 0), false);
});

test("parseRangeHeader handles open, closed, and suffix ranges", () => {
    assert.deepEqual(parseRangeHeader(undefined), { start: 0, end: null });
    assert.deepEqual(parseRangeHeader("bytes=0-"), { start: 0, end: null });
    assert.deepEqual(parseRangeHeader("bytes=100-200"), { start: 100, end: 200 });
    assert.deepEqual(parseRangeHeader("bytes=-500"), { suffix: 500 });
    assert.equal(parseRangeHeader("bytes=200-100"), null);
    assert.equal(parseRangeHeader("items=0-10"), null);
    assert.equal(parseRangeHeader("bytes=-"), null);
});

test("parseContentRangeTotal reads the total", () => {
    assert.equal(parseContentRangeTotal({ "content-range": "bytes 0-1023/2277286" }), 2277286);
    assert.equal(parseContentRangeTotal({}), null);
    assert.equal(parseContentRangeTotal({ "content-range": "bytes */2277286" }), 2277286);
});

test("rejects non-https, wrong path, and garbage", () => {
    assert.equal(isAllowedStreamUrl("http://rr1---sn-x.googlevideo.com/videoplayback?x=1"), false);
    assert.equal(isAllowedStreamUrl("https://rr1---sn-x.googlevideo.com/other?x=1"), false);
    assert.equal(isAllowedStreamUrl("not a url"), false);
    assert.equal(isAllowedStreamUrl(undefined), false);
    assert.equal(isAllowedStreamUrl(""), false);
});
