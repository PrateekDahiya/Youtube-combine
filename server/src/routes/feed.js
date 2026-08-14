const express = require("express");
const router = express.Router();
const { fetchVideoHistory } = require("../youtube");
const { asyncHandler } = require("../utils/asyncHandler");
const { successResponse, errorResponse, validationErrorResponse, sendResponse } = require("../utils/responseWrapper");
const { cacheFetch } = require("../utils/cache");

router.get("/home-tags", asyncHandler(async (req, res) => {
    const user_id = req.query.user_id;

    if (!user_id) {
        return sendResponse(res, validationErrorResponse("Missing user_id parameter"));
    }

    const cacheKey = `home-tags:${user_id}`;

    cacheFetch(cacheKey, 60, async (done) => {
        try {
            const videoHistory = await fetchVideoHistory(user_id);
            const counts = {};

            videoHistory.forEach((video) => {
                (video.tags || "")
                    .split(",")
                    .map((tag) => tag.toLowerCase().trim())
                    .filter(Boolean)
                    .forEach((tag) => {
                        counts[tag] = (counts[tag] || 0) + 1;
                    });
            });

            const tags = Object.entries(counts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([tag]) => tag);

            done(null, { tags });
        } catch (error) {
            done(error);
        }
    }, (error, data) => {
        if (error) {
            console.log("Error fetching home tags:", error.message);
            return sendResponse(res, errorResponse("Failed to fetch home tags"));
        }
        sendResponse(res, successResponse(data, "Home tags retrieved successfully"));
    });
}));

module.exports = router;