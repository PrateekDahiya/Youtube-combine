const express = require("express");
const router = express.Router();
const { resolveStream } = require("../youtube/streamResolver");
const { asyncHandler } = require("../utils/asyncHandler");
const { successResponse, validationErrorResponse, sendResponse } = require("../utils/responseWrapper");

router.get("/stream/:videoId", asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!videoId) {
        return sendResponse(res, validationErrorResponse("videoId is required"));
    }

    const result = await resolveStream(videoId);
    sendResponse(res, successResponse(result, "Stream resolved"));
}));

module.exports = router;
