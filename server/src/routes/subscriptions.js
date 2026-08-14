const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler } = require("../utils/asyncHandler");

router.post("/addtosubs", syncHandler((req, res) => {
    const user_chl_id = req.body.user_chl_id;
    const channel_id = req.body.channel_id;
    const query = `INSERT INTO subscriptions (user_id,channel_id) VALUES (?, ?)`;

    const connection = getConnection();
    connection.query(query, [user_chl_id, channel_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        res.status(200).json({
            success: true,
            comment: "Subcriber added success",
        });
    });
}));

router.post("/removefromsubs", syncHandler((req, res) => {
    const user_chl_id = req.body.user_chl_id;
    const channel_id = req.body.channel_id;

    if (!user_chl_id || !channel_id) {
        return res
            .status(400)
            .json({ error: "user_chl_id and channel_id are required" });
    }

    const query = `DELETE FROM subscriptions WHERE user_id = ? AND channel_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_chl_id, channel_id], (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Database query failed" });
        }

        if (results.affectedRows === 0) {
            return res.status(404).json({ error: "Subscription not found" });
        }

        res.status(200).json({
            success: true,
            comment: "Subscription removed successfully",
        });
    });
}));

router.get("/issub", syncHandler((req, res) => {
    const user_chl = req.query.user_id;
    const channel_id = req.query.channel_id;

    if (!user_chl || !channel_id) {
        return res
            .status(400)
            .json({ error: "user_id and channel_id are required" });
    }

    const query = `SELECT * FROM subscriptions WHERE user_id = ? AND channel_id = ?`;

    const connection = getConnection();
    connection.query(query, [user_chl, channel_id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: "Database query error" });
        }
        if (results.length > 0) {
            return res.status(200).json({ sub: true });
        } else {
            return res.status(200).json({ sub: false });
        }
    });
}));

router.get("/get-subs", syncHandler((req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT * FROM subscriptions s join channels c where s.channel_id=c.channel_id and s.user_id= ? order by sub_time desc`;

    const connection = getConnection();
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json({ subscription: results });
    });
}));

module.exports = router;
