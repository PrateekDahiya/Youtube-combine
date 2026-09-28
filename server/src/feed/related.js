const { fetchRelatedVideos, fetchVideoHistory } = require("../youtube");
const { httpError, cachedFetch, flagVideos } = require("./helpers");

async function relatedFeed(params) {
    const video_id = params.video_id;
    if (!video_id) {
        throw httpError(400, "Missing video_id parameter");
    }
    let data;
    try {
        data = await cachedFetch(`related:${video_id}`, 300, async () => {
            return fetchRelatedVideos(video_id);
        });
    } catch (error) {
        if (error.statusCode) {
            throw error;
        }
        throw httpError(500, error.message);
    }
    // Never suggest the video that's currently playing.
    let videos = (data.videos || []).filter((v) => v.video_id !== video_id);
    // Never suggest videos the viewer already watched (Guests have no history).
    if (params.user_id) {
        try {
            const history = await fetchVideoHistory(params.user_id);
            const watched = new Set(history.map((h) => h.video_id));
            videos = videos.filter((v) => !watched.has(v.video_id));
        } catch (error) {
            console.log("Error excluding watched videos from related:", error.message);
        }
    }
    videos = await flagVideos(videos, params.user_id);
    return { ...data, videos };
}

module.exports = relatedFeed;
