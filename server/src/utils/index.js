const { v4: uuidv4 } = require("uuid");

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

function sanitizeTag(tag) {
    return tag.replace(/'/g, "''");
}

function createFeedAndGenerateSQL(
    tags,
    excludedVideoIds = [],
    maxVideosPerChannel = 5,
    limit = 24,
    offset = null
) {
    const wordCount = {};

    tags.forEach((tag) => {
        const sanitizedTag = sanitizeTag(tag);
        const words = sanitizedTag.split(/[\s,]+/);
        words.forEach((word) => {
            const cleanedWord = word.toLowerCase().trim();
            if (cleanedWord) {
                wordCount[cleanedWord] = (wordCount[cleanedWord] || 0) + 1;
            }
        });
    });

    const multipleOccurrences = Object.entries(wordCount)
        .filter(([word, count]) => count > 1)
        .sort((a, b) => b[1] - a[1])
        .map(([word]) => word);

    let scoreCalculations =
        multipleOccurrences.length > 0
            ? multipleOccurrences
                  .map(
                      (word) =>
                          `IF(LOCATE('${sanitizeTag(word)}', v.tags), 1, 0)`
                  )
                  .join(" + ")
            : "0";

    const filteredExcludedIds = excludedVideoIds
        .filter((id) => id && id !== "undefined")
        .map((id) => `'${sanitizeTag(id)}'`);

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

const convertDurationToSeconds = (isoDuration) => {
    if (!isoDuration) return 0;
    const matches = isoDuration.match(
        /P(?:([\d.]+)Y)?(?:([\d.]+)M)?(?:([\d.]+)D)?T(?:([\d.]+)H)?(?:([\d.]+)M)?(?:([\d.]+)S)?/
    );
    if (!matches) return 0;
    const years = parseFloat(matches[1]) || 0;
    const months = parseFloat(matches[2]) || 0;
    const days = parseFloat(matches[3]) || 0;
    const hours = parseFloat(matches[4]) || 0;
    const minutes = parseFloat(matches[5]) || 0;
    const seconds = parseFloat(matches[6]) || 0;

    return (
        years * 365 * 24 * 60 * 60 +
        months * 30 * 24 * 60 * 60 +
        days * 24 * 60 * 60 +
        hours * 60 * 60 +
        minutes * 60 +
        seconds
    );
};

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

const categoryMappingFeed = {
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

const trendingCategoryMapping = {
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

const youtubeCategories = [
    "1",
    "2",
    "10",
    "15",
    "17",
    "20",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
    "29",
];

function getRandomCategory() {
    const randomIndex = Math.floor(Math.random() * youtubeCategories.length);
    return youtubeCategories[randomIndex];
}

function encodeCursor(uploadTime, videoId) {
    return Buffer.from(
        JSON.stringify({ t: uploadTime, v: videoId })
    ).toString("base64url");
}

function decodeCursor(cursor) {
    try {
        const parsed = JSON.parse(
            Buffer.from(cursor, "base64url").toString("utf8")
        );
        if (parsed && parsed.t && parsed.v) {
            return { uploadTime: parsed.t, videoId: parsed.v };
        }
    } catch (error) {
        return null;
    }
    return null;
}

module.exports = {
    generateBase64Uuid,
    generateChannelId,
    generateVideoId,
    sanitizeTag,
    createFeedAndGenerateSQL,
    getCategoryName,
    convertImageUrl,
    convertToMySQLDatetime,
    convertDurationToSeconds,
    categoryMap,
    categoryMappingFeed,
    caticon,
    trendingCategoryMapping,
    getRandomCategory,
    encodeCursor,
    decodeCursor,
};