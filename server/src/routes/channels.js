const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { getChannelIdsNeedingUpdate, processChannels, findNewChannelId, addNewChannel } = require("../youtube");
const { syncHandler, asyncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, sendResponse } = require("../utils/responseWrapper");

router.get("/yourchannel", syncHandler((req, res) => {
    const channel_id = req.query.channel_id;
    const query = `select * from channels where channel_id=?`;

    const connection = getConnection();
    connection.query(query, [channel_id], (error, results) => {
        if (error) {
            console.log(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }
        sendResponse(res, successResponse({ page: "yourchannel", channel: results }, "Channel retrieved successfully"));
    });
}));

router.get("/channel", syncHandler((req, res) => {
    const channel_id = req.query.channel_id;
    const query = `select * from channels where channel_id=?`;

    const connection = getConnection();
    connection.query(query, [channel_id], (error, results) => {
        if (error) {
            console.log(error);
            return sendResponse(res, errorResponse("Database query failed"));
        }
        sendResponse(res, successResponse({ page: "channel", channel: results }, "Channel retrieved successfully"));
    });
}));

router.get("/getallchannels", syncHandler((req, res) => {
    const query = `select channel_id from channels`;

    const connection = getConnection();
    connection.query(query, (error, results) => {
        if (error) {
            return sendResponse(res, errorResponse("Database query failed"));
        }
        sendResponse(res, successResponse({ data: results }, "All channels retrieved successfully"));
    });
}));

router.get("/get-channel-ids", syncHandler((req, res) => {
    const query = `SELECT channel_id FROM channels`;

    const connection = getConnection();
    connection.query(query, (error, results) => {
        if (error) {
            return sendResponse(res, errorResponse("Database query failed"));
        }
        sendResponse(res, successResponse({ channelIds: results }, "Channel IDs retrieved successfully"));
    });
}));

let offset = 0;
let batchSize = 5;
let totalResults = 5;

router.get("/update_channels", asyncHandler(async (req, res) => {
    // Only channels whose most recently synced video is >3 days old (or
    // that have no videos yet) are re-processed — skips channels that were
    // already refreshed recently, instead of blindly re-syncing every batch.
    const channelIds = await getChannelIdsNeedingUpdate(offset, batchSize, 3);
    if (channelIds.length === 0) {
        offset = 0;
    } else {
        await processChannels(channelIds);
        offset += batchSize;
    }

    sendResponse(res, successResponse({ Channels_updated_successfully: channelIds }, "Channels updated successfully"));
}));

router.get("/addnewchannel", asyncHandler(async (req, res) => {
    const channelId = await findNewChannelId();
    if (!channelId) {
        return sendResponse(res, successResponse({
            success: "NotFound",
            Channel_id: null,
        }, "No new channel found after multiple attempts"));
    }

    const success = await addNewChannel(channelId);
    sendResponse(res, successResponse({
        success: success,
        Channel_id: channelId,
    }, "New channel added successfully"));
}));

module.exports = router;