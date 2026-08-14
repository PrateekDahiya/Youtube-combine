const express = require("express");
const router = express.Router();
const { getConnection } = require("../db");
const { sendEmail } = require("../email");
const { generateChannelId } = require("../utils");
const { syncHandler, asyncHandler } = require("../utils/asyncHandler");

const userDetailFields = ["username", "email", "DOB"];

router.get("/login", syncHandler((req, res) => {
    const username = req.query.username;
    const email = req.query.email;
    const hashpass = req.query.hashpass;
    const query = `select * from channels c join user u on u.channel_id=c.channel_id where (u.email=? or u.user_id=?) and u.pass=?`;

    const connection = getConnection();
    connection.query(query, [email, username, hashpass], (error, results) => {
        if (error) {
            console.log("Login: " + error);
            return res.status(500).json({ success: false, message: "Login failed" });
        }
        if (!results || results.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, user: results[0] });
    });
}));

router.post("/register", syncHandler((req, res) => {
    const values = {
        fname: req.body.fnamefix,
        lname: req.body.lnamefix,
        username: req.body.username,
        email: req.body.email,
        hashpass: req.body.hashpass,
        DOB: req.body.DOB,
        chl_name: req.body.chl_namefix,
        chl_desc: req.body.chl_descfix,
        channel_id: generateChannelId(req.body.username),
        custom_url: "@" + req.body.username,
        location: req.body.location,
    };
    const channelQuery = `INSERT INTO channels (channel_id, channel_name, short_desc, custom_url, location) VALUES (?, ?, ?, ?, ?)`;

    const connection = getConnection();
    connection.query(
        channelQuery,
        [
            values.channel_id,
            values.chl_name,
            values.chl_desc,
            values.custom_url,
            values.location,
        ],
        (error, results) => {
            if (error) {
                console.log("Error creating channel: ", error);
                return res
                    .status(500)
                    .json({ error: "Failed to create channel" });
            }
            const userQuery = `INSERT INTO user (user_id, username, email, pass, DOB, channel_id) 
                                VALUES (?, ?, ?, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), username = VALUES(user_id),email = VALUES(email),DOB=VALUES(DOB),channel_id=VALUES(channel_id)`;
            connection.query(
                userQuery,
                [
                    values.username,
                    values.fname + " " + values.lname,
                    values.email,
                    values.hashpass,
                    values.DOB,
                    values.channel_id,
                ],
                async (error, results) => {
                    if (error) {
                        console.log("Error registering user: ", error);
                        return res.status(500).json({
                            success: false,
                            message: "Failed to register user",
                        });
                    }
                    sendEmail({
                        to: process.env.NOTIFY_EMAIL,
                        subject: "New User",
                        text: `Name: ${
                            values.fname + " " + values.lname
                        }\nEmail: ${values.email}\nChannel Name: ${
                            values.chl_name
                        }`,
                    }).catch((error) =>
                        console.error("Error sending new-user notification:", error)
                    );
                    return res.status(200).json({
                        success: true,
                        message: "Registration successful",
                    });
                }
            );
        }
    );
}));

router.post("/getUser", syncHandler((req, res) => {
    const user_id = req.body.user_id;
    const query = `select * from user u join channels c on u.channel_id=c.channel_id where user_id= ?`;

    const connection = getConnection();
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            console.log("GetUser: " + error);
            return res.status(500).json({ error: "Database query failed" });
        }
        res.status(200).json({ user: results });
    });
}));

router.post("/updateUserDetail", syncHandler((req, res) => {
    const field = req.body.field;
    const value = req.body.value;
    const user_id = req.body.user_id;
    if (!userDetailFields.includes(field)) {
        return res.status(400).json({ error: "Invalid field" });
    }
    const query = `UPDATE user SET \`${field}\` = ? WHERE user_id = ?`;

    const connection = getConnection();
    connection.query(query, [value, user_id], (error, results) => {
        if (error) {
            console.log("UpdateUserDetail: " + error);
            return res.status(500).json({ error: "Failed to update user" });
        }
        res.status(200).json({ message: "User details updated" });
    });
}));

const channelDetailFields = [
    "channel_name",
    "short_desc",
    "location",
    "total_views",
    "subscribers",
    "channel_icon",
    "channel_banner",
    "keywords",
];

router.post("/updateChannelDetail", syncHandler((req, res) => {
    const field = req.body.field;
    const value = req.body.value;
    const channel_id = req.body.channel_id;
    if (!channelDetailFields.includes(field)) {
        return res.status(400).json({ error: "Invalid field" });
    }
    const query = `UPDATE channels SET \`${field}\` = ? WHERE channel_id = ?`;

    const connection = getConnection();
    connection.query(query, [value, channel_id], (error, results) => {
        if (error) {
            console.log("ChannelUserDetail: " + error);
            return res
                .status(500)
                .json({ error: "Failed to update channel details" });
        }
        res.status(200).json({ message: "User details updated" });
    });
}));

router.post("/deleteUser", syncHandler((req, res) => {
    const channel_id = req.body.channel_id;
    const user_id = req.body.user_id;

    if (!user_id || !channel_id) {
        return res
            .status(400)
            .json({ error: "user_id and channel_id are required" });
    }

    const queries = [
        ["DELETE FROM history WHERE user_id = ?", [user_id]],
        ["DELETE FROM watchlater WHERE user_id = ?", [user_id]],
        ["DELETE FROM likedvideos WHERE user_id = ?", [user_id]],
        ["DELETE FROM subscriptions WHERE user_id = ?", [user_id]],
        ["DELETE FROM comments WHERE user_id = ?", [user_id]],
        ["DELETE FROM user WHERE user_id = ?", [user_id]],
        ["DELETE FROM channels WHERE channel_id = ?", [channel_id]],
    ];

    const connection = getConnection();

    const rollbackAndFail = (err, label) => {
        console.log(`Error ${label}: ` + err);
        connection.rollback(() => {
            res.status(500).json({ error: "Failed to delete user" });
        });
    };

    connection.beginTransaction((err) => {
        if (err) {
            console.log("Error starting transaction: " + err);
            return res.status(500).json({ error: "Failed to delete user" });
        }

        const runQuery = (index) => {
            if (index >= queries.length) {
                return connection.commit((commitErr) => {
                    if (commitErr) {
                        return rollbackAndFail(commitErr, "committing transaction");
                    }
                    console.log("Transaction successfully completed.");
                    res.status(200).json({
                        message: "User and channel deleted successfully.",
                    });
                });
            }
            connection.query(queries[index][0], queries[index][1], (qErr) => {
                if (qErr) {
                    return rollbackAndFail(qErr, "deleting user data");
                }
                runQuery(index + 1);
            });
        };

        runQuery(0);
    });
}));

module.exports = router;
