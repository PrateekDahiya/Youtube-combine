import api from "./client";

export const videosApi = {
    getVideos: (body) => api.post("/videos", body),
};