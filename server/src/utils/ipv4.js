const http = require("http");
const https = require("https");

function requestOnce(url, { method, headers, body }, redirectsLeft) {
    return new Promise((resolve, reject) => {
        const transport = url.protocol === "http:" ? http : https;
        const req = transport.request(url, { method, headers, family: 4 }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirectsLeft > 0) {
                res.resume();
                const next = new URL(res.headers.location, url);
                const nextMethod = res.statusCode === 303 ? "GET" : method;
                resolve(requestOnce(
                    next,
                    { method: nextMethod, headers, body: nextMethod === "GET" ? undefined : body },
                    redirectsLeft - 1
                ));
                return;
            }
            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
                resolve(new Response(Buffer.concat(chunks), {
                    status: res.statusCode,
                    headers: res.headers,
                }));
            });
        });
        req.on("error", reject);
        if (body !== undefined) {
            req.write(body);
        }
        req.end();
    });
}

async function ipv4Fetch(input, init = {}) {
    let url;
    const headers = {};
    let method = "GET";
    let body;
    if (typeof input === "string" || input instanceof URL) {
        url = new URL(input);
        method = init.method || "GET";
        body = init.body;
    } else if (input instanceof Request) {
        url = new URL(input.url);
        method = init.method || input.method || "GET";
        input.headers.forEach((value, key) => {
            headers[key] = value;
        });
        if (init.body !== undefined) {
            body = init.body;
        } else if (method !== "GET" && method !== "HEAD") {
            body = Buffer.from(await input.arrayBuffer());
        }
    } else {
        throw new TypeError("ipv4Fetch: invalid input");
    }
    if (init.headers) {
        new Headers(init.headers).forEach((value, key) => {
            headers[key] = value;
        });
    }
    headers["accept-encoding"] = "identity";
    return requestOnce(url, { method, headers, body }, 5);
}

const httpAgent = new http.Agent({ family: 4 });
const httpsAgent = new https.Agent({ family: 4 });

module.exports = { ipv4Fetch, httpAgent, httpsAgent };
