import api from "./client";

export const searchApi = {
    search: (query, page = 1) =>
        api.get("/search", { params: { query, page } }),
};

export const categoryApi = {
    getCategory: (category, type, page = 1, cursor) =>
        api.get("/category", { params: { category, type, page, cursor } }),
};

export const trendingApi = {
    getTrendings: (type = 0, page = 1) =>
        api.get("/trendings", { params: { type, page } }),
};