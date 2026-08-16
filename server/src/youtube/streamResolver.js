const { Innertube, Platform, ClientType } = require("youtubei.js");
const vm = require("vm");
const { getPoToken } = require("./poTokenGenerator");

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

async function resolveWithClient(clientType, videoId, poToken) {
    const client = await getClient(clientType);
    const options = poToken ? { po_token: poToken } : {};
    const info = await client.getBasicInfo(videoId, options);
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

    if (!last.extraction_ok) {
        try {
            console.log("Retrying with PO token for " + videoId);
            const poToken = await getPoToken(videoId);
            const result = await resolveWithClient(ClientType.MWEB, videoId, poToken);
            if (result.extraction_ok) {
                console.log("PO token succeeded for " + videoId);
                return result;
            }
            last = result;
        } catch (error) {
            console.log("Error resolving stream for " + videoId + " with PO token: " + error.message);
        }
    }

    return last;
}

module.exports = { resolveStream };