import { videosApi } from "./videos";

export const shortsApi = {
    getShorts: (videoId = null, needmore = 0) => {
        const body = { type: "shorts", needmore };
        if (videoId) body.video_id = videoId;
        return videosApi.getVideos(body);
    },
};