const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler } = require("../utils/asyncHandler");

router.get("/api/watchlater", syncHandler((req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT v.*, c.* FROM watchlater lv JOIN videos v ON lv.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE lv.user_id = ? order by added_time desc limit 100`;

    const connection = getConnection();
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ error: "Database query failed" });
        }
        res.status(200).json({
            page: "watchlater",
            videos: results,
        });
    });
}));

router.post("/api/addtowatchlater", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `INSERT INTO watchlater (user_id, video_id,added_time) VALUES (?, ?,CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE added_time = CURRENT_TIMESTAMP`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        res.status(200).json({
            success: true,
            comment: "watchlater added successfully",
        });
    });
}));

router.post("/api/removefromwatchlater", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `DELETE FROM watchlater WHERE user_id = ? AND video_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: "watchlater not found" });
        }

        res.status(200).json({
            success: true,
            comment: "watchlater removed successfully",
        });
    });
}));

router.get("/api/iswatchlater", syncHandler((req, res) => {
    const user_id = req.query.user_id;
    const video_id = req.query.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `SELECT * FROM watchlater WHERE user_id = ? AND video_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.length > 0) {
            return res.status(200).json({ watchlater: true });
        } else {
            return res.status(200).json({ watchlater: false });
        }
    });
}));

module.exports = router;