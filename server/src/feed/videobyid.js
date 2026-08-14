const { httpError, runQuery } = require("./helpers");

async function videoByIdFeed(params) {
    const video_id = params.video_id;
    if (!video_id) {
        throw httpError(400, "Missing video_id parameter");
    }
    const query = `select * from videos v join channels c on v.channel_id=c.channel_id where v.video_id= ?`;
    const results = await runQuery(query, [video_id]);
    return { video: results };
}

module.exports = videoByIdFeed;
