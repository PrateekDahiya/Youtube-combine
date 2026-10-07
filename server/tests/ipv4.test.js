const { test } = require("node:test");
const assert = require("node:assert");
const http = require("http");
const { ipv4Fetch, httpAgent, httpsAgent } = require("../src/utils/ipv4");

function withServer(handler) {
    return new Promise((resolve) => {
        const server = http.createServer(handler);
        server.listen(0, "127.0.0.1", () => resolve(server));
    });
}

test("ipv4Fetch returns status, headers, and body over IPv4 loopback", async () => {
    const server = await withServer((req, res) => {
        res.writeHead(200, { "Content-Type": "video/mp4", "X-Seen-Encoding": req.headers["accept-encoding"] || "" });
        res.end("hello");
    });
    try {
        const res = await ipv4Fetch(`http://127.0.0.1:${server.address().port}/v`);
        assert.equal(res.status, 200);
        assert.equal(res.headers.get("content-type"), "video/mp4");
        assert.equal(res.headers.get("x-seen-encoding"), "identity");
        assert.equal(await res.text(), "hello");
    } finally {
        server.close();
    }
});

test("ipv4Fetch follows redirects and accepts Request input", async () => {
    const server = await withServer((req, res) => {
        if (req.url === "/go") {
            res.writeHead(302, { Location: "/done" });
            return res.end();
        }
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("landed");
    });
    try {
        const res = await ipv4Fetch(new Request(`http://127.0.0.1:${server.address().port}/go`));
        assert.equal(res.status, 200);
        assert.equal(await res.text(), "landed");
    } finally {
        server.close();
    }
});

test("ipv4Fetch rejects invalid input", async () => {
    await assert.rejects(ipv4Fetch(123), TypeError);
});

test("axios agents pin IPv4 lookups", () => {
    assert.equal(httpAgent.options.family, 4);
    assert.equal(httpsAgent.options.family, 4);
});
