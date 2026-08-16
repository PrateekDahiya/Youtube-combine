const { Innertube, Platform, UniversalCache } = require("youtubei.js");
const { BotGuardClient } = require("bgutils-js/botguard");
const { WebPoMinter } = require("bgutils-js/webpo");
const { buildURL, getHeaders } = require("bgutils-js/utils");
const { JSDOM } = require("jsdom");
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
    const bgChallenge = challengeResponse && (challengeResponse.bg_challenge || challengeResponse.bgChallenge);
    if (!bgChallenge) {
        throw new Error('Could not get attestation challenge from InnerTube');
    }

    const interpreterUrl = bgChallenge.interpreter_url?.private_do_not_access_or_else_trusted_resource_url_wrapped_value
        || bgChallenge.interpreterUrl?.privateDoNotAccessOrElseTrustedResourceUrlWrappedValue;
    const interpreterHash = bgChallenge.interpreter_hash || bgChallenge.interpreterHash;
    const program = bgChallenge.program;
    const globalName = bgChallenge.global_name || bgChallenge.globalName;

    if (!interpreterUrl || !program || !globalName) {
        throw new Error('Malformed attestation challenge response');
    }

    const bgScriptResponse = await fetch(`https:${interpreterUrl}`);
    const interpreterJavascript = await bgScriptResponse.text();

    if (interpreterJavascript) {
        const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>', {
            url: 'https://www.youtube.com/',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
            runScripts: 'dangerously',
            pretendToBeVisual: true,
        });
        const mockCtx = {
            canvas: null,
            drawImage: () => {},
            fillRect: () => {},
            getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
            putImageData: () => {},
            measureText: () => ({ width: 0 }),
            font: '',
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            globalAlpha: 1,
            globalCompositeOperation: 'source-over',
            save: () => {},
            restore: () => {},
            scale: () => {},
            rotate: () => {},
            translate: () => {},
            transform: () => {},
            setTransform: () => {},
            beginPath: () => {},
            closePath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            quadraticCurveTo: () => {},
            bezierCurveTo: () => {},
            arc: () => {},
            arcTo: () => {},
            rect: () => {},
            fill: () => {},
            stroke: () => {},
            clip: () => {},
            isPointInPath: () => false,
            isPointInStroke: () => false,
            fillText: () => {},
            strokeText: () => {},
            createLinearGradient: () => ({ addColorStop: () => {} }),
            createRadialGradient: () => ({ addColorStop: () => {} }),
            createPattern: () => null,
            createImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
            getLineDash: () => [],
            setLineDash: () => {},
            lineDashOffset: 0,
            miterLimit: 10,
            lineCap: 'butt',
            lineJoin: 'miter',
            direction: 'ltr',
            textAlign: 'start',
            textBaseline: 'alphabetic',
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'low',
        };
        dom.window.HTMLCanvasElement.prototype.getContext = function (type) {
            if (type === '2d' || type === 'webgl' || type === 'webgl2' || type === 'bitmaprenderer') {
                return mockCtx;
            }
            return null;
        };
        const scriptEl = dom.window.document.createElement('script');
        scriptEl.textContent = interpreterJavascript;
        dom.window.document.head.appendChild(scriptEl);
        if (dom.window[globalName]) {
            globalThis[globalName] = dom.window[globalName];
        }
    } else {
        throw new Error('Could not load VM');
    }

    const botGuardClient = await BotGuardClient.create({
        program,
        globalName,
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
        console.error("[PO Token] Background init failed:", err);
        setTimeout(initInBackground, 60000);
    });
}

module.exports = { getPoToken, initializePoMinter, initInBackground };