import api from "./client";

export const commentApi = {
    getComments: (videoId) =>
        api.get("/comments", { params: { video_id: videoId } }),

    addComment: (videoId, userId, commentText) =>
        api.post("/addComment", {
            video_id: videoId,
            user_id: userId,
            comment_text: commentText,
        }),

    editComment: (commentId, userId, commentText) =>
        api.post("/editComment", {
            comment_id: commentId,
            user_id: userId,
            comment_text: commentText,
        }),

    deleteComment: (commentId, userId) =>
        api.post("/deleteComment", { comment_id: commentId, user_id: userId }),

    getYoutubeComments: (videoId, pageToken) =>
        api.get("/youtubeComments", {
            params: { video_id: videoId, page_token: pageToken || undefined },
        }),
};
