import axios from "axios";

const serverurl = process.env.REACT_APP_SERVER_URL;

const api = axios.create({
    baseURL: serverurl,
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error("API Error:", error.message);
        return Promise.reject(error);
    }
);

export default api;