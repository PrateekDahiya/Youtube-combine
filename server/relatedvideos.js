function createFeedAndGenerateSQL(tags) {
    // Step 1: Collect all unique words from tags
    const uniqueWords = new Set();

    tags.forEach((tag) => {
        const words = tag.split(/[\s,]+/);
        words.forEach((word) => {
            const cleanedWord = word.toLowerCase().trim(); // Normalize case and trim whitespace
            uniqueWords.add(cleanedWord);
        });
    });

    // Step 2: Generate the SQL query based on all unique words
    const wordsList = Array.from(uniqueWords)
        .map((word) => `'${word}'`)
        .join(", ");
    const sqlQuery = `
        SELECT 
            *,
            (${Array.from(uniqueWords)
                .map((word) => `IF(LOCATE('${word}', tags), 1, 0)`)
                .join(" + ")}) AS score
        FROM videos
        WHERE video_id <> '1YE6FP1FOdQ' -- Exclude the video itself
        ORDER BY score DESC;
    `;

    return sqlQuery;
}

// Example usage:
const tags = [
    "News, breaking news, Hindi news",
    "Politics, DB Live, Current affairs",
    "news live, news today, news7",
];

const sqlQuery = createFeedAndGenerateSQL(tags);
console.log(sqlQuery);
