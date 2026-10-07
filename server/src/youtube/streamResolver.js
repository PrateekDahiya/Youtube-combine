const { Innertube, Platform, ClientType } = require("youtubei.js");
const vm = require("vm");

Platform.shim.eval = async (data) => {
    return vm.runInNewContext("(function(){" + data.output + "})()", {});
};

const CLIENT_FALLBACK_ORDER = [
    ClientType.MWEB,
    ClientType.IOS,
    ClientType.WEB_EMBEDDED,
    ClientType.ANDROID,
    ClientType.TV_EMBEDDED,
    ClientType.WEB,
];

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

function mergeResults(videoId, results) {
    let hls_url = null;
    const progressive = [];
    const adaptiveVideo = [];
    const adaptiveAudio = [];
    for (const result of results) {
        if (!result) continue;
        if (!hls_url && result.hls_url) {
            hls_url = result.hls_url;
        }
        if (Array.isArray(result.progressive)) {
            progressive.push(...result.progressive);
        }
        if (result.adaptive) {
            if (Array.isArray(result.adaptive.video)) {
                adaptiveVideo.push(...result.adaptive.video);
            }
            if (Array.isArray(result.adaptive.audio)) {
                adaptiveAudio.push(...result.adaptive.audio);
            }
        }
    }
    const merged = {
        video_id: videoId,
        hls_url,
        progressive: dedupeByResolution(progressive),
        adaptive: {
            video: dedupeByResolution(adaptiveVideo),
            audio: adaptiveAudio.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0)),
        },
    };
    merged.extraction_ok = Boolean(
        merged.hls_url || merged.progressive.length > 0 || merged.adaptive.video.length > 0
    );
    return merged;
}

async function resolveWithClientLogged(clientType, videoId) {
    try {
        return await resolveWithClient(clientType, videoId);
    } catch (error) {
        console.log("Error resolving stream for " + videoId + " via " + clientType + ": " + error.message);
        return null;
    }
}

async function resolveStream(videoId) {
    const settled = await Promise.allSettled(
        CLIENT_FALLBACK_ORDER.map((clientType) => resolveWithClientLogged(clientType, videoId))
    );
    const successful = settled
        .filter((result) => result.status === "fulfilled" && result.value && result.value.extraction_ok)
        .map((result) => result.value);
    if (successful.length === 0) {
        return emptyResult(videoId);
    }
    return mergeResults(videoId, successful);
}

module.exports = { resolveStream, mergeResults, dedupeByResolution, emptyResult };
