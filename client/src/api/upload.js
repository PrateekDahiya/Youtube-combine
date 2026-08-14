import api from "./client";

export const uploadApi = {
    uploadImage: (file) => {
        const formData = new FormData();
        formData.append("file", file);
        return api.post("/upload", formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
    },

    uploadVideo: (videoFile, thumbnailFile, metadata, onUploadProgress) => {
        const formData = new FormData();
        formData.append("video", videoFile);
        if (thumbnailFile) formData.append("thumbnail", thumbnailFile);
        Object.entries(metadata).forEach(([key, value]) => {
            formData.append(key, value);
        });
        return api.post("/uploadVideo", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress,
        });
    },

    replaceVideo: (videoId, userId, videoFile, onUploadProgress) => {
        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("video_id", videoId);
        formData.append("user_id", userId);
        return api.post("/replaceVideo", formData, {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress,
        });
    },
};
