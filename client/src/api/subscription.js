import api from "./client";

export const subscriptionApi = {
    addSubscription: (userChlId, channelId) =>
        api.post("/addtosubs", { user_chl_id: userChlId, channel_id: channelId }),

    removeSubscription: (userChlId, channelId) =>
        api.post("/removefromsubs", { user_chl_id: userChlId, channel_id: channelId }),

    isSubscribed: (userId, channelId) =>
        api.get("/issub", { params: { user_id: userId, channel_id: channelId } }),

    getSubscriptions: (userId) =>
        api.get("/get-subs", { params: { user_id: userId } }),

    getSubscriptionVideos: (userId, isShort, page = 1) =>
        api.get("/subscriptions", { params: { user_id: userId, isShort, page } }),
};