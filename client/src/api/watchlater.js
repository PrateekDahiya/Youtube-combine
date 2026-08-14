import api from "./client";

export const watchlaterApi = {
    getWatchlater: (userId) =>
        api.get("/watchlater", { params: { user_id: userId } }),

    addToWatchlater: (userId, videoId) =>
        api.post("/addtowatchlater", { user_id: userId, video_id: videoId }),

    removeFromWatchlater: (userId, videoId) =>
        api.post("/removefromwatchlater", { user_id: userId, video_id: videoId }),

    isWatchlater: (userId, videoId) =>
        api.get("/iswatchlater", { params: { user_id: userId, video_id: videoId } }),
};