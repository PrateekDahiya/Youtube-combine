import api from "./client";

export const shortsApi = {
    getShorts: (videoId = null, needmore = 0) => {
        const params = {};
        if (videoId) params.video_id = videoId;
        if (needmore) params.needmore = needmore;
        return api.get("/shorts", { params });
    },
};