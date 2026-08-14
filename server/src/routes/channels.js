const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { getChannelIds, processChannels, getNewChannelId, addNewChannel } = require("../youtube");
const { syncHandler, asyncHandler } = require("../utils/asyncHandler");

router.get("/api/yourchannel", syncHandler((req, res) => {
    const channel_id = req.query.channel_id;
    const query = `select * from channels where channel_id=?`;

    const connection = getConnection();
    connection.query(query, [channel_id], (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ error: "Database query failed" });
        }
        res.status(200).json({ page: "yourchannel", channel: results });
    });
}));

router.get("/api/channel", syncHandler((req, res) => {
    const channel_id = req.query.channel_id;
    const query = `select * from channels where channel_id=?`;

    const connection = getConnection();
    connection.query(query, [channel_id], (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ error: "Database query failed" });
        }
        res.status(200).json({ page: "channel", channel: results });
    });
}));

router.get("/api/getallchannels", syncHandler((req, res) => {
    const query = `select channel_id from channels`;

    const connection = getConnection();
    connection.query(query, (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json({ data: results });
    });
}));

router.get("/api/get-channel-ids", syncHandler((req, res) => {
    const query = `SELECT channel_id FROM channels`;

    const connection = getConnection();
    connection.query(query, (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json({ channelIds: results });
    });
}));

let offset = 0;
let batchSize = 5;
let totalResults = 5;

router.get("/api/update_channels", asyncHandler(async (req, res) => {
    const channelIds = await getChannelIds(offset, batchSize);
    if (channelIds.length === 0) {
        offset = 0;
    } else {
        await processChannels(channelIds);
        offset += batchSize;
    }

    res.status(200).json({ Channels_updated_successfully: channelIds });
}));

router.get("/api/addnewchannel", asyncHandler(async (req, res) => {
    const channelId = await getNewChannelId();
    const success = await addNewChannel(channelId);
    res.status(200).json({
        success: success,
        Channel_id: channelId,
    });
}));

module.exports = router;