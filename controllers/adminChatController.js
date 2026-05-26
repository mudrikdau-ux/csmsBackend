const {
    adminReplyToSupervisor,
    getSupervisorChatList,
    getMessages
} = require('../models/supervisorModel');

const getSupervisorChats = async (req, res) => {
    try {
        const adminId = req.user.id;
        const chats = await getSupervisorChatList(adminId);
        
        res.json({
            success: true,
            count: chats.length,
            chats: chats.map(c => ({
                supervisor_id: c.supervisor_id,
                supervisor_name: `${c.first_name} ${c.last_name}`,
                email: c.email,
                phone: c.phone,
                last_message: c.last_message,
                last_message_time: c.last_message_time,
                unread_count: c.unread_count
            }))
        });
    } catch (error) {
        console.error('Get supervisor chats error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch chats', error: error.message });
    }
};

const getChatWithSupervisor = async (req, res) => {
    try {
        const { supervisorId } = req.params;
        const messages = await getMessages(supervisorId);
        
        res.json({
            success: true,
            count: messages.length,
            messages: messages.map(m => ({
                id: m.id,
                message: m.message,
                attachment_url: m.attachment_url,
                report_id: m.report_id,
                sender_role: m.sender_role,
                created_at: m.created_at
            }))
        });
    } catch (error) {
        console.error('Get chat messages error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch messages', error: error.message });
    }
};

const replyToSupervisor = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { supervisorId } = req.params;
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({ message: 'Message is required' });
        }
        
        await adminReplyToSupervisor(adminId, supervisorId, message);
        
        res.json({
            success: true,
            message: 'Reply sent successfully'
        });
    } catch (error) {
        console.error('Reply to supervisor error:', error);
        res.status(500).json({ success: false, message: 'Failed to send reply', error: error.message });
    }
};

module.exports = {
    getSupervisorChats,
    getChatWithSupervisor,
    replyToSupervisor
};