import api from "./client";
import { videosApi } from "./videos";

export const historyApi = {
    getHistory: (userId) =>
        videosApi.getVideos({ type: "history", user_id: userId }),

    addToHistory: (userId, videoId) =>
        api.post("/addtohistory", { user_id: userId, video_id: videoId }),

    removeFromHistory: (userId, videoId) =>
        api.post("/removefromhistory", { user_id: userId, video_id: videoId }),
};