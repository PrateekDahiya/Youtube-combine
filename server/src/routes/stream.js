const express = require("express");
const router = express.Router();
const axios = require("axios");
const { asyncHandler } = require("../utils/asyncHandler");
const { successResponse, validationErrorResponse, sendResponse } = require("../utils/responseWrapper");

const STREAM_SERVICE_URL = process.env.STREAM_SERVICE_URL;

async function resolveViaExternalService(videoId) {
    const url = `${STREAM_SERVICE_URL.replace(/\/$/, "")}/api/stream/${videoId}`;
    const response = await axios.get(url, { timeout: 120000 });
    return response.data.data;
}

router.get("/stream/:videoId", asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!videoId) {
        return sendResponse(res, validationErrorResponse("videoId is required"));
    }

    let result;
    if (STREAM_SERVICE_URL) {
        try {
            result = await resolveViaExternalService(videoId);
        } catch (error) {
            console.error("External stream service failed:", error.message);
            result = { video_id: videoId, hls_url: null, progressive: [], adaptive: { video: [], audio: [] }, extraction_ok: false };
        }
    } else {
        const { resolveStream } = require("../youtube/streamResolver");
        result = await resolveStream(videoId);
    }

    sendResponse(res, successResponse(result, "Stream resolved"));
}));

module.exports = router;