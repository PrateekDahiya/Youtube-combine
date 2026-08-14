const { test } = require("node:test");
const assert = require("node:assert");
const { encodeCursor, decodeCursor } = require("../src/utils");
const { cacheFetch } = require("../src/utils/cache");

test("encodeCursor/decodeCursor round-trip", () => {
    const cursor = encodeCursor("2024-01-01 10:00:00", "vid123");
    const decoded = decodeCursor(cursor);
    assert.equal(decoded.uploadTime, "2024-01-01 10:00:00");
    assert.equal(decoded.videoId, "vid123");
});

test("decodeCursor returns null for garbage", () => {
    assert.equal(decodeCursor("not-valid"), null);
    assert.equal(decodeCursor(""), null);
    assert.equal(decodeCursor("eyJ0IjoiNSJ9"), null);
});

test("cacheFetch hits cache on second call", async () => {
    let fetches = 0;
    const fetchData = (done) => {
        fetches += 1;
        setTimeout(() => done(null, { value: fetches }), 5);
    };

    const first = await new Promise((resolve) => {
        cacheFetch("test-key-1", 60, fetchData, (err, data) => resolve(data));
    });
    const second = await new Promise((resolve) => {
        cacheFetch("test-key-1", 60, fetchData, (err, data) => resolve(data));
    });

    assert.equal(fetches, 1);
    assert.equal(first.value, 1);
    assert.equal(second.value, 1);
});

test("cacheFetch does not share cached data across keys", async () => {
    let fetches = 0;
    const fetchData = (done) => {
        fetches += 1;
        done(null, fetches);
    };

    const a = await new Promise((resolve) => {
        cacheFetch("test-key-a", 60, fetchData, (err, data) => resolve(data));
    });
    const b = await new Promise((resolve) => {
        cacheFetch("test-key-b", 60, fetchData, (err, data) => resolve(data));
    });

    assert.equal(a, 1);
    assert.equal(b, 2);
});