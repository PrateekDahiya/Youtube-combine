import api from "./client";

export const feedApi = {
    getHome: (page = 1, cursor) =>
        api.get("/home", { params: { page, cursor } }),

    getFeedByTag: (tag, page = 1, cursor) =>
        api.get("/feed-by-tag", { params: { tag, page, cursor } }),

    getFeedByType: (type, page = 1, cursor) =>
        api.get("/feed-by-tag", { params: { type, page, cursor } }),

    getHomeTags: (userId) =>
        api.get("/home-tags", { params: { user_id: userId } }),

    getPersonalizedFeed: (userId, page = 1, cursor) =>
        api.get("/personalized-feed", { params: { user_id: userId, page, cursor } }),
};