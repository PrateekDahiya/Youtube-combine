const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler } = require("../utils/asyncHandler");

router.get("/api/likedvideos", syncHandler((req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT v.*, c.* FROM likedvideos lv JOIN videos v ON lv.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE lv.user_id = ? order by liked_time desc limit 100`;

    const connection = getConnection();
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ error: "Database query failed" });
        }
        res.status(200).json({
            page: "likedvideos",
            videos: results,
        });
    });
}));

router.post("/api/addtoliked", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `INSERT INTO likedvideos (user_id, video_id) VALUES (?, ?)`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        res.status(200).json({
            success: true,
            comment: "Video liked successfully",
        });
    });
}));

router.post("/api/removefromliked", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `DELETE FROM likedvideos WHERE user_id = ? AND video_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: "Like not found" });
        }

        res.status(200).json({
            success: true,
            comment: "Like removed successfully",
        });
    });
}));

router.get("/api/isliked", syncHandler((req, res) => {
    const user_id = req.query.user_id;
    const video_id = req.query.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `SELECT * FROM likedvideos WHERE user_id = ? AND video_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_id, video_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.length > 0) {
            return res.status(200).json({ liked: true });
        } else {
            return res.status(200).json({ liked: false });
        }
    });
}));

module.exports = router;