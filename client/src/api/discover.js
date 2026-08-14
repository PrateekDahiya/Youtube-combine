import { videosApi } from "./videos";

export const searchApi = {
    search: (query, page = 1, userId) =>
        videosApi.getVideos({ type: "search", query, page, user_id: userId }),
};

export const categoryApi = {
    getCategory: (category, isShort, page = 1, cursor, userId) =>
        videosApi.getVideos({ type: "category", category, isShort, page, cursor, user_id: userId }),
};

export const trendingApi = {
    getTrendings: (tab = 0, page = 1, userId) =>
        videosApi.getVideos({ type: "trending", tab, page, user_id: userId }),
};