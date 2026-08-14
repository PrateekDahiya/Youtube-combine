import api from "./client";
import { videosApi } from "./videos";

export const watchlaterApi = {
    getWatchlater: (userId) =>
        videosApi.getVideos({ type: "watchlater", user_id: userId }),

    addToWatchlater: (userId, videoId) =>
        api.post("/addtowatchlater", { user_id: userId, video_id: videoId }),

    removeFromWatchlater: (userId, videoId) =>
        api.post("/removefromwatchlater", { user_id: userId, video_id: videoId }),
};