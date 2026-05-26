const db = require('../config/db');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const {
    getContractorsList,
    getContractorStaff,
    saveAttendance,
    getAttendanceByDate,
    updatePayroll,
    getPayrollByWeek,
    createWeeklyReport,
    getWeeklyReport,
    getWeeklyReportsBySupervisor,
    updateReportPdfPath,
    markReportSubmittedToAdmin,
    sendMessage,
    getMessages,
    markMessagesAsRead,
    getUnreadCount
} = require('../models/supervisorModel');
const { getStaffById } = require('../models/userModel');

// Ensure reports directory exists
const reportsDir = path.join(__dirname, '..', 'reports', 'supervisor');
if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
}

// ==================== PROFILE ====================

const getSupervisorProfile = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const staff = await getStaffById(supervisorId);
        
        if (staff.length === 0) {
            return res.status(404).json({ message: 'Supervisor not found' });
        }
        
        const s = staff[0];
        
        res.json({
            success: true,
            profile: {
                id: s.id,
                first_name: s.first_name,
                last_name: s.last_name,
                full_name: `${s.first_name} ${s.last_name}`,
                email: s.email,
                phone: s.phone,
                staff_type: s.staff_type,
                address: s.address || 'Not provided',
                photo: s.photo ? `/uploads/staff/${s.photo}` : null,
                joined_date: s.created_at
            }
        });
    } catch (error) {
        console.error('Get supervisor profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error.message });
    }
};

// ==================== CONTRACTOR & STAFF MANAGEMENT ====================

const getContractors = async (req, res) => {
    try {
        const contractors = await getContractorsList();
        res.json({
            success: true,
            count: contractors.length,
            contractors: contractors.map(c => ({
                id: c.id,
                company_name: c.company_name,
                location: c.location,
                location_address: c.location_address,
                workers_count: c.workers_count,
                contractor_type: c.contractor_type,
                contact_person: c.contact_person,
                contact_phone: c.contact_phone
            }))
        });
    } catch (error) {
        console.error('Get contractors error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch contractors', error: error.message });
    }
};

const getContractorStaffList = async (req, res) => {
    try {
        const { contractorId } = req.params;
        const staff = await getContractorStaff(contractorId);
        
        res.json({
            success: true,
            count: staff.length,
            staff: staff
        });
    } catch (error) {
        console.error('Get contractor staff error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch staff list', error: error.message });
    }
};

// ==================== ATTENDANCE MANAGEMENT ====================

const saveStaffAttendance = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const { contractor_id, attendance_date, staff_attendance } = req.body;
        
        if (!contractor_id || !attendance_date || !staff_attendance) {
            return res.status(400).json({ 
                message: 'Contractor ID, attendance date, and staff attendance data are required' 
            });
        }
        
        await saveAttendance({ contractor_id, attendance_date, staff_attendance }, supervisorId);
        
        // Update payroll after saving attendance
        // Calculate week ending date (Friday of the week)
        const attendanceDate = new Date(attendance_date);
        const daysUntilFriday = 5 - attendanceDate.getDay(); // 5 = Friday
        const weekEndingDate = new Date(attendanceDate);
        weekEndingDate.setDate(attendanceDate.getDate() + daysUntilFriday);
        const weekEndingStr = weekEndingDate.toISOString().split('T')[0];
        
        await updatePayroll(weekEndingStr, supervisorId);
        
        res.json({
            success: true,
            message: 'Attendance saved and payroll updated successfully'
        });
    } catch (error) {
        console.error('Save attendance error:', error);
        res.status(500).json({ success: false, message: 'Failed to save attendance', error: error.message });
    }
};

const getAttendance = async (req, res) => {
    try {
        const { contractorId, date } = req.params;
        const attendance = await getAttendanceByDate(contractorId, date);
        
        res.json({
            success: true,
            count: attendance.length,
            attendance: attendance.map(a => ({
                staff_id: a.staff_id,
                name: `${a.first_name} ${a.last_name}`,
                email: a.email,
                phone: a.phone,
                is_present: a.is_present === 1,
                daily_wage: parseFloat(a.daily_wage),
                attendance_date: a.attendance_date
            }))
        });
    } catch (error) {
        console.error('Get attendance error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch attendance', error: error.message });
    }
};

// ==================== PAYROLL ====================

const getPayrollSummary = async (req, res) => {
    try {
        const { weekEndingDate } = req.params;
        const payroll = await getPayrollByWeek(weekEndingDate);
        
        const summary = {
            total_staff: payroll.length,
            total_days_present: payroll.reduce((sum, p) => sum + p.days_present, 0),
            total_payroll_amount: payroll.reduce((sum, p) => sum + parseFloat(p.total_earned), 0),
            contractors: [...new Set(payroll.map(p => p.company_name))],
            details: payroll.map(p => ({
                staff_name: `${p.first_name} ${p.last_name}`,
                company: p.company_name,
                days_present: p.days_present,
                total_earned: parseFloat(p.total_earned),
                status: p.status
            }))
        };
        
        res.json({
            success: true,
            week_ending: weekEndingDate,
            summary,
            payroll
        });
    } catch (error) {
        console.error('Get payroll error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payroll', error: error.message });
    }
};

// ==================== WEEKLY REPORTS ====================

const generateWeeklyReport = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const {
            contractor_id,
            week_ending_date,
            work_progress,
            worker_performance,
            equipment_status,
            additional_requests
        } = req.body;
        
        if (!contractor_id || !week_ending_date || !work_progress || !worker_performance || !equipment_status) {
            return res.status(400).json({ 
                message: 'Contractor ID, week ending date, work progress, worker performance, and equipment status are required' 
            });
        }
        
        // Create report record
        const result = await createWeeklyReport({
            contractor_id,
            week_ending_date,
            work_progress,
            worker_performance,
            equipment_status,
            additional_requests
        }, supervisorId);
        
        res.status(201).json({
            success: true,
            message: 'Weekly report generated successfully',
            report_id: result.report_id
        });
    } catch (error) {
        console.error('Generate weekly report error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate report', error: error.message });
    }
};

const downloadWeeklyReport = async (req, res) => {
    try {
        const { reportId } = req.params;
        const report = await getWeeklyReport(reportId);
        
        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }
        
        // Sanitize company name for filename (remove special characters)
        const sanitizedCompanyName = report.company_name
            .replace(/[^a-zA-Z0-9]/g, '_')
            .substring(0, 50);
        
        const weekEndingDate = new Date(report.week_ending_date);
        const formattedDate = weekEndingDate.toISOString().split('T')[0];
        
        // Create safe filename
        const filename = `weekly_report_${sanitizedCompanyName}_${formattedDate}.pdf`;
        const filePath = path.join(reportsDir, filename);
        
        // Generate PDF
        await generateReportPDF(report, filePath);
        
        // Update report with PDF path
        await updateReportPdfPath(reportId, filePath);
        
        // Check if file exists before sending
        if (!fs.existsSync(filePath)) {
            throw new Error('PDF file was not created successfully');
        }
        
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Download error:', err);
                // Don't throw here, just log
            }
            // Schedule file deletion after 5 seconds
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }, 5000);
        });
    } catch (error) {
        console.error('Download report error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to download report', 
            error: error.message 
        });
    }
};

const submitReportToAdmin = async (req, res) => {
    try {
        const { reportId } = req.params;
        
        await markReportSubmittedToAdmin(reportId);
        
        // Also send a message in chat
        const report = await getWeeklyReport(reportId);
        if (report) {
            await sendMessage(
                req.user.id,
                `📋 Weekly report for ${report.company_name} (Week ending ${report.week_ending_date}) has been submitted.`,
                null,
                reportId
            );
        }
        
        res.json({
            success: true,
            message: 'Report submitted to admin successfully'
        });
    } catch (error) {
        console.error('Submit report to admin error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit report', error: error.message });
    }
};

const getMyReports = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const reports = await getWeeklyReportsBySupervisor(supervisorId);
        
        res.json({
            success: true,
            count: reports.length,
            reports: reports.map(r => ({
                id: r.id,
                company_name: r.company_name,
                week_ending_date: r.week_ending_date,
                submitted_to_admin: r.submitted_to_admin === 1,
                created_at: r.created_at
            }))
        });
    } catch (error) {
        console.error('Get my reports error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch reports', error: error.message });
    }
};

// ==================== CHAT SYSTEM ====================

const sendChatMessage = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const { message, report_id } = req.body;
        
        if (!message) {
            return res.status(400).json({ message: 'Message is required' });
        }
        
        let attachmentUrl = null;
        if (req.file) {
            attachmentUrl = `/uploads/chats/${req.file.filename}`;
        }
        
        const result = await sendMessage(supervisorId, message, attachmentUrl, report_id);
        
        res.status(201).json({
            success: true,
            message: 'Message sent successfully',
            message_id: result.message_id
        });
    } catch (error) {
        console.error('Send chat message error:', error);
        res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
    }
};

const getChatMessages = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const messages = await getMessages(supervisorId);
        
        // Mark messages as read
        await markMessagesAsRead(supervisorId);
        
        res.json({
            success: true,
            count: messages.length,
            unread_count: 0,
            messages: messages.map(m => ({
                id: m.id,
                message: m.message,
                attachment_url: m.attachment_url,
                report_id: m.report_id,
                sender_role: m.sender_role,
                sender_name: m.sender_role === 'supervisor' 
                    ? `${m.sender_first_name} ${m.sender_last_name}`
                    : `Admin ${m.admin_first_name || ''}`,
                created_at: m.created_at,
                is_read: m.is_read === 1
            }))
        });
    } catch (error) {
        console.error('Get chat messages error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch messages', error: error.message });
    }
};

const getUnreadMessageCount = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const count = await getUnreadCount(supervisorId);
        
        res.json({
            success: true,
            unread_count: count
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch unread count', error: error.message });
    }
};

// ==================== PDF GENERATION ====================

const generateReportPDF = (report, filePath) => {
    return new Promise((resolve, reject) => {
        try {
            // Ensure directory exists
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const stream = fs.createWriteStream(filePath);
            
            stream.on('error', (err) => {
                console.error('Stream error:', err);
                reject(err);
            });
            
            doc.pipe(stream);
            
            const pageWidth = doc.page.width;
            const margin = 40;
            
            // Header
            doc.rect(0, 0, pageWidth, 80).fill('#1a5276');
            doc.fillColor('#ffffff')
               .fontSize(24)
               .font('Helvetica-Bold')
               .text('CleanSpark', margin, 25);
            doc.fontSize(12)
               .text('Weekly Supervisor Report', margin, 55);
            
            // Report Details
            let yPos = 110;
            doc.fillColor('#2c3e50')
               .fontSize(14)
               .font('Helvetica-Bold')
               .text('REPORT DETAILS', margin, yPos);
            
            yPos += 30;
            doc.fontSize(10)
               .font('Helvetica');
            
            const formatDate = (dateStr) => {
                if (!dateStr) return 'N/A';
                const d = new Date(dateStr);
                return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
            };
            
            const details = [
                ['Contractor:', report.company_name || 'N/A'],
                ['Location:', report.location || 'N/A'],
                ['Week Ending:', formatDate(report.week_ending_date)],
                ['Report Generated:', formatDate(new Date())],
                ['Supervisor:', `${report.supervisor_first_name || ''} ${report.supervisor_last_name || ''}`.trim() || 'N/A']
            ];
            
            details.forEach(([label, value]) => {
                doc.fillColor('#7f8c8d').text(label, margin, yPos, { width: 120 });
                doc.fillColor('#2c3e50').text(value || 'N/A', margin + 130, yPos);
                yPos += 20;
            });
            
            yPos += 20;
            
            // Work Progress
            doc.fillColor('#1a5276')
               .fontSize(12)
               .font('Helvetica-Bold')
               .text('WORK PROGRESS & OBSERVATIONS', margin, yPos);
            yPos += 25;
            doc.fillColor('#34495e')
               .fontSize(9)
               .font('Helvetica')
               .text(report.work_progress || 'No observations recorded', margin, yPos, {
                   width: pageWidth - 80,
                   lineGap: 4
               });
            
            yPos += doc.heightOfString(report.work_progress || 'No observations recorded', {
                width: pageWidth - 80,
                fontSize: 9
            }) + 25;
            
            // Worker Performance
            doc.fillColor('#1a5276')
               .fontSize(12)
               .font('Helvetica-Bold')
               .text('WORKER PERFORMANCE', margin, yPos);
            yPos += 25;
            doc.fillColor('#34495e')
               .fontSize(9)
               .font('Helvetica')
               .text(report.worker_performance || 'No performance data', margin, yPos, {
                   width: pageWidth - 80,
                   lineGap: 4
               });
            
            yPos += doc.heightOfString(report.worker_performance || 'No performance data', {
                width: pageWidth - 80,
                fontSize: 9
            }) + 25;
            
            // Equipment Status
            doc.fillColor('#1a5276')
               .fontSize(12)
               .font('Helvetica-Bold')
               .text('EQUIPMENT STATUS & REQUESTS', margin, yPos);
            yPos += 25;
            doc.fillColor('#34495e')
               .fontSize(9)
               .font('Helvetica')
               .text(report.equipment_status || 'No equipment issues', margin, yPos, {
                   width: pageWidth - 80,
                   lineGap: 4
               });
            
            yPos += doc.heightOfString(report.equipment_status || 'No equipment issues', {
                width: pageWidth - 80,
                fontSize: 9
            }) + 25;
            
            // Additional Requests
            if (report.additional_requests) {
                doc.fillColor('#1a5276')
                   .fontSize(12)
                   .font('Helvetica-Bold')
                   .text('ADDITIONAL REQUESTS / COMMENTS', margin, yPos);
                yPos += 25;
                doc.fillColor('#34495e')
                   .fontSize(9)
                   .font('Helvetica')
                   .text(report.additional_requests, margin, yPos, {
                       width: pageWidth - 80,
                       lineGap: 4
                   });
                yPos += doc.heightOfString(report.additional_requests, {
                    width: pageWidth - 80,
                    fontSize: 9
                }) + 25;
            }
            
            // Footer
            const footerY = doc.page.height - 40;
            if (footerY > yPos) {
                doc.strokeColor('#3498db')
                   .lineWidth(1)
                   .moveTo(margin, footerY)
                   .lineTo(pageWidth - margin, footerY)
                   .stroke();
                
                doc.fillColor('#95a5a6')
                   .fontSize(7)
                   .font('Helvetica')
                   .text(`Generated by CleanSpark Supervisor System | ${new Date().toLocaleString()}`, 
                         margin, footerY + 8, { align: 'center', width: pageWidth - 80 });
            }
            
            doc.end();
            
            stream.on('finish', () => {
                console.log('PDF generated successfully:', filePath);
                resolve();
            });
            
            stream.on('error', (err) => {
                console.error('Stream error:', err);
                reject(err);
            });
            
        } catch (error) {
            console.error('PDF generation error:', error);
            reject(error);
        }
    });
};

// ==================== CHANGE PASSWORD ====================

const changeSupervisorPassword = async (req, res) => {
    try {
        const supervisorId = req.user.id;
        const { current_password, new_password, confirm_password } = req.body;
        const bcrypt = require('bcryptjs');
        const { updateUserPassword, getStaffById } = require('../models/userModel');
        
        if (!current_password || !new_password || !confirm_password) {
            return res.status(400).json({ message: 'All password fields are required' });
        }
        
        if (new_password !== confirm_password) {
            return res.status(400).json({ message: 'New passwords do not match' });
        }
        
        if (new_password.length < 6) {
            return res.status(400).json({ message: 'New password must be at least 6 characters' });
        }
        
        const staff = await getStaffById(supervisorId);
        if (staff.length === 0) {
            return res.status(404).json({ message: 'Supervisor not found' });
        }
        
        const s = staff[0];
        
        const isMatch = await bcrypt.compare(current_password, s.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect' });
        }
        
        const hashedPassword = await bcrypt.hash(new_password, 10);
        await updateUserPassword(supervisorId, hashedPassword);
        
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Failed to change password', error: error.message });
    }
};

module.exports = {
    getSupervisorProfile,
    getContractors,
    getContractorStaffList,
    saveStaffAttendance,
    getAttendance,
    getPayrollSummary,
    generateWeeklyReport,
    downloadWeeklyReport,
    submitReportToAdmin,
    getMyReports,
    sendChatMessage,
    getChatMessages,
    getUnreadMessageCount,
    changeSupervisorPassword
};