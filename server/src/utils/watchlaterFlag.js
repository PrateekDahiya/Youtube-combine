const attachWatchlaterFlag = (connection, videos, userId, callback) => {
    if (!userId || !Array.isArray(videos) || videos.length === 0) {
        return callback(null, videos);
    }
    const videoIds = videos.map((video) => video.video_id);
    if (
        videoIds.some((id) => id === undefined || id === null || id === "")
    ) {
        return callback(null, videos);
    }
    const placeholders = videoIds.map(() => "?").join(",");
    const query = `SELECT video_id FROM watchlater WHERE user_id = ? AND video_id IN (${placeholders})`;
    connection.query(query, [userId, ...videoIds], (error, rows) => {
        if (error) {
            return callback(error, videos);
        }
        const watchlaterSet = new Set((rows || []).map((row) => row.video_id));
        videos.forEach((video) => {
            video.is_watchlater = watchlaterSet.has(video.video_id) ? 1 : 0;
        });
        callback(null, videos);
    });
};

module.exports = { attachWatchlaterFlag };
