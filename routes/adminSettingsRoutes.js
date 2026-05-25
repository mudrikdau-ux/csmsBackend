const express = require('express');
const router = express.Router();

const { verifyAdmin } = require('../middleware/auth');
const {
    getSettings,
    toggleSetting
} = require('../controllers/adminSettingsController');

// All routes require admin authentication
router.use(verifyAdmin);

// Get all settings
router.get('/', getSettings);

// Toggle a setting
router.put('/toggle', toggleSetting);

module.exports = router;