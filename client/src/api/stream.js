import api from "./client";

export const streamApi = {
    getStream: (videoId) => api.get(`/stream/${videoId}`),
    getQualityFile: (videoId, quality) => api.get(`/stream/file/${videoId}?quality=${quality}`),
    getLocalList: () => api.get(`/local-stream/list`),
    addLocalVideo: (videoId) => api.post(`/local-stream/add`, { video_id: videoId }),
};

export { pickAdaptiveAudio, isGoogleVideoUrl, proxyStreamUrl } from "../streamUtils";
