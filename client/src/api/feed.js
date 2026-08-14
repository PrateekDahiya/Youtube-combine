import api from "./client";
import { videosApi } from "./videos";

export const feedApi = {
    getHome: (page = 1, cursor, userId) =>
        videosApi.getVideos({ type: "home", page, cursor, user_id: userId }),

    getFeedByTag: (tag, page = 1, cursor, userId) =>
        videosApi.getVideos({ type: "tag", tag, page, cursor, user_id: userId }),

    getFeedByType: (category, page = 1, cursor, userId) =>
        videosApi.getVideos({ type: "tag", category, page, cursor, user_id: userId }),

    getHomeTags: (userId) =>
        api.get("/home-tags", { params: { user_id: userId } }),

    getPersonalizedFeed: (userId, page = 1, cursor) =>
        videosApi.getVideos({ type: "personalized", user_id: userId, page, cursor }),
};