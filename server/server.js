require("dns").setDefaultResultOrder("ipv4first");
const express = require("express");
const path = require("path");
const app = express();
const mysql = require("mysql2");
require("dotenv").config();
const port = process.env.PORT || 5000;
const axios = require("axios");
const cors = require("cors");
const fs = require("fs");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const API_KEYS = JSON.parse(process.env.API_KEYS);

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

function isCloudinaryConfigured() {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
}

function cloudinaryUpload(filePath, resourceType, folder, onProgress) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: resourceType, folder },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        const total = fs.statSync(filePath).size;
        let sent = 0;
        const reader = fs.createReadStream(filePath);
        reader.on("data", (chunk) => {
            sent += chunk.length;
            if (onProgress && total > 0) {
                onProgress(Math.round((sent / total) * 100));
            }
        });
        reader.on("error", reject);
        reader.pipe(stream);
    });
}

function removeLocalFile(filePath) {
    fs.unlink(filePath, () => {});
}

function cloudinaryErrorMessage(err) {
    if (!err) return "Cloudinary upload failed";
    if (err.message) return err.message;
    return String(err);
}

const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid image type"));
        }
    },
});

const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        cb(
            null,
            "vid-" + Date.now() + "-" + Math.round(Math.random() * 1e9) + path.extname(file.originalname).toLowerCase()
        );
    },
});

const videoUpload = multer({
    storage: videoStorage,
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (/^video\//.test(file.mimetype)) {
            cb(null, true);
        } else if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type"));
        }
    },
});

async function sendEmail({ to, subject, text }) {
    const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            from: process.env.RESEND_FROM_EMAIL,
            to,
            subject,
            text,
        }),
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend API error ${response.status}: ${body}`);
    }
    return response.json();
}

app.use(express.json());
app.use(cors());
var config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT,
};

const connection = mysql.createConnection(config);

connection.connect((err) => {
    if (err) {
        console.error("Database Connection Failed! Error: ", err);
        return;
    }
    console.log("Database Connection Successful!");
});

// Functions
const { v4: uuidv4 } = require("uuid");
const { off } = require("process");

function generateBase64Uuid(extraInput) {
    const uuid = uuidv4();
    const uuidWithoutHyphens = uuid.replace(/-/g, "");
    const buffer = Buffer.from(uuidWithoutHyphens + extraInput, "hex");
    const base64Id = buffer.toString("base64");
    const urlSafeBase64Id = base64Id
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return urlSafeBase64Id;
}

function generateChannelId(userId) {
    const timestamp = Date.now().toString(16);
    const base64Id = generateBase64Uuid(userId + timestamp);
    return `UC${base64Id.substring(0, 22)}`;
}

function generateVideoId(userId) {
    const uuid = uuidv4().replace(/-/g, "").substring(0, 12);
    const extraInput = userId + Date.now().toString(16);
    const buffer = Buffer.from(uuid + extraInput, "hex");
    const base64Id = buffer.toString("base64");
    const urlSafeBase64Id = base64Id
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return urlSafeBase64Id;
}

app.get("/keep-active", (req, res) => {
    res.json({ message: "Server is active" });
});

app.get("/health", (req, res) => {
    connection.query("SELECT 1", (error) => {
        if (error) {
            return res.status(503).json({ status: "error", db: "unreachable" });
        }
        res.status(200).json({ status: "ok", db: "connected" });
    });
});

app.get("/api/home", (req, res) => {
    const page_no = Number(req.query.page || 1);
    const query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where isShort = 0 and v.upload_status = 0 order by upload_time desc limit 24 offset ?`;
    connection.query(query, [24 * (page_no - 1)], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({ page: "home", videos: results });
    });
});

app.get("/api/feed-by-tag", (req, res) => {
    const tag = req.query.tag || "";
    const type = req.query.type || "";
    const page_no = Number(req.query.page || 1);
    const searchQuery = `%${tag}%`;
    const categoryMap = {
        Music: ["Music"],
        Gaming: ["Gaming"],
        Movies: [
            "Film & Animation",
            "Short Movies",
            "Movies",
            "Anime/Animation",
            "Documentary",
            "Drama",
            "Sci-Fi/Fantasy",
            "Shows",
            "Trailers",
            "Thriller",
        ],
        News: ["News & Politics"],
        Sports: ["Sports"],
    };

    const query = type
        ? `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 and v.category in (?) order by upload_time desc limit 24 offset ?`
        : `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 and (v.title like ? or v.tags like ? or v.category like ? or c.channel_name like ?) order by upload_time desc limit 24 offset ?`;

    const queryParams = type
        ? [categoryMap[type] || [type], 24 * (page_no - 1)]
        : [searchQuery, searchQuery, searchQuery, searchQuery, 24 * (page_no - 1)];

    connection.query(
        query,
        queryParams,
        (error, results) => {
            if (error) {
                console.log(error);
                return res.status(500).json({ error: "Database query failed" });
            }
            res.status(200).json({ page: "home_tag", videos: results, tag, type });
        }
    );
});

app.get("/api/home-tags", async (req, res) => {
    const user_id = req.query.user_id;

    if (!user_id) {
        return res.status(400).json({ error: "Missing user_id parameter" });
    }

    try {
        const videoHistory = await fetchVideoHistory(user_id);
        const counts = {};

        videoHistory.forEach((video) => {
            (video.tags || "")
                .split(",")
                .map((tag) => tag.toLowerCase().trim())
                .filter(Boolean)
                .forEach((tag) => {
                    counts[tag] = (counts[tag] || 0) + 1;
                });
        });

        const tags = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([tag]) => tag);

        res.status(200).json({ tags });
    } catch (error) {
        console.error("Error fetching home tags:", error.message);
        res.status(500).json({ error: "Database query failed" });
    }
});

app.get("/api/shorts", (req, res) => {
    const video_id = req.query.video_id;
    const needmore = req.query.needmore || 0; // Default to 0 if needmore is not provided

    let query;
    let queryParams;

    if (video_id) {
        query = `
            (SELECT v1.*, c1.* FROM videos v1 
            INNER JOIN channels c1 ON c1.channel_id = v1.channel_id 
            WHERE v1.video_id = ?)
            UNION ALL
            (SELECT v2.*, c2.* FROM videos v2 
            INNER JOIN channels c2 ON c2.channel_id = v2.channel_id 
            WHERE c2.channel_id = (
                SELECT v3.channel_id FROM videos v3 
                WHERE v3.video_id = ?
            ) AND v2.video_id != ? AND v2.upload_status = 0
            ORDER BY v2.upload_time
            LIMIT 5 OFFSET ?)
        `;
        queryParams = [video_id, video_id, video_id, 5 * needmore];
    } else {
        query = `
            SELECT v.*, c.* FROM videos v 
            INNER JOIN channels c ON c.channel_id = v.channel_id 
            WHERE v.isShort = 1 AND v.upload_status = 0 
            ORDER BY RAND() DESC 
            LIMIT 5 OFFSET ?
        `;
        queryParams = [5 * needmore];
    }

    connection.query(query, queryParams, (error, results) => {
        if (error) {
            console.error(error);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.status(200).json({ page: "shorts", shorts_vIds: results });
    });
});

app.get("/api/yourchannel", (req, res) => {
    const channel_id = req.query.channel_id;
    const query = `select * from channels where channel_id=?`;
    connection.query(query, [channel_id], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({ page: "yourchannel", channel: results });
    });
});

app.get("/api/subscriptions", (req, res) => {
    const user_id = req.query.user_id;
    const isShort = req.query.isShort;
    const page_no = Number(req.query.page || 1);
    const query = `select * from videos v inner join channels c on v.channel_id=c.channel_id where v.channel_id in (select s.channel_id from subscriptions s where s.user_id=?) and v.isShort=? and v.upload_status = 0 order by v.upload_time desc limit 24 offset ?`;

    connection.query(query, [user_id, isShort, 24 * (page_no - 1)], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({ page: "subscription", data: results });
    });
});

app.get("/api/watch", (req, res) => {
    const videoId = req.query.video_id;
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.video_id= ?`;

    connection.query(query, [videoId], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json({ page: "watch", data: results });
    });
});

app.get("/api/channel", (req, res) => {
    const channel_id = req.query.channel_id;
    const query = `select * from channels where channel_id=?`;

    connection.query(query, [channel_id], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({ page: "channel", channel: results });
    });
});

app.get("/api/category", (req, res) => {
    const category = req.query.category;
    const type = req.query.type;
    const page_no = Number(req.query.page || 1);
    const caticon = {
        gaming: "https://yt3.googleusercontent.com/pzvUHajbQDLDt63gKFYUX445k3VprUs8CeJFpNTxGQZlk0grOSkAqU8Th1_C97dyYM3nENgjbw=s120-c-k-c0x00ffffff-no-rj",
        music: "https://yt3.googleusercontent.com/vCqmJ7cdUYpvR0bqLpWIe8ktaor4QafQLlfQyTuZy-M9W_YafT8Wo9kdsKL2St1BrkMRpVSJgA=s176-c-k-c0x00ffffff-no-rj-mo",
        movies: "https://www.gstatic.com/youtube/img/tvfilm/clapperboard_profile.png",
        news: "https://cdn-icons-png.flaticon.com/128/2964/2964063.png",
        sports: "https://yt3.googleusercontent.com/mUhuJiCiL8jf0Ngf9sh7BFBZCO0MUL2JyH_5ElHbV2fd13hxZ9zQ3-x-YePA_-PCUUH360G0=s176-c-k-c0x00ffffff-no-rj-mo",
        courses:
            "https://yt3.googleusercontent.com/WqGyfnVyCluIyyFDPdrHzqEfKQcTbtwhIJJ4Q_F3QGMqnYNs8aKswvDhzpY1q8vhS5g8Expi=s176-c-k-c0x00ffffff-no-rj-mo",
        fashionbeauty:
            "https://cdn-icons-png.flaticon.com/128/3211/3211391.png",
        shopping: "https://cdn-icons-png.flaticon.com/128/3081/3081559.png",
    };
    const categoryMapping = {
        gaming: ["Gaming"],
        music: ["Music"],
        movies: [
            "Film & Animation",
            "Short Movies",
            "Movies",
            "Anime/Animation",
            "Documentary",
            "Drama",
            "Sci-Fi/Fantasy",
            "Shows",
            "Trailers",
            "Thriller",
        ],
        news: ["News & Politics"],
        sports: ["Sports"],
        courses: [
            "Howto & Style",
            "Science & Technology",
            "Documentary",
            "Videoblogging",
        ],
        fashionbeauty: ["Pets & Animals", "Travel & Events"],
        shopping: ["Autos & Vehicles"],
    };
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.category in (?) and v.isShort = ? and v.upload_status = 0 order by v.upload_time desc limit 24 offset ?`;
    connection.query(
        query,
        [categoryMapping[category], type, 24 * (page_no - 1)],
        (error, results) => {
            if (error) {
                console.log(error);
            }
            res.status(200).json({
                page: "category",
                caticon: caticon[category],
                videos: results,
                category: category,
            });
        }
    );
});
function sanitizeTag(tag) {
    return tag.replace(/'/g, "''"); // Escape single quotes
}

function createFeedAndGenerateSQL(
    tags,
    excludedVideoIds = [],
    maxVideosPerChannel = 5,
    limit = 24, // Specify the limit of videos to retrieve
    offset = null
) {
    const wordCount = {};

    // Split tags into words, sanitize, and count occurrences
    tags.forEach((tag) => {
        const sanitizedTag = sanitizeTag(tag); // Sanitize the entire tag
        const words = sanitizedTag.split(/[\s,]+/);
        words.forEach((word) => {
            const cleanedWord = word.toLowerCase().trim();
            if (cleanedWord) {
                wordCount[cleanedWord] = (wordCount[cleanedWord] || 0) + 1;
            }
        });
    });

    // Get words with multiple occurrences
    const multipleOccurrences = Object.entries(wordCount)
        .filter(([word, count]) => count > 1)
        .sort((a, b) => b[1] - a[1]) // Sort by count in descending order
        .map(([word]) => word); // Only extract the word

    // Generate score calculations based on the top 50 words
    let scoreCalculations =
        multipleOccurrences.length > 0
            ? multipleOccurrences
                  .map(
                      (word) =>
                          `IF(LOCATE('${sanitizeTag(word)}', v.tags), 1, 0)`
                  )
                  .join(" + ")
            : "0";

    // Filter out undefined or empty video IDs
    const filteredExcludedIds = excludedVideoIds
        .filter((id) => id && id !== "undefined")
        .map((id) => `'${sanitizeTag(id)}'`); // Sanitize excluded video IDs

    // Generate the SQL query
    let sqlQuery = "";
    if (filteredExcludedIds.length === 0) {
        sqlQuery = `
            SELECT 
                v.*, c.*, (${scoreCalculations}) AS score
            FROM (
                SELECT v.*, ROW_NUMBER() OVER(PARTITION BY v.channel_id ORDER BY v.video_id) AS channel_row_number
                FROM videos v
                WHERE v.isShort = 0
                AND v.upload_status = 0
            ) AS v
            JOIN channels c ON v.channel_id = c.channel_id
            WHERE v.channel_row_number <= ${maxVideosPerChannel}
            ORDER BY score DESC
            LIMIT ${limit}${offset !== null ? ` OFFSET ${offset}` : ""}
        `;
    } else {
        const excludearray = filteredExcludedIds.join(", ");
        sqlQuery = `
            SELECT 
                v.*, c.*, (${scoreCalculations}) AS score
            FROM (
                SELECT v.*, ROW_NUMBER() OVER(PARTITION BY v.channel_id ORDER BY v.video_id) AS channel_row_number
                FROM videos v
                WHERE v.video_id NOT IN (${excludearray}) 
                AND v.isShort = 0
                AND v.upload_status = 0
            ) AS v
            JOIN channels c ON v.channel_id = c.channel_id
            WHERE v.channel_row_number <= ${maxVideosPerChannel}
            ORDER BY score DESC
            LIMIT ${limit}${offset !== null ? ` OFFSET ${offset}` : ""}
        `;
    }

    return sqlQuery;
}

function fetchRelatedVideos(video_id, res) {
    const fetchTagsQuery = `SELECT tags FROM videos WHERE video_id = ?`;
    connection.query(fetchTagsQuery, [video_id], (error, results) => {
        if (error) {
            console.log(error, fetchTagsQuery);
            res.status(500).json({ error: "Database error" });
            return;
        }

        if (results.length === 0) {
            res.status(404).json({ error: "Video not found" });
            return;
        }

        // Split and trim the tags, and ensure they are valid
        const tags = results[0].tags
            .split(",")
            .map((tag) => tag.trim())
            .filter((tag) => tag); // Remove any empty tags

        // Check if we have tags
        if (tags.length === 0) {
            res.status(400).json({ error: "No tags available for this video" });
            return;
        }

        // Generate SQL query
        const sqlQuery = createFeedAndGenerateSQL(tags, [], 5, 20);

        connection.query(sqlQuery, (error, relatedVideos) => {
            if (error) {
                console.log(error);
                console.log("Generated SQL Query:", sqlQuery); // Log for debugging
                res.status(500).json({ error: "Database error" });
                return;
            }

            res.status(200).json({
                page: "related_videos",
                videos: relatedVideos,
            });
        });
    });
}

app.get("/api/related-videos", (req, res) => {
    const video_id = req.query.video_id;

    if (!video_id) {
        res.status(400).json({ error: "Missing video_id parameter" });
        return;
    }
    fetchRelatedVideos(video_id, res);
});

async function fetchVideoHistory(user_chl_id) {
    return new Promise((resolve, reject) => {
        const query = `SELECT v.tags
                        FROM history h 
                        JOIN videos v ON h.video_id = v.video_id 
                        WHERE h.user_id = ? 
                        ORDER BY h.watched_time DESC 
                        LIMIT 100`;

        connection.query(query, [user_chl_id], (error, results) => {
            if (error) {
                console.log("Error fetching video history:", error.message);
                return reject(error);
            }
            resolve(results || []);
        });
    });
}

app.get("/api/personalized-feed", async (req, res) => {
    const user_chl_id = req.query.user_id;
    const page_no = req.query.page || 1;

    if (!user_chl_id) {
        return res.status(400).json({ error: "Missing user_id parameter" });
    }

    try {
        const videoHistory = await fetchVideoHistory(user_chl_id);

        const excludedVideoIds = videoHistory.map((video) => video.video_id);

        const tags = videoHistory
            .map((video) => video.tags)
            .join(",")
            .split(",")
            .map((tag) => tag.trim());

        const sqlQuery = createFeedAndGenerateSQL(
            tags,
            excludedVideoIds,
            5,
            24,
            24 * (page_no - 1)
        );

        connection.query(sqlQuery, (error, feed) => {
            if (error) {
                console.log("Error fetching related videos:", error.message);
                console.log("Generated SQL Query:", sqlQuery);
                res.status(500).json({ error: "Database error" });
                return;
            }

            res.status(200).json({
                page: "personalized_feed",
                videos: feed,
            });
        });
    } catch (error) {
        console.log("Error in fetching data:", error.message);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/api/trendings", (req, res) => {
    const type = req.query.type;
    const page_no = Number(req.query.page || 1);
    const categoryMapping = {
        1: ["Music"],
        2: ["Gaming"],
        3: [
            "Film & Animation",
            "Short Movies",
            "Movies",
            "Anime/Animation",
            "Documentary",
            "Drama",
            "Sci-Fi/Fantasy",
            "Shows",
            "Trailers",
            "Thriller",
        ],
    };

    let query = `SELECT *, ((LOG(v.views + 1) * 0.3) + (v.likes * 0.3) + ((1 / (DATEDIFF(NOW(), v.upload_time) + 1)) * 0.4)) AS trending_score
                 FROM videos v
                 JOIN channels c ON v.channel_id = c.channel_id
                 WHERE v.upload_time >= NOW() - INTERVAL 10 DAY AND isShort = 0 AND v.upload_status = 0`;

    if (type != 0) {
        query += " AND v.category IN (?)";
    }

    query += " ORDER BY trending_score DESC LIMIT 24 OFFSET ?";

    const queryParams = type != 0 ? [categoryMapping[type], 24 * (page_no - 1)] : [24 * (page_no - 1)];

    connection.query(query, queryParams, (error, results) => {
        if (error) {
            console.log(error);
            return res.status(500).json({ error: "Internal Server Error" });
        }
        res.status(200).json({ page: "trendings", videos: results });
    });
});

app.get("/api/search", (req, res) => {
    const query = req.query.query;
    const searchQuery = `%${query}%`;
    const page_no = Number(req.query.page || 1);
    const videoQuery = `select * from channels c join videos v on c.channel_id=v.channel_id where v.upload_status = 0 and (v.title like ? or v.tags like ? or c.channel_name like ?) order by v.upload_time desc limit 24 offset ?`;
    const channelQuery = `select * from channels where channel_name like ? or short_desc like ? or custom_url like ? or keywords like ? order by subscribers desc limit 20`;

    connection.query(
        videoQuery,
        [searchQuery, searchQuery, searchQuery, 24 * (page_no - 1)],
        (videoError, videoResults) => {
            if (videoError) {
                console.log(videoError);
                return res.status(500).json({ error: "Internal Server Error" });
            }

            connection.query(
                channelQuery,
                [searchQuery, searchQuery, searchQuery, searchQuery],
                (channelError, channelResults) => {
                    if (channelError) {
                        console.log(channelError);
                        return res
                            .status(500)
                            .json({ error: "Internal Server Error" });
                    }

                    res.status(200).json({
                        page: "search",
                        videos: videoResults,
                        channels: channelResults,
                        query: query,
                    });
                }
            );
        }
    );
});

app.get("/api/likedvideos", (req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT v.*, c.* FROM likedvideos lv JOIN videos v ON lv.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE lv.user_id = ? order by liked_time desc limit 100`;
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({
            page: "likedvideos",
            videos: results,
        });
    });
});

app.get("/api/watchlater", (req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT v.*, c.* FROM watchlater lv JOIN videos v ON lv.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE lv.user_id = ? order by added_time desc limit 100`;
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            console.log(error);
        }
        res.status(200).json({
            page: "watchlater",
            videos: results,
        });
    });
});

app.get("/api/login", async (req, res) => {
    const username = req.query.username;
    const email = req.query.email;
    const hashpass = req.query.hashpass;
    const query = `select * from channels c join user u on u.channel_id=c.channel_id where (u.email=? or u.user_id=?) and u.pass=?`;
    connection.query(query, [email, username, hashpass], (error, results) => {
        if (error) {
            console.log("User Not Found: " + error);
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.status(200).json({ success: true, user: results[0] });
    });
});

app.post("/api/register", (req, res) => {
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
});

app.get("/api/getvideobyid", (req, res) => {
    const video_id = req.query.video_id;
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.video_id= ?`;
    connection.query(query, [video_id], (error, results) => {
        if (error) {
            console.log("Getvideobyid: " + error);
        }
        res.status(200).json({ video: results });
    });
});

app.post("/api/upload", (req, res) => {
    upload.single("file")(req, res, async (err) => {
        if (err) {
            return res
                .status(400)
                .json({ error: err.message || "Upload failed" });
        }
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        if (!isCloudinaryConfigured()) {
            return res.status(200).json({ url: `/uploads/${req.file.filename}` });
        }
        try {
            const url = await cloudinaryUpload(req.file.path, "image", "vidvault/photos");
            removeLocalFile(req.file.path);
            res.status(200).json({ url });
        } catch (uploadErr) {
            console.log("Cloudinary image upload: " + JSON.stringify(uploadErr));
            removeLocalFile(req.file.path);
            res.status(500).json({ error: cloudinaryErrorMessage(uploadErr) });
        }
    });
});

function processVideoUpload(video_id, user_id, videoFile, thumbFile) {
    const update = (fields) => {
        const sets = [];
        const params = [];
        Object.entries(fields).forEach(([col, val]) => {
            sets.push(`${col} = ?`);
            params.push(val);
        });
        params.push(video_id);
        connection.query(
            `UPDATE videos SET ${sets.join(", ")} WHERE video_id = ?`,
            params,
            (error) => {
                if (error) console.log("UploadVideo status update: " + error);
            }
        );
    };

    let lastPersist = 0;
    const persistProgress = (p) => {
        const now = Date.now();
        if (now - lastPersist < 500) return;
        lastPersist = now;
        update({ upload_progress: p });
    };

    const complete = (link, thumbnail_link) => {
        removeLocalFile(videoFile.path);
        if (thumbFile) removeLocalFile(thumbFile.path);
        let finalThumbnail = thumbnail_link;
        if (!finalThumbnail && link.includes("cloudinary.com")) {
            finalThumbnail = link.replace(/\.[a-zA-Z0-9]+$/, ".jpg");
        }
        update({
            link,
            thumbnail_link: finalThumbnail,
            upload_status: 0,
            upload_progress: 100,
            upload_error: "",
        });
        connection.query(
            `UPDATE channels SET video_count = video_count + 1 WHERE channel_id = ?`,
            [user_id],
            (updateErr) => {
                if (updateErr) {
                    console.log("UploadVideo count update: " + updateErr);
                }
            }
        );
    };

    const fail = (err) => {
        console.log("Cloudinary background upload: " + err);
        removeLocalFile(videoFile.path);
        if (thumbFile) removeLocalFile(thumbFile.path);
        update({ upload_status: 2, upload_error: cloudinaryErrorMessage(err) });
    };

    cloudinaryUpload(videoFile.path, "video", "vidvault/videos", persistProgress)
        .then((link) => {
            if (thumbFile) {
                update({ upload_progress: 50 });
                return cloudinaryUpload(
                    thumbFile.path,
                    "image",
                    "vidvault/thumbnails"
                ).then((thumbnail_link) => complete(link, thumbnail_link));
            }
            complete(link, "");
        })
        .catch(fail);
}

app.post("/api/uploadVideo", (req, res) => {
    videoUpload.fields([
        { name: "video", maxCount: 1 },
        { name: "thumbnail", maxCount: 1 },
    ])(req, res, (err) => {
        if (err) {
            return res
                .status(400)
                .json({ error: err.message || "Upload failed" });
        }
        if (!req.files || !req.files.video) {
            return res.status(400).json({ error: "No video file uploaded" });
        }
        const videoFile = req.files.video[0];
        const thumbFile =
            req.files.thumbnail && req.files.thumbnail[0]
                ? req.files.thumbnail[0]
                : null;

        const title = (req.body.title || "").trim() || "Untitled";
        const description = req.body.description || "";
        const tags = req.body.tags || "";
        const category = req.body.category || "";
        const type = req.body.type;
        const user_id = req.body.user_id;
        const duration = parseInt(req.body.duration || 0, 10);
        const isShort = type === "short" ? 1 : 0;
        const video_id = generateVideoId(user_id || "upload");

        const insertQuery = `INSERT INTO videos (video_id, title, views, likes, dislikes, link, upload_time, channel_id, thumbnail_link, video_description, duration, tags, category, isShort, upload_status, upload_progress)
                             VALUES (?, ?, 0, 0, 0, '', NOW(), ?, ?, ?, ?, ?, ?, ?, 1, 0)`;
        const params = [
            video_id,
            title,
            user_id,
            "",
            description,
            duration,
            tags,
            category,
            isShort,
        ];

        connection.query(insertQuery, params, (error) => {
            if (error) {
                console.log("UploadVideo insert: " + error);
                return res
                    .status(500)
                    .json({ error: "Failed to save video details" });
            }
            if (isCloudinaryConfigured()) {
                res.status(200).json({
                    message: "Video upload started",
                    video_id,
                    upload_status: 1,
                });
                setTimeout(
                    () =>
                        processVideoUpload(
                            video_id,
                            user_id,
                            videoFile,
                            thumbFile
                        ),
                    0
                );
            } else {
                const link = `/uploads/${videoFile.filename}`;
                const thumbnail_link = thumbFile
                    ? `/uploads/${thumbFile.filename}`
                    : "";
                connection.query(
                    `UPDATE videos SET link = ?, thumbnail_link = ?, upload_status = 0, upload_progress = 100 WHERE video_id = ?`,
                    [link, thumbnail_link, video_id],
                    (updateErr) => {
                        if (updateErr) {
                            console.log(
                                "UploadVideo local link update: " + updateErr
                            );
                        }
                        connection.query(
                            `UPDATE channels SET video_count = video_count + 1 WHERE channel_id = ?`,
                            [user_id],
                            (countErr) => {
                                if (countErr) {
                                    console.log(
                                        "UploadVideo count update: " + countErr
                                    );
                                }
                                res.status(200).json({
                                    message: "Video uploaded successfully",
                                    video_id,
                                    upload_status: 0,
                                });
                            }
                        );
                    }
                );
            }
        });
    });
});

app.get("/api/uploadStatus", (req, res) => {
    const video_id = req.query.video_id;
    const query = `SELECT video_id, upload_status, upload_progress, link, upload_error FROM videos WHERE video_id = ?`;
    connection.query(query, [video_id], (error, results) => {
        if (error) {
            console.log("UploadStatus: " + error);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.status(200).json({ upload: results[0] || null });
    });
});

app.get("/api/uploadingVideos", (req, res) => {
    const channel_id = req.query.channel_id;
    const query = `SELECT video_id, title, upload_status, upload_progress, upload_error, thumbnail_link, link, video_description, tags, category, isShort FROM videos WHERE channel_id = ? AND (upload_status != 0 OR link LIKE 'https://res.cloudinary.com/%' OR link LIKE '/uploads/%') ORDER BY upload_time DESC LIMIT 100`;
    connection.query(query, [channel_id], (error, results) => {
        if (error) {
            console.log("UploadingVideos: " + error);
            return res.status(500).json({ error: "Internal server error" });
        }
        res.status(200).json({ uploads: results });
    });
});

app.post("/api/updateVideo", (req, res) => {
    const video_id = req.body.video_id;
    const user_id = req.body.user_id;
    const title = (req.body.title || "").trim() || "Untitled";
    const description = req.body.description || "";
    const tags = req.body.tags || "";
    const category = req.body.category || "";
    const isShort = req.body.isShort == "short" ? 1 : req.body.isShort == "video" ? 0 : Number(req.body.isShort || 0);
    const thumbnail_link = req.body.thumbnail_link || "";

    const query = `UPDATE videos SET title = ?, video_description = ?, tags = ?, category = ?, isShort = ?, thumbnail_link = ? WHERE video_id = ? AND channel_id = ?`;
    connection.query(
        query,
        [title, description, tags, category, isShort, thumbnail_link, video_id, user_id],
        (error, results) => {
            if (error) {
                console.log("UpdateVideo: " + error);
                return res.status(500).json({ error: "Failed to update video" });
            }
            if (results.affectedRows === 0) {
                return res.status(403).json({ error: "Video not found or not authorized" });
            }
            res.status(200).json({ message: "Video updated" });
        }
    );
});

app.post("/api/updateUserDetail", (req, res) => {
    const field = req.body.field;
    const value = req.body.value;
    const user_id = req.body.user_id;
    const query = `UPDATE user SET \`${field}\` = ? WHERE user_id = ?`;
    connection.query(query, [value, user_id], (error, results) => {
        if (error) {
            console.log("UpdateUserDetail: " + error);
        }
        res.status(200).json({ message: "User details updated" });
    });
});

app.post("/api/updateChannelDetail", (req, res) => {
    const field = req.body.field;
    const value = req.body.value;
    const channel_id = req.body.channel_id;
    const query = `UPDATE channels SET \`${field}\` = ? WHERE channel_id = ?`;
    connection.query(query, [value, channel_id], (error, results) => {
        if (error) {
            console.log("ChannelUserDetail: " + error);
        }
        res.status(200).json({ message: "User details updated" });
    });
});

app.post("/api/getUser", (req, res) => {
    const user_id = req.body.user_id;
    const query = `select * from user u join channels c on u.channel_id=c.channel_id where user_id= ?`;
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            console.log("GetUser: " + error);
        }
        res.status(200).json({ user: results });
    });
});

app.post("/api/deleteUser", (req, res) => {
    const channel_id = req.body.channel_id;
    const user_id = req.body.user_id;

    // Define queries to delete user-related data first
    const deleteHistoryQuery = "DELETE FROM history WHERE user_id = ?";
    const deleteWatchLaterQuery = "DELETE FROM watchlater WHERE user_id = ?";
    const deleteLikedVideosQuery = "DELETE FROM likedvideos WHERE user_id = ?";
    const deleteSubscriptionsQuery =
        "DELETE FROM subscriptions WHERE user_id = ?";
    const deleteCommentsQuery = "DELETE FROM comments WHERE user_id = ?";
    const deleteUserQuery = "DELETE FROM user WHERE user_id = ?";

    // Start a transaction
    connection.beginTransaction(function (err) {
        if (err) {
            console.log("Error starting transaction: " + err);
            throw err;
        }

        // Execute each query in sequence
        connection.query(
            deleteHistoryQuery,
            [user_id],
            function (err, results) {
                if (err) {
                    connection.rollback(function () {
                        console.log("Error deleting history: " + err);
                        throw err;
                    });
                }

                connection.query(
                    deleteWatchLaterQuery,
                    [user_id],
                    function (err, results) {
                        if (err) {
                            connection.rollback(function () {
                                console.log(
                                    "Error deleting watch later: " + err
                                );
                                throw err;
                            });
                        }

                        connection.query(
                            deleteLikedVideosQuery,
                            [user_id],
                            function (err, results) {
                                if (err) {
                                    connection.rollback(function () {
                                        console.log(
                                            "Error deleting liked videos: " +
                                                err
                                        );
                                        throw err;
                                    });
                                }

                                connection.query(
                                    deleteSubscriptionsQuery,
                                    [user_id],
                                    function (err, results) {
                                        if (err) {
                                            connection.rollback(function () {
                                                console.log(
                                                    "Error deleting subscriptions: " +
                                                        err
                                                );
                                                throw err;
                                            });
                                        }

                                        connection.query(
                                            deleteCommentsQuery,
                                            [user_id],
                                            function (err, results) {
                                                if (err) {
                                                    connection.rollback(
                                                        function () {
                                                            console.log(
                                                                "Error deleting comments: " +
                                                                    err
                                                            );
                                                            throw err;
                                                        }
                                                    );
                                                }

                                                connection.query(
                                                    deleteUserQuery,
                                                    [user_id],
                                                    function (err, results) {
                                                        if (err) {
                                                            connection.rollback(
                                                                function () {
                                                                    console.log(
                                                                        "Error deleting user: " +
                                                                            err
                                                                    );
                                                                    throw err;
                                                                }
                                                            );
                                                        }

                                                        // If user is successfully deleted, proceed to delete the channel
                                                        const deleteChannelQuery =
                                                            "DELETE FROM channels WHERE channel_id = ?";
                                                        connection.query(
                                                            deleteChannelQuery,
                                                            [channel_id],
                                                            function (
                                                                err,
                                                                results
                                                            ) {
                                                                if (err) {
                                                                    connection.rollback(
                                                                        function () {
                                                                            console.log(
                                                                                "Error deleting channel: " +
                                                                                    err
                                                                            );
                                                                            throw err;
                                                                        }
                                                                    );
                                                                }

                                                                // Commit the transaction if all queries were successful
                                                                connection.commit(
                                                                    function (
                                                                        err
                                                                    ) {
                                                                        if (
                                                                            err
                                                                        ) {
                                                                            connection.rollback(
                                                                                function () {
                                                                                    console.log(
                                                                                        "Error committing transaction: " +
                                                                                            err
                                                                                    );
                                                                                    throw err;
                                                                                }
                                                                            );
                                                                        }
                                                                        console.log(
                                                                            "Transaction successfully completed."
                                                                        );
                                                                        res.status(
                                                                            200
                                                                        ).json({
                                                                            message:
                                                                                "User and channel deleted successfully.",
                                                                        });
                                                                    }
                                                                );
                                                            }
                                                        );
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            }
        );
    });
});

app.get("/api/getvideosofchannel", (req, res) => {
    const channel_id = req.query.channel_id;
    const searchTerm = req.query.query || ""; // default to empty string if query is not provided
    const type = req.query.type;
    const page_no = Number(req.query.page || 1);
    const formattedSearchTerm = `%${searchTerm}%`; // Add wildcards

    let params;
    let query;
    if (searchTerm === "") {
        query = `SELECT * FROM videos v 
                 JOIN channels c ON v.channel_id = c.channel_id 
                 WHERE v.channel_id = ? AND v.isShort = ? AND v.upload_status = 0 
                 ORDER BY upload_time DESC 
                 LIMIT 24 OFFSET ?`;
        params = [channel_id, type, 24 * (page_no - 1)];

        connection.query(query, params, (error, results) => {
            if (error) {
                console.error(error);
                return res.status(500).json({ error: "Database query failed" });
            }
            res.status(200).json({ videos: results });
        });
    } else {
        query = `SELECT * FROM videos v 
                 JOIN channels c ON v.channel_id = c.channel_id 
                 WHERE v.channel_id = ? AND v.isShort = ? AND v.upload_status = 0 
                 AND (v.title LIKE ?) 
                 ORDER BY upload_time DESC 
                 LIMIT 24 OFFSET ?`;
        params = [channel_id, type, formattedSearchTerm, 24 * (page_no - 1)];

        connection.query(
            query,
            params,
            (error, results) => {
                if (error) {
                    console.error(error);
                    return res
                        .status(500)
                        .json({ error: "Database query failed" });
                }

                res.status(200).json({ videos: results });
            }
        );
    }
});

// Subscriptions
app.post("/api/addtosubs", (req, res) => {
    const user_chl_id = req.body.user_chl_id;
    const channel_id = req.body.channel_id;
    const query = `INSERT INTO subscriptions (user_id,channel_id) VALUES (?, ?)`;

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
});

let offset = 0;
let batchSize = 5;
let totalResults = 5;

app.get("/api/update_channels", async (req, res) => {
    try {
        const channelIds = await getChannelIds(offset, batchSize);
        if (channelIds.length === 0) {
            offset = 0;
        } else {
            await processChannels(channelIds);
            offset += batchSize;
        }

        res.status(200).json({ Channels_updated_successfully: channelIds });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("Error updating channels.");
    }
});

function getChannelIds(offset, limit) {
    return new Promise((resolve, reject) => {
        const query = `SELECT channel_id FROM channels LIMIT ? OFFSET ?`;
        connection.query(query, [limit, offset], (error, results) => {
            if (error) {
                return reject(error);
            }
            const channelIds = results.map((row) => row.channel_id);
            resolve(channelIds);
        });
    });
}

async function processChannels(channelIds) {
    const startingPageToken = null;

    const fetchPromises = channelIds.map((channelId) => {
        return fetchAndStoreVideos(channelId, totalResults, startingPageToken);
    });
    await Promise.all(fetchPromises);
}

app.get("/api/addnewchannel", async (req, res) => {
    try {
        const channelId = await getNewChannelId();
        const success = await addNewChannel(channelId);
        res.status(200).json({
            success: success,
            Channel_id: channelId,
        });
    } catch (error) {
        console.error("Error:", error.message);
        res.status(500).send("Error adding channel.");
    }
});

const categories = [
    "1", // Film & Animation
    "2", // Autos & Vehicles
    "10", // Music
    "15", // Pets & Animals
    "17", // Sports
    "20", // Gaming
    "22", // People & Blogs
    "23", // Comedy
    "24", // Entertainment
    "25", // News & Politics
    "26", // Howto & Style
    "27", // Education
    "28", // Science & Technology
    "29", // Nonprofits & Activism
];

const getRandomCategory = () => {
    const randomIndex = Math.floor(Math.random() * categories.length);
    return categories[randomIndex];
};

const getNewChannelId = async () => {
    const apiKey = API_KEYS[currentApiKeyIndex];
    const category = getRandomCategory();
    const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&chart=mostPopular&regionCode=US&videoCategoryId=${category}&maxResults=1&key=${apiKey}`
    );
    const data = await response.json();

    if (data.items.length > 0) {
        return data.items[0].snippet.channelId;
    } else {
        console.error("No popular videos found.");
        return null;
    }
};

const addNewChannel = async (channelId) => {
    const totalResults = 50;
    const startingPageToken = null;
    if (channelId.length > 20) {
        fetchAndStoreVideos(channelId, totalResults, startingPageToken).catch(
            (error) => {
                return "False";
            }
        );
    }
    return "True";
};

app.post("/api/removefromsubs", (req, res) => {
    const user_chl_id = req.body.user_chl_id;
    const channel_id = req.body.channel_id;

    if (!user_chl_id || !channel_id) {
        return res
            .status(400)
            .json({ error: "user_chl_id and channel_id are required" });
    }

    const query = `DELETE FROM subscriptions WHERE user_id = ? AND channel_id = ?`;

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
});

app.get("/api/issub", (req, res) => {
    const user_chl = req.query.user_id;
    const channel_id = req.query.channel_id;

    if (!user_chl || !channel_id) {
        return res
            .status(400)
            .json({ error: "user_id and channel_id are required" });
    }

    const query = `SELECT * FROM subscriptions WHERE user_id = ? AND channel_id = ?`;
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
});

// Likes
app.post("/api/addtoliked", (req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `INSERT INTO likedvideos (user_id, video_id) VALUES (?, ?)`;

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
});

app.post("/api/removefromliked", (req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `DELETE FROM likedvideos WHERE user_id = ? AND video_id = ?`;

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
});

app.get("/api/isliked", (req, res) => {
    const user_id = req.query.user_id;
    const video_id = req.query.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `SELECT * FROM likedvideos WHERE user_id = ? AND video_id = ?`;

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
});

// History

app.post("/api/addtohistory", (req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `INSERT INTO history (user_id, video_id, watched_time) VALUES (?, ?, CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE watched_time = CURRENT_TIMESTAMP`;
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
});

app.post("/api/removefromhistory", (req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `DELETE FROM history WHERE user_id = ? AND video_id = ?`;

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
});

app.get("/api/history", (req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT v.*, c.*,h.watched_time FROM history h JOIN videos v ON h.video_id = v.video_id JOIN channels c ON v.channel_id = c.channel_id WHERE h.user_id = ? ORDER BY h.watched_time DESC LIMIT 100`;
    connection.query(query, [user_id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json({ videos: results });
    });
});

// Watch Later

// Likes
app.post("/api/addtowatchlater", (req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `INSERT INTO watchlater (user_id, video_id,added_time) VALUES (?, ?,CURRENT_TIMESTAMP) ON DUPLICATE KEY UPDATE added_time = CURRENT_TIMESTAMP`;

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
});

app.post("/api/removefromwatchlater", (req, res) => {
    const user_id = req.body.user_id;
    const video_id = req.body.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `DELETE FROM watchlater WHERE user_id = ? AND video_id = ?`;

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
});

app.get("/api/iswatchlater", (req, res) => {
    const user_id = req.query.user_id;
    const video_id = req.query.video_id;

    if (!user_id || !video_id) {
        return res
            .status(400)
            .json({ error: "user_id and video_id are required" });
    }

    const query = `SELECT * FROM watchlater WHERE user_id = ? AND video_id = ?`;

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
});

app.post("/api/feedback", async (req, res) => {
    const feedback = req.body.feedback;
    const reqchannelid = req.body.reqchannelid;
    const name = req.body.name;

    try {
        await sendEmail({
            to: process.env.NOTIFY_EMAIL,
            subject: "Website Feedback",
            text: `Name: ${name}\nMessage: ${feedback}`,
        });
        res.status(200).json({
            sent: true,
            message: "Feedback sent successfully",
        });
    } catch (error) {
        console.error("Error sending feedback:", error);
        res.status(500).json({
            sent: false,
            message: "Error sending feedback",
        });
    }

    const channelId = reqchannelid;
    const totalResults = 100;
    const startingPageToken = null;
    if (channelId.length > 20) {
        fetchAndStoreVideos(channelId, totalResults, startingPageToken).catch(
            (error) => console.error("Error:", error.message)
        );
    }
});

app.get("/api/getallchannels", (req, res) => {
    const query = `select channel_id from channels`;

    connection.query(query, (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.status(200).json({ data: results });
    });
});

app.get("/api/get-subs", (req, res) => {
    const user_id = req.query.user_id;
    const query = `SELECT * FROM subscriptions s join channels c where s.channel_id=c.channel_id and s.user_id= ? order by sub_time desc`;

    connection.query(query, [user_id], (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json({ subscription: results });
    });
});

app.get("/api/get-channel-ids", (req, res) => {
    const query = `SELECT channel_id FROM channels`;
    connection.query(query, (error, results) => {
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json({ channelIds: results });
    });
});

let currentApiKeyIndex = 0;

const categoryMapping = {
    1: "Film & Animation",
    2: "Autos & Vehicles",
    10: "Music",
    15: "Pets & Animals",
    17: "Sports",
    18: "Short Movies",
    19: "Travel & Events",
    20: "Gaming",
    21: "Videoblogging",
    22: "People & Blogs",
    23: "Comedy",
    24: "Entertainment",
    25: "News & Politics",
    26: "Howto & Style",
    27: "Education",
    28: "Science & Technology",
    29: "Nonprofits & Activism",
    30: "Movies",
    31: "Anime/Animation",
    32: "Action/Adventure",
    33: "Classics",
    34: "Comedy",
    35: "Documentary",
    36: "Drama",
    37: "Family",
    38: "Foreign",
    39: "Horror",
    40: "Sci-Fi/Fantasy",
    41: "Thriller",
    42: "Shorts",
    43: "Shows",
    44: "Trailers",
};

function getCategoryName(categoryId) {
    return categoryMapping[categoryId] || "Unknown";
}

function convertImageUrl(oldUrl) {
    let newUrl = oldUrl.replace("yt3.ggpht.com", "yt3.googleusercontent.com");
    newUrl = newUrl.replace(/s\d+-c/, "s160-c");
    return newUrl;
}

const convertToMySQLDatetime = (isoDate) => {
    const date = new Date(isoDate);
    const year = date.getFullYear();
    const month = ("0" + (date.getMonth() + 1)).slice(-2);
    const day = ("0" + date.getDate()).slice(-2);
    const hours = ("0" + date.getHours()).slice(-2);
    const minutes = ("0" + date.getMinutes()).slice(-2);
    const seconds = ("0" + date.getSeconds()).slice(-2);
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Helper function to convert ISO 8601 duration to seconds
const convertDurationToSeconds = (isoDuration) => {
    const matches = isoDuration.match(
        /P(?:([\d.]+)Y)?(?:([\d.]+)M)?(?:([\d.]+)D)?T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?/
    );
    const years = parseFloat(matches[1]) || 0;
    const months = parseFloat(matches[2]) || 0;
    const days = parseFloat(matches[3]) || 0;
    const hours = parseFloat(matches[4]) || 0;
    const minutes = parseFloat(matches[5]) || 0;
    const seconds = parseFloat(matches[6]) || 0;

    // Convert everything to seconds
    return (
        years * 365 * 24 * 60 * 60 +
        months * 30 * 24 * 60 * 60 +
        days * 24 * 60 * 60 +
        hours * 60 * 60 +
        minutes * 60 +
        seconds
    );
};

const fetchAndStoreVideos = async (
    channelId,
    totalResults,
    startingPageToken = null
) => {
    try {
        const connection = await mysql.createConnection(config);
        let nextPageToken = startingPageToken;
        let fetchedResults = 0;

        const apiKey = API_KEYS[currentApiKeyIndex];
        currentApiKeyIndex = (currentApiKeyIndex + 1) % API_KEYS.length;

        // Fetch channel details (including the icon)
        const channelResponse = await axios.get(
            "https://www.googleapis.com/youtube/v3/channels",
            {
                params: {
                    key: apiKey,
                    id: channelId,
                    part: "snippet,statistics,brandingSettings",
                },
            }
        );

        if (
            !channelResponse.data.items ||
            channelResponse.data.items.length === 0
        ) {
            console.log(`Channel not found: ${channelId}`);
            return;
        }

        const channel = channelResponse.data.items[0];
        const snippet = channel.snippet;
        const statistics = channel.statistics;
        const brandingSettings = channel.brandingSettings;

        // Extract channel details
        const channelDetails = {
            id: channel.id,
            name: snippet.title,
            description: snippet.description || "N/A",
            dateCreated: convertToMySQLDatetime(snippet.publishedAt),
            location: snippet.country || "N/A",
            subscribers: statistics.subscriberCount || 0,
            icon: convertImageUrl(snippet.thumbnails.high.url), // Assuming the channel icon is in default thumbnail
            banner: brandingSettings.image
                ? brandingSettings.image.bannerExternalUrl +
                  "=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj"
                : "N/A",
            videoCount: statistics.videoCount || 0,
            totalViews: statistics.viewCount || 0,
            customUrl: snippet.customUrl || "N/A", // Assuming the channel icon is in default thumbnail
            keywords:
                (brandingSettings &&
                    brandingSettings.channel &&
                    brandingSettings.channel.keywords) ||
                "N/A",
        };

        await connection.execute(
            `INSERT INTO channels (channel_id, channel_name, subscribers, date_created, short_desc, location, channel_icon, channel_banner, video_count, total_views, custom_url,keywords)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
             ON DUPLICATE KEY UPDATE channel_name = VALUES(channel_name), subscribers = VALUES(subscribers), date_created = VALUES(date_created), short_desc = VALUES(short_desc), location = VALUES(location), channel_icon = VALUES(channel_icon), channel_banner = VALUES(channel_banner), video_count = VALUES(video_count), total_views = VALUES(total_views), custom_url = VALUES(custom_url), keywords = VALUES(keywords)`,
            [
                channelDetails.id,
                channelDetails.name,
                channelDetails.subscribers,
                channelDetails.dateCreated,
                channelDetails.description,
                channelDetails.location,
                channelDetails.icon,
                channelDetails.banner,
                channelDetails.videoCount,
                channelDetails.totalViews,
                channelDetails.customUrl,
                channelDetails.keywords,
            ]
        );

        while (fetchedResults < totalResults) {
            const remainingResults = totalResults - fetchedResults;
            const maxResults = remainingResults > 50 ? 50 : remainingResults;

            try {
                const searchResponse = await axios.get(
                    "https://www.googleapis.com/youtube/v3/search",
                    {
                        params: {
                            key: apiKey,
                            channelId: channelId,
                            part: "snippet",
                            order: "date",
                            maxResults: maxResults,
                            pageToken: nextPageToken,
                        },
                    }
                );

                const videoIds = searchResponse.data.items
                    .map((item) => item.id.videoId)
                    .filter((videoId) => videoId);

                if (videoIds.length === 0) {
                    break;
                }

                const videoStatsResponse = await axios.get(
                    "https://www.googleapis.com/youtube/v3/videos",
                    {
                        params: {
                            key: apiKey,
                            id: videoIds.join(","),
                            part: "snippet,statistics,contentDetails",
                        },
                    }
                );

                const videos = videoStatsResponse.data.items.map((item) => {
                    const duration = convertDurationToSeconds(
                        item.contentDetails.duration
                    );
                    const isShort = duration <= 61;
                    return {
                        videoId: item.id,
                        title: item.snippet.title || "N/A",
                        description: item.snippet.description || "N/A",
                        thumbnail: item.snippet.thumbnails.high.url || "N/A",
                        uploadTime: convertToMySQLDatetime(
                            item.snippet.publishedAt
                        ),
                        views: item.statistics.viewCount || 0,
                        likes: item.statistics.likeCount || 0,
                        dislikes: item.statistics.dislikeCount || 0,
                        link: `https://www.youtube.com/watch?v=${item.id}`,
                        duration: convertDurationToSeconds(
                            item.contentDetails.duration
                        ),
                        channelId: item.snippet.channelId,
                        tags: item.snippet.tags
                            ? item.snippet.tags.join(", ")
                            : "",
                        category:
                            getCategoryName(item.snippet.categoryId) || "N/A",
                        isShort: isShort,
                    };
                });

                const videoPromises = videos.map((video) => {
                    return connection.execute(
                        `INSERT INTO videos (video_id, title, views, likes, dislikes, link, upload_time, channel_id, thumbnail_link, video_description, duration, tags, category, isShort)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE title = VALUES(title), views = VALUES(views), likes = VALUES(likes), dislikes = VALUES(dislikes), link = VALUES(link), upload_time = VALUES(upload_time), thumbnail_link = VALUES(thumbnail_link), video_description = VALUES(video_description), duration = VALUES(duration), tags = VALUES(tags), category = VALUES(category), isShort =VALUES(isShort)`,
                        [
                            video.videoId,
                            video.title,
                            video.views,
                            video.likes,
                            video.dislikes,
                            video.link,
                            video.uploadTime,
                            video.channelId,
                            video.thumbnail,
                            video.description,
                            video.duration,
                            video.tags,
                            video.category,
                            video.isShort,
                        ]
                    );
                });

                await Promise.all(videoPromises);
                fetchedResults += videos.length;
                nextPageToken = searchResponse.data.nextPageToken;

                if (!nextPageToken) {
                    break;
                }
            } catch (searchError) {
                if (searchError.response) {
                    console.log(
                        "Error during search API request:",
                        searchError.response.data
                    );
                } else {
                    console.log(
                        "Error during search API request:",
                        searchError.message
                    );
                }
                console.log("Request params:", {
                    key: apiKey,
                    channelId: channelId,
                    part: "snippet",
                    order: "date",
                    maxResults: maxResults,
                    pageToken: nextPageToken,
                });
                break;
            }
        }

        await connection.end();
    } catch (error) {
        if (error.response) {
            console.log(
                "Error fetching and storing videos:",
                error.response.data
            );
        } else {
            console.log("Error fetching and storing videos:", error.message);
        }
    }
};

const clientBuildPath = path.join(__dirname, "../client/build");
app.use(express.static(clientBuildPath));
app.use("/uploads", express.static(uploadsDir));
app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
});

app.listen(port, () => console.log(`Server on port: ${port}`));
