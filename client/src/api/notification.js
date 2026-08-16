import apiClient from "./client";

export const notificationApi = {
    getNotifications: (userId, limit = 20, offset = 0) =>
        apiClient.get("/notifications", { params: { user_id: userId, limit, offset } }),

    getUnreadCount: (userId) =>
        apiClient.get("/notifications/unread-count", { params: { user_id: userId } }),

    markAsRead: (notificationId) =>
        apiClient.patch(`/notifications/${notificationId}/read`),

    markAllAsRead: (userId) =>
        apiClient.patch("/notifications/read-all", { user_id: userId }),
};

export default notificationApi;