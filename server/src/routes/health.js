const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { syncHandler } = require("../utils/asyncHandler");

router.get("/keep-active", syncHandler((req, res) => {
    res.json({ message: "Server is active" });
}));

router.get("/health", syncHandler((req, res) => {
    const connection = getConnection();
    connection.query("SELECT 1", (error) => {
        if (error) {
            return res.status(503).json({ status: "error", db: "unreachable" });
        }
        res.status(200).json({ status: "ok", db: "connected" });
    });
}));

module.exports = router;
