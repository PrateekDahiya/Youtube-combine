import api from "./client";

export const streamApi = {
    getStream: (videoId) => api.get(`/stream/${videoId}`),
};
