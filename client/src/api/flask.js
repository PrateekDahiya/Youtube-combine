import axios from "axios";

const FLASK_URL = "https://flaskapp-5c1j.onrender.com";

const flaskApi = axios.create({
    baseURL: FLASK_URL,
});

flaskApi.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error("Flask API Error:", error.message);
        return Promise.reject(error);
    }
);

export const flaskApiClient = {
    getVideoUrl: (searchParams) =>
        flaskApi.get("/get_video_url", { params: searchParams }),

    getShortUrl: (searchParams) =>
        flaskApi.get("/get-short-url", { params: searchParams }),
};