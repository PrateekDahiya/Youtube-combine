const { Innertube, Platform, ClientType } = require("youtubei.js");
const vm = require("vm");

// youtubei.js refuses to execute YouTube's obfuscated deciphering JS unless
// the host explicitly opts in (security-sensitive by design) — this wires up
// Node's `vm` module as that evaluator. Without it, every signed format URL
// fails to decipher.
Platform.shim.eval = async (data) => {
    return vm.runInNewContext("(function(){" + data.output + "})()", {});
};

// The default WEB client is subject to YouTube's SABR streaming enforcement,
// which — confirmed empirically against real videos — leaves adaptive
// (video-only/audio-only) formats with no retrievable URL at all, and some
// videos have no progressive format either. MWEB does not have this
// restriction (100% of adaptive formats came back deciphable in testing);
// IOS is a second-choice fallback in case that changes for some videos.
// Additional clients (WEB_EMBEDDED, ANDROID, TV_EMBEDDED) improve success
// rate on hosting providers like Render where some client types are blocked.
const CLIENT_FALLBACK_ORDER = [
    ClientType.MWEB,
    ClientType.IOS,
    ClientType.WEB_EMBEDDED,
    ClientType.ANDROID,
    ClientType.TV_EMBEDDED,
    ClientType.WEB,
];

// One Innertube client per client type, created once and reused — creation
// does session bootstrapping (fetching player JS, etc.) that's wasteful to
// repeat per request.
const clientPromises = new Map();
function getClient(clientType) {
    if (!clientPromises.has(clientType)) {
        clientPromises.set(clientType, Innertube.create({ client_type: clientType }));
    }
    return clientPromises.get(clientType);
}

async function decipherFormat(format, player) {
    const url = await format.decipher(player);
    return {
        itag: format.itag,
        resolution: format.height || null,
        bitrate: format.average_bitrate || format.bitrate || null,
        mimeType: format.mime_type,
        url,
    };
}

// Best-effort: a single bad format shouldn't fail the whole request.
async function decipherAll(formats, player) {
    const settled = await Promise.allSettled(
        formats.map((format) => decipherFormat(format, player))
    );
    return settled
        .filter((result) => result.status === "fulfilled" && result.value.url)
        .map((result) => result.value);
}

function emptyResult(videoId) {
    return { video_id: videoId, hls_url: null, progressive: [], adaptive: { video: [], audio: [] }, extraction_ok: false };
}

// Highest bitrate first within each resolution, dedupe by resolution.
function dedupeByResolution(list) {
    const byResolution = new Map();
    for (const item of list.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))) {
        if (!byResolution.has(item.resolution)) {
            byResolution.set(item.resolution, item);
        }
    }
    return Array.from(byResolution.values()).sort((a, b) => (b.resolution || 0) - (a.resolution || 0));
}

async function resolveWithClient(clientType, videoId) {
    const client = await getClient(clientType);
    const info = await client.getBasicInfo(videoId);
    const streamingData = info.streaming_data;

    if (!streamingData) {
        return emptyResult(videoId);
    }

    const player = client.session.player;
    const progressiveFormats = (streamingData.formats || []).filter((f) => f.has_audio && f.has_video);
    const adaptiveVideoFormats = (streamingData.adaptive_formats || []).filter((f) => f.has_video && !f.has_audio);
    const adaptiveAudioFormats = (streamingData.adaptive_formats || []).filter((f) => f.has_audio && !f.has_video);

    const [progressive, adaptiveVideo, adaptiveAudio] = await Promise.all([
        decipherAll(progressiveFormats, player),
        decipherAll(adaptiveVideoFormats, player),
        decipherAll(adaptiveAudioFormats, player),
    ]);

    const result = {
        video_id: videoId,
        hls_url: streamingData.hls_manifest_url || null,
        progressive: dedupeByResolution(progressive),
        adaptive: {
            video: dedupeByResolution(adaptiveVideo),
            audio: adaptiveAudio.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0)),
        },
    };

    result.extraction_ok = Boolean(
        result.hls_url || result.progressive.length > 0 || result.adaptive.video.length > 0
    );

    return result;
}

// Tries each client in CLIENT_FALLBACK_ORDER until one yields a usable
// result — a video that's blocked/empty on one client is often fine on
// another (see the comment on CLIENT_FALLBACK_ORDER above).
async function resolveStream(videoId) {
    let last = emptyResult(videoId);
    for (const clientType of CLIENT_FALLBACK_ORDER) {
        try {
            const result = await resolveWithClient(clientType, videoId);
            if (result.extraction_ok) {
                return result;
            }
            last = result;
        } catch (error) {
            console.log("Error resolving stream for " + videoId + " via " + clientType + ": " + error.message);
        }
    }
    return last;
}

module.exports = { resolveStream };
