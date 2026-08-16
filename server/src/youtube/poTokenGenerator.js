const { Innertube, Platform, UniversalCache } = require("youtubei.js");
const { BotGuardClient } = require("bgutils-js/botguard");
const { WebPoMinter } = require("bgutils-js/webpo");
const { buildURL, getHeaders } = require("bgutils-js/utils");
const vm = require("vm");

Platform.shim.eval = async (data) => {
    return vm.runInNewContext("(function(){" + data.output + "})()", {});
};

let poMinter = null;
let poMinterExpiry = 0;
const PO_TOKEN_TTL_BUFFER = 60000;

async function initializePoMinter() {
    console.log("[PO Token] Initializing PO token minter...");
    const innertube = await Innertube.create({ cache: new UniversalCache(true) });

    const challengeResponse = await innertube.getAttestationChallenge('ENGAGEMENT_TYPE_UNBOUND');
    if (!challengeResponse || !challengeResponse.bgChallenge) {
        throw new Error('Could not get attestation challenge from InnerTube');
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
    console.log("[PO Token] PO token minter initialized, expires in " + estimatedTtlSecs + "s");
}

async function getPoToken(videoId) {
    if (!poMinter || Date.now() >= poMinterExpiry) {
        throw new Error("PO token minter not initialized");
    }
    return await poMinter.mintAsWebsafeString(videoId);
}

function initInBackground() {
    initializePoMinter().catch((err) => {
        console.error("[PO Token] Background init failed:", err.message);
        setTimeout(initInBackground, 60000);
    });
}

module.exports = { getPoToken, initializePoMinter, initInBackground };