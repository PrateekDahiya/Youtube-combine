const { runQuery, flagVideos } = require("./helpers");

async function channelFeed(params) {
    const channel_id = params.channel_id;
    const searchTerm = params.query || "";
    const type = params.isShort;
    const page_no = Number(params.page || 1);
    const formattedSearchTerm = `%${searchTerm}%`;

    let query;
    let queryParams;
    if (searchTerm === "") {
        query = `SELECT * FROM videos v 
                 JOIN channels c ON v.channel_id = c.channel_id 
                 WHERE v.channel_id = ? AND v.isShort = ? AND v.upload_status = 0 
                 ORDER BY upload_time DESC 
                 LIMIT 24 OFFSET ?`;
        queryParams = [channel_id, type, 24 * (page_no - 1)];
    } else {
        query = `SELECT * FROM videos v 
                 JOIN channels c ON v.channel_id = c.channel_id 
                 WHERE v.channel_id = ? AND v.isShort = ? AND v.upload_status = 0 
                 AND (v.title LIKE ?) 
                 ORDER BY upload_time DESC 
                 LIMIT 24 OFFSET ?`;
        queryParams = [channel_id, type, formattedSearchTerm, 24 * (page_no - 1)];
    }

    const feed = await runQuery(query, queryParams);
    const videos = await flagVideos(feed, params.user_id);
    return { videos };
}

module.exports = channelFeed;
