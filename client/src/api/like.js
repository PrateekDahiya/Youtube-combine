import api from "./client";

export const likeApi = {
    getLikedVideos: (userId) =>
        api.get("/likedvideos", { params: { user_id: userId } }),

    addLike: (userId, videoId) =>
        api.post("/addtoliked", { user_id: userId, video_id: videoId }),

    removeLike: (userId, videoId) =>
        api.post("/removefromliked", { user_id: userId, video_id: videoId }),

    isLiked: (userId, videoId) =>
        api.get("/isliked", { params: { user_id: userId, video_id: videoId } }),
};