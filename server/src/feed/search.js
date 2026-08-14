const {
    checkFullTextAvailability,
    isFullTextAvailable,
    buildFullTextQuery,
} = require("../utils/fulltext");
const { runQuery, flagVideos } = require("./helpers");

async function searchFeed(params) {
    const query = params.query || "";
    const searchQuery = `%${query}%`;
    const page_no = Number(params.page || 1);

    const runSearch = async () => {
        let videoQuery;
        let videoParams;
        let channelQuery;
        let channelParams;

        if (isFullTextAvailable() && query && query.trim().length >= 3) {
            const ftQuery = buildFullTextQuery("title", query);
            videoQuery = `select * from channels c join videos v on c.channel_id=v.channel_id where v.upload_status = 0 and (match(v.title, v.tags, v.video_description) against (? in boolean mode) or c.channel_name like ?) order by v.upload_time desc limit 24 offset ?`;
            videoParams = [ftQuery, searchQuery, 24 * (page_no - 1)];
            channelQuery = `select * from channels where match(channel_name, keywords, short_desc) against (? in boolean mode) order by subscribers desc limit 20`;
            channelParams = [ftQuery];
        } else {
            videoQuery = `select * from channels c join videos v on c.channel_id=v.channel_id where v.upload_status = 0 and (v.title like ? or v.tags like ? or c.channel_name like ?) order by v.upload_time desc limit 24 offset ?`;
            videoParams = [searchQuery, searchQuery, searchQuery, 24 * (page_no - 1)];
            channelQuery = `select * from channels where channel_name like ? or short_desc like ? or custom_url like ? or keywords like ? order by subscribers desc limit 20`;
            channelParams = [searchQuery, searchQuery, searchQuery, searchQuery];
        }

        const videoResults = await runQuery(videoQuery, videoParams);
        const channelResults = await runQuery(channelQuery, channelParams);
        return { videoResults, channelResults };
    };

    await new Promise((resolve) => {
        checkFullTextAvailability(() => resolve());
    });

    const { videoResults, channelResults } = await runSearch();
    const videos = await flagVideos(videoResults, params.user_id);
    return {
        page: "search",
        videos,
        channels: channelResults,
        query,
    };
}

module.exports = searchFeed;
