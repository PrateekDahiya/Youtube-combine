const cron = require("node-cron");
const {
    getChannelIdsNeedingUpdate,
    processChannels,
    getNewChannelId,
    channelExists,
    addNewChannel,
} = require("./index");
const { getConnection } = require("../db");

const DEFAULT_CHANNEL_UPDATE_CRON = "*/15 * * * *";
const DEFAULT_NEW_CHANNEL_CRON = "*/15 * * * *";
const CHANNEL_UPDATE_BATCH_SIZE = 5;
const CHANNEL_STALE_DAYS = 3;
const NEW_CHANNEL_TOTAL_RESULTS = 50;

let isUpdatingChannels = false;
let isAddingChannel = false;
let offset = 0;

let channelUpdateCronJob = null;
let newChannelCronJob = null;

async function getSchedulerSettings() {
    const connection = getConnection();
    return new Promise((resolve, reject) => {
        connection.query(
            `SELECT setting_key, setting_value FROM scheduler_settings WHERE setting_key IN (?, ?)`,
            ["channel_update_cron", "new_channel_cron"],
            (error, results) => {
                if (error) return reject(error);
                const settings = {};
                results.forEach(row => {
                    settings[row.setting_key] = row.setting_value;
                });
                resolve(settings);
            }
        );
    });
}

async function initializeSchedulerSettings() {
    const connection = getConnection();
    const defaults = {
        channel_update_cron: DEFAULT_CHANNEL_UPDATE_CRON,
        new_channel_cron: DEFAULT_NEW_CHANNEL_CRON,
    };
    return new Promise((resolve, reject) => {
        connection.query(
            `INSERT IGNORE INTO scheduler_settings (setting_key, setting_value) VALUES (?, ?), (?, ?)`,
            ["channel_update_cron", defaults.channel_update_cron, "new_channel_cron", defaults.new_channel_cron],
            (error) => {
                if (error) return reject(error);
                resolve(defaults);
            }
        );
    });
}

function startChannelUpdateScheduler(cronExpression = DEFAULT_CHANNEL_UPDATE_CRON) {
    if (channelUpdateCronJob) {
        channelUpdateCronJob.stop();
    }
    channelUpdateCronJob = cron.schedule(cronExpression, async () => {
        if (isUpdatingChannels) {
            console.log("Channel update already in progress, skipping");
            return;
        }
        isUpdatingChannels = true;
        try {
            const channelIds = await getChannelIdsNeedingUpdate(offset, CHANNEL_UPDATE_BATCH_SIZE, CHANNEL_STALE_DAYS);
            if (channelIds.length === 0) {
                offset = 0;
                console.log("No channels need update, offset reset to 0");
            } else {
                await processChannels(channelIds, NEW_CHANNEL_TOTAL_RESULTS);
                offset += CHANNEL_UPDATE_BATCH_SIZE;
                console.log(`Updated ${channelIds.length} channels, offset now ${offset}`);
            }
        } catch (error) {
            console.error("Error in channel update scheduler:", error.message);
        } finally {
            isUpdatingChannels = false;
        }
    });
    console.log(`Channel update scheduler started (cron: ${cronExpression})`);
}

function startNewChannelScheduler(cronExpression = DEFAULT_NEW_CHANNEL_CRON) {
    if (newChannelCronJob) {
        newChannelCronJob.stop();
    }
    newChannelCronJob = cron.schedule(cronExpression, async () => {
        if (isAddingChannel) {
            console.log("Add channel already in progress, skipping");
            return;
        }
        isAddingChannel = true;
        try {
            while (true) {
                const channelId = await getNewChannelId();
                if (!channelId) {
                    console.log("No channel ID returned from YouTube API, retrying...");
                    continue;
                }
                const exists = await channelExists(channelId);
                if (!exists) {
                    const success = await addNewChannel(channelId, NEW_CHANNEL_TOTAL_RESULTS);
                    if (success) {
                        console.log(`Successfully added new channel: ${channelId}`);
                    } else {
                        console.log(`Failed to add channel: ${channelId}`);
                    }
                    break;
                }
                console.log(`Channel ${channelId} already exists, searching for another...`);
            }
        } catch (error) {
            console.error("Error in new channel scheduler:", error.message);
        } finally {
            isAddingChannel = false;
        }
    });
    console.log(`New channel scheduler started (cron: ${cronExpression})`);
}

async function updateSchedulerSetting(settingKey, settingValue) {
    const connection = getConnection();
    return new Promise((resolve, reject) => {
        connection.query(
            `INSERT INTO scheduler_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?`,
            [settingKey, settingValue, settingValue],
            (error) => {
                if (error) return reject(error);
                resolve();
            }
        );
    });
}

async function initializeAndStartSchedulers() {
    await initializeSchedulerSettings();
    const settings = await getSchedulerSettings();
    startChannelUpdateScheduler(settings.channel_update_cron || DEFAULT_CHANNEL_UPDATE_CRON);
    startNewChannelScheduler(settings.new_channel_cron || DEFAULT_NEW_CHANNEL_CRON);
}

module.exports = {
    startChannelUpdateScheduler,
    startNewChannelScheduler,
    initializeAndStartSchedulers,
    updateSchedulerSetting,
    getSchedulerSettings,
};