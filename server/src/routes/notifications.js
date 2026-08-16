const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");

router.get("/notifications", (req, res) => {
    const user_id = req.query.user_id;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    if (!user_id) {
        return res.status(400).json({ error: "user_id is required" });
    }

    const sql = `
        SELECT notification_id, video_id, channel_id, type, title, channel_name,
               channel_icon, thumbnail_link, upload_time, is_read, created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `;

    getConnection().query(sql, [user_id, limit, offset], (err, results) => {
        if (err) {
            console.error("Error fetching notifications:", err);
            return res.status(500).json({ error: "Failed to fetch notifications" });
        }
        res.json({ notifications: results });
    });
});

router.get("/notifications/unread-count", (req, res) => {
    const user_id = req.query.user_id;

    if (!user_id) {
        return res.status(400).json({ error: "user_id is required" });
    }

    const sql = `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`;

    getConnection().query(sql, [user_id], (err, results) => {
        if (err) {
            console.error("Error fetching unread count:", err);
            return res.status(500).json({ error: "Failed to fetch unread count" });
        }
        res.json({ count: results[0].count });
    });
});

router.patch("/notifications/:id/read", (req, res) => {
    const notificationId = req.params.id;

    const sql = `UPDATE notifications SET is_read = 1 WHERE notification_id = ?`;

    getConnection().query(sql, [notificationId], (err, result) => {
        if (err) {
            console.error("Error marking notification as read:", err);
            return res.status(500).json({ error: "Failed to mark notification as read" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: "Notification not found" });
        }
        res.json({ success: true });
    });
});

router.patch("/notifications/read-all", (req, res) => {
    const user_id = req.body.user_id;

    if (!user_id) {
        return res.status(400).json({ error: "user_id is required" });
    }

    const sql = `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`;

    getConnection().query(sql, [user_id], (err, result) => {
        if (err) {
            console.error("Error marking all notifications as read:", err);
            return res.status(500).json({ error: "Failed to mark notifications as read" });
        }
        res.json({ success: true, updated: result.affectedRows });
    });
});

module.exports = router;