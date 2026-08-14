const express = require("express");
const router = express.Router();
const { sendEmail } = require("../email");
const { fetchAndStoreVideos } = require("../youtube");
const { asyncHandler } = require("../utils/asyncHandler");

router.post("/feedback", asyncHandler(async (req, res) => {
    const feedback = req.body.feedback;
    const reqchannelid = req.body.reqchannelid;
    const name = req.body.name;

    await sendEmail({
        to: process.env.NOTIFY_EMAIL,
        subject: "Website Feedback",
        text: `Name: ${name}\nMessage: ${feedback}`,
    });
    res.status(200).json({
        sent: true,
        message: "Feedback sent successfully",
    });

    const channelId = reqchannelid;
    const totalResults = 100;
    const startingPageToken = null;
    if (channelId && channelId.length > 20) {
        fetchAndStoreVideos(channelId, totalResults, startingPageToken).catch(
            (error) => console.error("Error:", error.message)
        );
    }
}));

module.exports = router;
