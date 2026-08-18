const express = require("express");
const cors = require("cors");
const compression = require("compression");

const { resolveStream } = require("./src/streamResolver");

const app = express();
const port = process.env.PORT || 5001;

app.use(compression());
app.use(cors());
app.use(express.json());

app.get("/api/stream/:videoId", async (req, res) => {
    const { videoId } = req.params;
    if (!videoId) {
        return res.status(400).json({ success: false, message: "videoId is required" });
    }
    try {
        const result = await resolveStream(videoId);
        res.json({ success: true, data: result, message: "Stream resolved" });
    } catch (error) {
        console.error("Error resolving stream:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get("/api/health", (req, res) => {
    res.json({ success: true, message: "OK" });
});

app.listen(port, () => {
    console.log(`Stream service running on port ${port}`);
});

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
});
