const { Innertube, Platform, Types, UniversalCache } = require("youtubei.js");
const { BotGuardClient } = require("bgutils-js/botguard");
const { WebPoMinter } = require("bgutils-js/webpo");
const { buildURL, getHeaders, parseLooseJSON } = require("bgutils-js/utils");
const { JSDOM } = require("jsdom");
const vm = require("vm");

Platform.shim.eval = async (data) => {
    return vm.runInNewContext("(function(){" + data.output + "})()", {});
};

let poMinter = null;
let poMinterExpiry = 0;
const PO_TOKEN_TTL_BUFFER = 60000;

async function initializePoMinter() {
    const dom = new JSDOM('<!DOCTYPE html><html lang="en"><head><title></title></head><body></body></html>', {
        url: 'https://www.youtube.com',
        referrer: 'https://www.youtube.com/',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36(KHTML, like Gecko)',
    });

    const pageResponse = await fetch('https://www.youtube.com', {
        headers: {
            "accept": "*/*",
            "accept-language": "en-US,en;q=0.7",
            "user-agent": 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36(KHTML, like Gecko)',
        }
    });

    const pageHtml = await pageResponse.text();

    const ytConfig = pageHtml.match(/ytcfg\.set\(({.+?})\);/s)?.[1];
    if (!ytConfig) {
        throw new Error('Could not find ytcfg in page HTML');
    }

    dom.window.yt = { config_: JSON.parse(ytConfig) };

    Object.assign(globalThis, {
        yt: dom.window.yt,
        window: dom.window,
        document: dom.window.document,
        location: dom.window.location,
        origin: dom.window.origin
    });

    if (!('navigator' in globalThis)) {
        Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator });
    }

    const initialAttestationData = pageHtml.match(/window\.ytAtN\(\s*({[\s\S]*?})\s*\)/);
    if (!initialAttestationData) {
        throw new Error('Could not find challenge in page HTML');
    }

    const initialAttestationDataJson = parseLooseJSON(initialAttestationData[1]);
    const challengeResponse = initialAttestationDataJson.R;

    if (!challengeResponse.bgChallenge) {
        throw new Error('Could not get challenge');
    }

    const interpreterUrl = challengeResponse.bgChallenge.interpreterUrl.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;
    const bgScriptResponse = await fetch(`https:${interpreterUrl}`);
    const interpreterJavascript = await bgScriptResponse.text();

    if (interpreterJavascript) {
        new Function(interpreterJavascript)();
    } else {
        throw new Error('Could not load VM');
    }

    const botGuardClient = await BotGuardClient.create({
        program: challengeResponse.bgChallenge.program,
        globalName: challengeResponse.bgChallenge.globalName,
        globalObject: globalThis
    });

    const webPoSignalOutput = [];
    const botguardResponse = await botGuardClient.snapshot({ webPoSignalOutput });

    const payload = ['O43z0dpjhgX20SCx4KAo', botguardResponse];

    const integrityTokenResponse = await fetch(buildURL('GenerateIT', true), {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
    });

    const integrityTokenJson = await integrityTokenResponse.json();
    const [integrityToken, estimatedTtlSecs, mintRefreshThreshold, websafeFallbackToken] = integrityTokenJson;

    const integrityTokenData = {
        integrityToken,
        estimatedTtlSecs,
        mintRefreshThreshold,
        websafeFallbackToken
    };

    poMinter = await WebPoMinter.create(integrityTokenData, webPoSignalOutput);
    poMinterExpiry = Date.now() + (estimatedTtlSecs * 1000) - PO_TOKEN_TTL_BUFFER;
}

async function getPoToken(videoId) {
    if (!poMinter || Date.now() >= poMinterExpiry) {
        await initializePoMinter();
    }
    return await poMinter.mintAsWebsafeString(videoId);
}

module.exports = { getPoToken, initializePoMinter };