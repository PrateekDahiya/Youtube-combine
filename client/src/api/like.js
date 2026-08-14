import api from "./client";
import { videosApi } from "./videos";

export const likeApi = {
    getLikedVideos: (userId) =>
        videosApi.getVideos({ type: "liked", user_id: userId }),

    addLike: (userId, videoId) =>
        api.post("/addtoliked", { user_id: userId, video_id: videoId }),

    removeLike: (userId, videoId) =>
        api.post("/removefromliked", { user_id: userId, video_id: videoId }),

    isLiked: (userId, videoId) =>
        api.get("/isliked", { params: { user_id: userId, video_id: videoId } }),
};