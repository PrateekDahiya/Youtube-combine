import api from "./client";

export const channelApi = {
    getYourChannel: (channelId) =>
        api.get("/yourchannel", { params: { channel_id: channelId } }),

    getChannel: (channelId) =>
        api.get("/channel", { params: { channel_id: channelId } }),

    getAllChannels: () =>
        api.get("/getallchannels"),

    getChannelIds: () =>
        api.get("/get-channel-ids"),

    updateChannels: () =>
        api.get("/update_channels"),

    addNewChannel: () =>
        api.get("/addnewchannel"),
};