const db = require('../config/db');

const getSetting = async (key) => {
    const result = await db.query(`SELECT setting_value FROM admin_settings WHERE setting_key = ?`, [key]);
    return result.length > 0 ? result[0].setting_value : null;
};

const getAllSettings = async () => {
    return db.query(`SELECT * FROM admin_settings ORDER BY id`);
};

const updateSetting = async (key, value) => {
    return db.query(
        `INSERT INTO admin_settings (setting_key, setting_value) VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE setting_value = ?`,
        [key, value, value]
    );
};

const isEmailNotificationsEnabled = async () => {
    const value = await getSetting('email_notifications');
    return value === '1';
};

const isAutoAssignEnabled = async () => {
    const value = await getSetting('auto_assign_staff');
    return value === '1';
};

module.exports = {
    getSetting,
    getAllSettings,
    updateSetting,
    isEmailNotificationsEnabled,
    isAutoAssignEnabled
};