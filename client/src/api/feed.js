import api from "./client";

export const feedApi = {
    getHome: (page = 1) =>
        api.get("/home", { params: { page } }),

    getFeedByTag: (tag, page = 1) =>
        api.get("/feed-by-tag", { params: { tag, page } }),

    getFeedByType: (type, page = 1) =>
        api.get("/feed-by-tag", { params: { type, page } }),

    getHomeTags: (userId) =>
        api.get("/home-tags", { params: { user_id: userId } }),

    getPersonalizedFeed: (userId, page = 1) =>
        api.get("/personalized-feed", { params: { user_id: userId, page } }),
};