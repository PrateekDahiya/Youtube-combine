require("dns").setDefaultResultOrder("ipv4first");
require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");

const { getConnection } = require("./src/db");
const { uploadsDir } = require("./src/uploads");
const healthRoutes = require("./src/routes/health");
const feedRoutes = require("./src/routes/feed");
const videoRoutes = require("./src/routes/videos");
const watchlaterRoutes = require("./src/routes/watchlater");
const likesRoutes = require("./src/routes/likes");
const historyRoutes = require("./src/routes/history");
const subscriptionRoutes = require("./src/routes/subscriptions");
const authRoutes = require("./src/routes/auth");
const uploadRoutes = require("./src/routes/uploads");
const channelRoutes = require("./src/routes/channels");
const feedbackRoutes = require("./src/routes/feedback");

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.use("/api", healthRoutes);
app.use("/api", feedRoutes);
app.use("/api", videoRoutes);
app.use("/api", watchlaterRoutes);
app.use("/api", likesRoutes);
app.use("/api", historyRoutes);
app.use("/api", subscriptionRoutes);
app.use("/api", authRoutes);
app.use("/api", uploadRoutes);
app.use("/api", channelRoutes);
app.use("/api", feedbackRoutes);

const clientBuildPath = path.join(__dirname, "../client/build");
app.use(express.static(clientBuildPath));
app.use("/uploads", express.static(uploadsDir));
app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
});

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    const status = err.type === "entity.parse.failed" ? 400 : 500;
    console.error("Unhandled route error:", err.message || err);
    res.status(status).json({ error: err.message || "Internal server error" });
});

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use`);
    } else {
        console.error("Server error:", error);
    }
    process.exit(1);
});

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    process.exit(1);
});