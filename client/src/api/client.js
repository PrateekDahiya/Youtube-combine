import axios from "axios";

const serverurl = process.env.REACT_APP_SERVER_URL;

const api = axios.create({
    baseURL: serverurl,
    headers: {
        "Content-Type": "application/json",
    },
});

function toApiError(error) {
    const data = error.response && error.response.data;
    if (data && data.message) {
        const wrapped = new Error(data.message);
        wrapped.response = error.response;
        wrapped.data = data;
        return wrapped;
    }
    return error;
}

api.interceptors.response.use(
    (response) => {
        const wrapper = response.data;
        if (wrapper && typeof wrapper.success === "boolean") {
            if (wrapper.success) {
                return wrapper.data;
            }
            return Promise.reject(toApiError({ response }));
        }
        return response.data;
    },
    (error) => {
        return Promise.reject(toApiError(error));
    }
);

export default api;
