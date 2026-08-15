const { Innertube, Platform } = require("youtubei.js");
const vm = require("vm");

// youtubei.js refuses to execute YouTube's obfuscated deciphering JS unless
// the host explicitly opts in (security-sensitive by design) — this wires up
// Node's `vm` module as that evaluator. Without it, every signed format URL
// fails to decipher.
Platform.shim.eval = async (data) => {
    return vm.runInNewContext("(function(){" + data.output + "})()", {});
};

// Created once and reused across requests — Innertube.create() does session
// bootstrapping (fetching player JS, etc.) that's wasteful to repeat per call.
let clientPromise = null;
function getClient() {
    if (!clientPromise) {
        clientPromise = Innertube.create();
    }
    return clientPromise;
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

async function resolveStream(videoId) {
    try {
        const client = await getClient();
        const info = await client.getInfo(videoId);
        const streamingData = info.streaming_data;

        if (!streamingData) {
            return { video_id: videoId, hls_url: null, progressive: [], adaptive: { video: [], audio: [] }, extraction_ok: false };
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

        // Highest bitrate first within each resolution, dedupe by resolution.
        const dedupeByResolution = (list) => {
            const byResolution = new Map();
            for (const item of list.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))) {
                if (!byResolution.has(item.resolution)) {
                    byResolution.set(item.resolution, item);
                }
            }
            return Array.from(byResolution.values()).sort((a, b) => (b.resolution || 0) - (a.resolution || 0));
        };

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
    } catch (error) {
        console.log("Error resolving stream for " + videoId + ": " + error.message);
        return { video_id: videoId, hls_url: null, progressive: [], adaptive: { video: [], audio: [] }, extraction_ok: false };
    }
}

module.exports = { resolveStream };
