import api from "./client";

export const videoApi = {
    getWatch: (videoId) =>
        api.get("/watch", { params: { video_id: videoId } }),

    getRelatedVideos: (videoId) =>
        api.get("/related-videos", { params: { video_id: videoId } }),

    getVideoById: (videoId) =>
        api.get("/getvideobyid", { params: { video_id: videoId } }),

    getVideosOfChannel: (channelId, type, query = "", page = 1) =>
        api.get("/getvideosofchannel", {
            params: { channel_id: channelId, type, query, page },
        }),

    updateVideo: (data) =>
        api.post("/updateVideo", data),

    getUploadStatus: (videoId) =>
        api.get("/uploadStatus", { params: { video_id: videoId } }),

    getUploadingVideos: (channelId) =>
        api.get("/uploadingVideos", { params: { channel_id: channelId } }),
};