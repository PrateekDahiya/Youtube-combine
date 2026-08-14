import api from "./client";

export const authApi = {
    login: (username, email, hashpass) =>
        api.get("/login", { params: { username, email, hashpass } }),

    register: (data) =>
        api.post("/register", data),

    getUser: (userId) =>
        api.post("/getUser", { user_id: userId }),

    updateUserDetail: (field, value, userId) =>
        api.post("/updateUserDetail", { field, value, user_id: userId }),

    updateChannelDetail: (field, value, channelId) =>
        api.post("/updateChannelDetail", { field, value, channel_id: channelId }),

    deleteUser: (userId, channelId) =>
        api.post("/deleteUser", { user_id: userId, channel_id: channelId }),

    sendFeedback: (feedback, reqchannelid, name) =>
        api.post("/feedback", { feedback, reqchannelid, name }),
};