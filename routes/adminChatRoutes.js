const express = require('express');
const router = express.Router();
const { verifyAdmin } = require('../middleware/auth');
const {
    getSupervisorChats,
    getChatWithSupervisor,
    replyToSupervisor
} = require('../controllers/adminChatController');

router.use(verifyAdmin);

router.get('/supervisors', getSupervisorChats);
router.get('/supervisor/:supervisorId', getChatWithSupervisor);
router.post('/supervisor/:supervisorId/reply', replyToSupervisor);

module.exports = router;