import api from "./client";

export const streamApi = {
    getStream: (videoId) => api.get(`/stream/${videoId}`),
    getLocalList: () => api.get(`/local-stream/list`),
    addLocalVideo: (videoId) => api.post(`/local-stream/add`, { video_id: videoId }),
};

export { pickAdaptiveAudio } from "../streamUtils";
