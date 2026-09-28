const axios = require("axios");
const { API_KEYS } = require("../config");
const { createNewPromiseConnection } = require("../db");

const SEARCH_DAILY_CAP = 80;
const POOL_DAILY_CAP = 9000;
const LEASE_MINUTES = 30;
const MAX_ATTEMPT_BACKOFF_HOURS = 168;

class QuotaExhaustedError extends Error {
    constructor(message) {
        super(message || "YouTube API quota exhausted on all keys");
        this.name = "QuotaExhaustedError";
        this.isQuotaExhausted = true;
    }
}

const quotaState = {
    date: null,
    exhausted: new Set(),
    searchCalls: 0,
    poolUnits: 0,
};

function losAngelesDateString(when) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Los_Angeles",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(when || new Date());
}

function minutesUntilLosAngelesMidnight() {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
        hour12: false,
    }).formatToParts(new Date());
    const get = (type) => Number((parts.find((p) => p.type === type) || {}).value || 0);
    const elapsed = get("hour") * 60 + get("minute") + get("second") / 60;
    return Math.max(1, Math.ceil(24 * 60 - elapsed));
}

function resetQuotaStateIfNewDay() {
    const today = losAngelesDateString();
    if (quotaState.date !== today) {
        quotaState.date = today;
        quotaState.exhausted = new Set();
        quotaState.searchCalls = 0;
        quotaState.poolUnits = 0;
    }
}

function isQuotaError(error) {
    const status = error && error.response && error.response.status;
    const data = error && error.response && error.response.data;
    const reason =
        (data && data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason) || "";
    const message = (data && data.error && data.error.message) || error.message || "";
    if (status === 429 || /RESOURCE_EXHAUSTED|RATE_LIMIT_EXCEEDED/i.test(reason)) {
        return true;
    }
    if (status === 403 && /quotaExceeded|quota exceeded|Quota exceeded/i.test(reason + " " + message)) {
        return true;
    }
    return false;
}

async function persistExhaustedKey(keyIndex) {
    let connection;
    try {
        connection = await createNewPromiseConnection();
        await connection.execute(
            `INSERT INTO api_quota_usage (usage_date, key_index, search_calls, pool_units, exhausted_at)
             VALUES (?, ?, 0, 0, NOW())
             ON DUPLICATE KEY UPDATE exhausted_at = NOW()`,
            [losAngelesDateString(), keyIndex]
        );
    } catch (error) {
        console.log("Error persisting quota exhaustion: " + error.message);
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (endError) {
                console.log("Error closing connection: " + endError.message);
            }
        }
    }
}

async function loadQuotaState() {
    resetQuotaStateIfNewDay();
    let connection;
    try {
        connection = await createNewPromiseConnection();
        const [rows] = await connection.execute(
            `SELECT key_index FROM api_quota_usage
             WHERE usage_date = ? AND exhausted_at IS NOT NULL`,
            [losAngelesDateString()]
        );
        for (const row of rows || []) {
            quotaState.exhausted.add(row.key_index);
        }
    } catch (error) {
        console.log("Error loading quota state: " + error.message);
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (endError) {
                console.log("Error closing connection: " + endError.message);
            }
        }
    }
}

function reportUsage(keyIndex, kind) {
    resetQuotaStateIfNewDay();
    if (kind === "search") {
        quotaState.searchCalls += 1;
        if (quotaState.searchCalls >= SEARCH_DAILY_CAP) {
            quotaState.exhausted.add(keyIndex);
        }
    } else {
        quotaState.poolUnits += 1;
        if (quotaState.poolUnits >= POOL_DAILY_CAP) {
            quotaState.exhausted.add(keyIndex);
        }
    }
}

function takeApiKey(kind) {
    resetQuotaStateIfNewDay();
    if (!Array.isArray(API_KEYS) || API_KEYS.length === 0) {
        throw new QuotaExhaustedError("No YouTube API keys configured");
    }
    for (let index = 0; index < API_KEYS.length; index += 1) {
        if (!quotaState.exhausted.has(index)) {
            return { index, key: API_KEYS[index] };
        }
    }
    throw new QuotaExhaustedError("YouTube API quota exhausted on all keys");
}

async function apiGet(url, params, kind) {
    const attempted = new Set();
    for (;;) {
        const slot = takeApiKey(kind);
        if (attempted.has(slot.index)) {
            throw new QuotaExhaustedError("YouTube API quota exhausted on all keys");
        }
        attempted.add(slot.index);
        try {
            const response = await axios.get(url, { params: { ...params, key: slot.key } });
            reportUsage(slot.index, kind);
            return response;
        } catch (error) {
            if (isQuotaError(error)) {
                quotaState.exhausted.add(slot.index);
                await persistExhaustedKey(slot.index);
                continue;
            }
            throw error;
        }
    }
}

async function withConnection(fn) {
    const connection = await createNewPromiseConnection();
    try {
        return await fn(connection);
    } finally {
        try {
            await connection.end();
        } catch (endError) {
            console.log("Error closing connection: " + endError.message);
        }
    }
}

async function ensureQueueSeeded() {
    return withConnection(async (connection) => {
        await connection.execute(
            `INSERT IGNORE INTO channel_sync_queue (channel_id, tier, score, status, next_due)
             SELECT channel_id, 2, 0, 'pending', NOW() FROM channels
             WHERE channel_id NOT IN (SELECT channel_id FROM channel_sync_queue)`
        );
    });
}

async function enqueueChannel(channelId) {
    return withConnection(async (connection) => {
        await connection.execute(
            `INSERT IGNORE INTO channel_sync_queue (channel_id, tier, score, status, next_due)
             VALUES (?, 0, UNIX_TIMESTAMP(), 'pending', NOW())`,
            [channelId]
        );
    });
}

async function claimNextChannel() {
    return withConnection(async (connection) => {
        const [rows] = await connection.execute(
            `SELECT q.channel_id,
                    CASE WHEN v.cnt IS NULL OR v.cnt = 0 THEN 0
                         WHEN COALESCE(s.subs, 0) > 0 THEN 1
                         ELSE 2 END AS tier,
                    CASE WHEN v.cnt IS NULL OR v.cnt = 0 THEN UNIX_TIMESTAMP(q.created_at)
                         ELSE COALESCE(s.subs, 0) * 1000 + GREATEST(0, DATEDIFF(NOW(), v.last_up)) END AS score
             FROM channel_sync_queue q
             LEFT JOIN (SELECT channel_id, COUNT(*) AS cnt, MAX(upload_time) AS last_up FROM videos GROUP BY channel_id) v
                 ON v.channel_id = q.channel_id
             LEFT JOIN (SELECT channel_id, COUNT(*) AS subs FROM subscriptions GROUP BY channel_id) s
                 ON s.channel_id = q.channel_id
             WHERE (q.status = 'pending'
                    OR (q.status = 'in_progress' AND q.updated_at < (NOW() - INTERVAL ${LEASE_MINUTES} MINUTE)))
               AND q.next_due <= NOW()
               AND (v.cnt IS NULL OR v.last_up IS NULL OR v.last_up < (NOW() - INTERVAL 3 DAY))
             ORDER BY tier ASC, score DESC
             LIMIT 1`
        );
        if (!rows || rows.length === 0) {
            return null;
        }
        const picked = rows[0];
        await connection.execute(
            `UPDATE channel_sync_queue SET status = 'in_progress', tier = ?, score = ? WHERE channel_id = ?`,
            [picked.tier, picked.score, picked.channel_id]
        );
        return { channel_id: picked.channel_id, tier: Number(picked.tier) };
    });
}

async function completeChannel(channelId, empty) {
    const days = empty ? 7 : 3;
    return withConnection(async (connection) => {
        await connection.execute(
            `UPDATE channel_sync_queue
             SET status = 'done', attempts = 0, last_error = NULL, next_due = DATE_ADD(NOW(), INTERVAL ? DAY)
             WHERE channel_id = ?`,
            [days, channelId]
        );
    });
}

async function failChannel(channelId, error) {
    const message = String((error && error.message) || error || "Unknown error").substring(0, 512);
    return withConnection(async (connection) => {
        const [rows] = await connection.execute(
            `SELECT attempts FROM channel_sync_queue WHERE channel_id = ?`,
            [channelId]
        );
        const attempts = ((rows && rows[0] && rows[0].attempts) || 0) + 1;
        const backoffHours = Math.min(Math.pow(2, attempts), MAX_ATTEMPT_BACKOFF_HOURS);
        await connection.execute(
            `UPDATE channel_sync_queue
             SET status = 'failed', attempts = ?, last_error = ?,
                 next_due = DATE_ADD(NOW(), INTERVAL ? HOUR)
             WHERE channel_id = ?`,
            [attempts, message, backoffHours, channelId]
        );
    });
}

async function releaseLease(channelId) {
    return withConnection(async (connection) => {
        await connection.execute(
            `UPDATE channel_sync_queue
             SET status = 'pending', next_due = DATE_ADD(NOW(), INTERVAL ? MINUTE)
             WHERE channel_id = ?`,
            [minutesUntilLosAngelesMidnight(), channelId]
        );
    });
}

module.exports = {
    QuotaExhaustedError,
    SEARCH_DAILY_CAP,
    POOL_DAILY_CAP,
    LEASE_MINUTES,
    isQuotaError,
    takeApiKey,
    reportUsage,
    apiGet,
    loadQuotaState,
    ensureQueueSeeded,
    enqueueChannel,
    claimNextChannel,
    completeChannel,
    failChannel,
    releaseLease,
    quotaState,
};
