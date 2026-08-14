import api from "./client";

export const historyApi = {
    getHistory: (userId) =>
        api.get("/history", { params: { user_id: userId } }),

    addToHistory: (userId, videoId) =>
        api.post("/addtohistory", { user_id: userId, video_id: videoId }),

    removeFromHistory: (userId, videoId) =>
        api.post("/removefromhistory", { user_id: userId, video_id: videoId }),
};