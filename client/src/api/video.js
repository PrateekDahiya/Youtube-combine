import api from "./client";
import { videosApi } from "./videos";

export const videoApi = {
    getWatch: (videoId) =>
        videosApi.getVideos({ type: "watch", video_id: videoId }),

    getRelatedVideos: (videoId, userId) =>
        videosApi.getVideos({ type: "related", video_id: videoId, user_id: userId }),

    getVideoById: (videoId) =>
        videosApi.getVideos({ type: "videobyid", video_id: videoId }),

    getVideosOfChannel: (channelId, isShort, query = "", page = 1, userId) =>
        videosApi.getVideos({ type: "channel", channel_id: channelId, isShort, query, page, user_id: userId }),

    updateVideo: (data) =>
        api.post("/updateVideo", data),

    deleteVideo: (videoId, userId) =>
        api.post("/deleteVideo", { video_id: videoId, user_id: userId }),

    getUploadStatus: (videoId) =>
        api.get("/uploadStatus", { params: { video_id: videoId } }),

    getUploadingVideos: (channelId) =>
        api.get("/uploadingVideos", { params: { channel_id: channelId } }),
};