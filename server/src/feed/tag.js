const { categoryMap } = require("../utils");
const {
    HOME_TTL,
    cachedQuery,
    flagVideos,
    nextCursorFromVideos,
    decodeCursor,
} = require("./helpers");

function asArray(value) {
    if (Array.isArray(value)) return value.filter((v) => v !== undefined && v !== null && v !== "");
    if (value === undefined || value === null || value === "") return [];
    return [value];
}

async function tagFeed(params) {
    const tags = asArray(params.tags !== undefined ? params.tags : params.tag);
    const categories = asArray(params.categories !== undefined ? params.categories : params.category);
    const cursor = decodeCursor(params.cursor);

    const keysetClause =
        "and (v.upload_time < ? or (v.upload_time = ? and v.video_id < ?))";
    const orderClause = "order by v.upload_time desc, v.video_id desc limit 24";

    const groups = [];
    const groupParams = [];

    for (const tag of tags) {
        const searchQuery = `%${tag}%`;
        groups.push("(v.title like ? or v.tags like ? or v.category like ? or c.channel_name like ?)");
        groupParams.push(searchQuery, searchQuery, searchQuery, searchQuery);
    }

    if (categories.length > 0) {
        const mapped = [];
        for (const category of categories) {
            const list = categoryMap[category] || [category];
            for (const name of list) {
                if (!mapped.includes(name)) mapped.push(name);
            }
        }
        groups.push("v.category in (?)");
        groupParams.push(mapped);
    }

    const filterClause = groups.length > 0 ? `and (${groups.join(" or ")})` : "";
    const cacheKey = `feed-by-tag:${[...tags].sort().join(",")}:${[...categories].sort().join(",")}:${cursor || "page:" + (params.page || 1)}`;

    let query;
    let queryParams;
    if (cursor) {
        query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 ${filterClause} ${keysetClause} ${orderClause}`;
        queryParams = [...groupParams, cursor.uploadTime, cursor.uploadTime, cursor.videoId];
    } else {
        const page_no = Number(params.page || 1);
        query = `SELECT * FROM channels c join videos v on c.channel_id=v.channel_id where v.isShort = 0 and v.upload_status = 0 ${filterClause} ${orderClause} offset ?`;
        queryParams = [...groupParams, 24 * (page_no - 1)];
    }

    const feed = await cachedQuery(cacheKey, HOME_TTL, query, queryParams);
    const videos = await flagVideos(feed, params.user_id);
    return {
        page: "home_tag",
        videos,
        tag: tags[0] || "",
        tags,
        category: categories[0] || "",
        categories,
        nextCursor: nextCursorFromVideos(videos),
    };
}

module.exports = tagFeed;
