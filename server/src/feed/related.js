const { fetchRelatedVideos } = require("../youtube");
const { httpError, flagVideos } = require("./helpers");

async function relatedFeed(params) {
    const video_id = params.video_id;
    if (!video_id) {
        throw httpError(400, "Missing video_id parameter");
    }
    let data;
    try {
        data = await fetchRelatedVideos(video_id);
    } catch (error) {
        if (error.statusCode) {
            throw error;
        }
        throw httpError(500, error.message);
    }
    const videos = await flagVideos(data.videos, params.user_id);
    return { ...data, videos };
}

module.exports = relatedFeed;
