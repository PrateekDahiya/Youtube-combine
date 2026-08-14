import api from "./client";

export const uploadApi = {
    uploadImage: (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return api.post("/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    uploadVideo: (videoFile, thumbnailFile, metadata) => {
        const formData = new FormData();
        formData.append("video", videoFile);
        if (thumbnailFile) formData.append("thumbnail", thumbnailFile);
        Object.entries(metadata).forEach(([key, value]) => {
            formData.append(key, value);
        });
        return api.post("/uploadVideo", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },
};