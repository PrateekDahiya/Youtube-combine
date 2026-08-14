const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler } = require("../utils/asyncHandler");

router.get("/api/history", syncHandler((req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT v.*, c.*,h.watched_time FROM history h JOIN videos v ON h.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE h.user_id = ? ORDER BY h.watched_time DESC LIMIT 100`;

    const connection = getConnection();
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json({ videos: results });
    });
}));

router.post("/api/addtohistory", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `INSERT INTO history (user_id, video_id, watched_time) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE watched_time = CURRENT_TIMESTAMP`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        res.status(200).json({
            success: true,
            comment: "Video added to history successfully",
        });
    });
}));

router.post("/api/removefromhistory", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `DELETE FROM history WHERE user_id = ? AND video_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: "History not found" });
        }

        res.status(200).json({
            success: true,
            comment: "History removed successfully",
        });
    });
}));

module.exports = router;