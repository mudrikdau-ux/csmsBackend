const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const {
    createApplication,
    getApplicationById,
    getApplicationByReference,
    getAllApplications,
    getUserApplications,
    updateApplicationStatus,
    deleteApplication,
    getApplicationCount,
    getApplicationSettings,
    updateApplicationSettings
} = require('../models/jobApplicationModel');

// Ensure PDF directory exists
const pdfDir = path.join(__dirname, '..', 'reports', 'applications');
if (!fs.existsSync(pdfDir)) {
    fs.mkdirSync(pdfDir, { recursive: true });
}

// Branding
const BRANDING = {
    primaryColor: '#1a5276',
    secondaryColor: '#2e86c1',
    successColor: '#27ae60',
    dangerColor: '#e74c3c',
    warningColor: '#f39c12',
    lightGray: '#f8f9fa',
    borderGray: '#dee2e6',
    darkGray: '#2c3e50',
    textGray: '#6c757d',
    white: '#ffffff',
    companyName: 'CleanSpark',
    tagline: 'Professional Cleaning Services',
    address: 'Stone Town, Zanzibar',
    phone: '+255 777 000 000',
    email: 'info@cleanspark.co.tz'
};

// ==================== GET SETTINGS ====================

const getSettings = async (req, res) => {
    try {
        const settings = await getApplicationSettings();
        const s = settings[0];
        res.json({
            success: true,
            settings: {
                is_open: s.is_open === 1,
                application_deadline: s.application_deadline,
                positions_available: s.positions_available ? s.positions_available.split(',').map(p => p.trim()) : [],
                min_age: s.min_age,
                max_age: s.max_age
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch settings', error: error.message });
    }
};

// ==================== ADMIN: UPDATE SETTINGS (TOGGLE OPEN/CLOSE) ====================

const updateSettings = async (req, res) => {
    try {
        const { is_open, application_deadline, positions_available, min_age, max_age } = req.body;
        await updateApplicationSettings({
            is_open,
            application_deadline,
            positions_available: Array.isArray(positions_available) ? positions_available.join(', ') : positions_available,
            min_age,
            max_age,
            updated_by: req.user.id
        });
        res.json({
            success: true,
            message: `Applications ${is_open ? 'OPENED' : 'CLOSED'} successfully`,
            settings: { is_open, application_deadline, positions_available, min_age, max_age }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update settings', error: error.message });
    }
};

// ==================== ADMIN: GET STATISTICS ====================

const getStats = async (req, res) => {
    try {
        const allCount = await getApplicationCount({});
        const pendingCount = await getApplicationCount({ status: 'pending' });
        const reviewedCount = await getApplicationCount({ status: 'reviewed' });
        const shortlistedCount = await getApplicationCount({ status: 'shortlisted' });
        const rejectedCount = await getApplicationCount({ status: 'rejected' });
        const hiredCount = await getApplicationCount({ status: 'hired' });
        const settings = await getApplicationSettings();

        res.json({
            success: true,
            stats: {
                total: allCount[0].count,
                pending: pendingCount[0].count,
                under_review: reviewedCount[0].count + shortlistedCount[0].count,
                shortlisted: shortlistedCount[0].count,
                approved: hiredCount[0].count,
                rejected: rejectedCount[0].count,
                is_open: settings[0].is_open === 1,
                deadline: settings[0].application_deadline
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch statistics', error: error.message });
    }
};

// ==================== CUSTOMER: SUBMIT APPLICATION ====================

const submitApplication = async (req, res) => {
    try {
        const settings = await getApplicationSettings();
        const s = settings[0];

        if (!s.is_open) {
            return res.status(400).json({ success: false, message: 'Job applications are currently closed.', is_open: false });
        }
        if (s.application_deadline && new Date(s.application_deadline) < new Date()) {
            return res.status(400).json({ success: false, message: 'Application deadline has passed.', deadline_passed: true });
        }

        const { full_name, address, age, gender, phone, email, education_level, experience_years, skills, position_applying, availability, additional_notes } = req.body;

        if (!full_name || !address || !age || !gender || !phone || !email || !education_level || !skills || !position_applying || !availability) {
            return res.status(400).json({ message: 'All required fields must be filled' });
        }
        if (age < s.min_age || age > s.max_age) {
            return res.status(400).json({ message: `Age must be between ${s.min_age} and ${s.max_age} years` });
        }

        const getFile = (fieldname) => {
            const file = req.files.find(f => f.fieldname === fieldname);
            return file ? file.filename : null;
        };

        const cvFile = getFile('cv_file');
        const idFile = getFile('national_id_file');
        const introFile = getFile('introduction_letter_file');
        const photoFile = getFile('passport_photo_file');

        if (!cvFile || !idFile || !introFile || !photoFile) {
            return res.status(400).json({
                message: 'All required documents must be uploaded',
                required_docs: ['cv_file', 'national_id_file', 'introduction_letter_file', 'passport_photo_file']
            });
        }

        const result = await createApplication({
            user_id: req.user ? req.user.id : null,
            full_name: full_name.trim(), address: address.trim(), age: parseInt(age), gender,
            phone: phone.trim(), email: email.toLowerCase().trim(), education_level,
            experience_years: parseInt(experience_years) || 0, skills: skills.trim(),
            position_applying: position_applying.trim(), availability,
            additional_notes: additional_notes || null,
            cv_file: cvFile, national_id_file: idFile, introduction_letter_file: introFile, passport_photo_file: photoFile,
            application_letter_file: getFile('application_letter_file'),
            certificate_file: getFile('certificate_file'),
            other_docs_file: getFile('other_docs_file')
        });

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully! Save your reference number.',
            application_id: result.insertId,
            reference_number: result.referenceNumber
        });
    } catch (error) {
        console.error('Submit application error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit application', error: error.message });
    }
};

// ==================== CUSTOMER: GET MY APPLICATIONS ====================

const getMyApplications = async (req, res) => {
    try {
        const applications = await getUserApplications(req.user.id);
        res.json({
            success: true, count: applications.length,
            applications: applications.map(app => ({
                id: app.id, reference_number: app.reference_number, position: app.position_applying,
                status: app.status, status_label: getStatusLabel(app.status),
                date: app.created_at
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch applications', error: error.message });
    }
};

// ==================== PUBLIC: TRACK BY REFERENCE ====================

const trackByReference = async (req, res) => {
    try {
        const { reference } = req.params;
        const application = await getApplicationByReference(reference);
        if (!application || application.length === 0) {
            return res.status(404).json({ success: false, message: 'No application found with this reference number.' });
        }
        res.json({ success: true, tracking: buildTrackingData(application[0]) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to track application', error: error.message });
    }
};

// ==================== CUSTOMER: TRACK MY APPLICATION ====================

const trackMyApplication = async (req, res) => {
    try {
        const { reference } = req.params;
        const application = await getApplicationByReference(reference);
        if (!application || application.length === 0) {
            return res.status(404).json({ success: false, message: 'No application found.' });
        }
        const app = application[0];
        if (app.user_id !== req.user.id) {
            return res.status(403).json({ message: 'This reference does not belong to your account.' });
        }
        res.json({ success: true, tracking: buildTrackingData(app, true) });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to track application', error: error.message });
    }
};

// ==================== ADMIN: GET ALL APPLICATIONS ====================

const getApplications = async (req, res) => {
    try {
        const filters = {
            status: req.query.status, position: req.query.position, education: req.query.education,
            search: req.query.search, date_from: req.query.date_from, date_to: req.query.date_to,
            limit: req.query.limit || 50, offset: req.query.offset || 0
        };

        const applications = await getAllApplications(filters);

        res.json({
            success: true, count: applications.length,
            applications: applications.map(app => ({
                id: app.id,
                reference_number: app.reference_number,
                full_name: app.full_name,
                position: app.position_applying,
                email: app.email,
                gender: app.gender,
                age: app.age,
                address: app.address,
                phone: app.phone,
                education: getEducationLabel(app.education_level),
                experience: `${app.experience_years} years`,
                status: app.status,
                status_label: getStatusLabel(app.status),
                status_color: getStatusColor(app.status),
                date: app.created_at,
                has_docs: true
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch applications', error: error.message });
    }
};

// ==================== ADMIN: GET SINGLE APPLICATION (FULL DETAILS) ====================

const getSingleApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const application = await getApplicationById(id);
        if (!application || application.length === 0) return res.status(404).json({ message: 'Application not found' });

        const app = application[0];

        res.json({
            success: true,
            application: {
                id: app.id,
                reference_number: app.reference_number,
                personal_info: {
                    full_name: app.full_name,
                    address: app.address,
                    age: app.age,
                    gender: app.gender,
                    phone: app.phone,
                    email: app.email
                },
                professional_info: {
                    education_level: getEducationLabel(app.education_level),
                    experience_years: app.experience_years,
                    skills: app.skills,
                    position_applying: app.position_applying,
                    availability: getAvailabilityLabel(app.availability),
                    additional_notes: app.additional_notes
                },
                documents: {
                    cv: app.cv_file ? `${req.protocol}://${req.get('host')}/uploads/applications/${app.cv_file}` : null,
                    national_id: app.national_id_file ? `${req.protocol}://${req.get('host')}/uploads/applications/${app.national_id_file}` : null,
                    introduction_letter: app.introduction_letter_file ? `${req.protocol}://${req.get('host')}/uploads/applications/${app.introduction_letter_file}` : null,
                    passport_photo: app.passport_photo_file ? `${req.protocol}://${req.get('host')}/uploads/applications/${app.passport_photo_file}` : null,
                    application_letter: app.application_letter_file ? `${req.protocol}://${req.get('host')}/uploads/applications/${app.application_letter_file}` : null,
                    certificate: app.certificate_file ? `${req.protocol}://${req.get('host')}/uploads/applications/${app.certificate_file}` : null,
                    other_docs: app.other_docs_file ? `${req.protocol}://${req.get('host')}/uploads/applications/${app.other_docs_file}` : null
                },
                status: app.status,
                status_label: getStatusLabel(app.status),
                status_color: getStatusColor(app.status),
                review: app.review_notes ? {
                    notes: app.review_notes,
                    by: app.reviewed_by_name ? `${app.reviewed_by_name} ${app.reviewed_by_lastname || ''}` : 'Admin',
                    at: app.reviewed_at
                } : null,
                date: app.created_at
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch application', error: error.message });
    }
};

// ==================== ADMIN: REVIEW/UPDATE APPLICATION STATUS ====================

const reviewApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, review_notes } = req.body;

        const validStatuses = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status', valid_statuses: validStatuses });
        }

        if (status === 'rejected' && (!review_notes || review_notes.trim().length < 5)) {
            return res.status(400).json({ message: 'Rejection reason is required (minimum 5 characters)' });
        }

        await updateApplicationStatus(id, status, req.user.id, review_notes);

        const actionMessages = {
            'reviewed': 'Application marked as Under Review',
            'shortlisted': 'Applicant has been Shortlisted',
            'rejected': 'Application has been Rejected',
            'hired': 'Applicant has been Approved/Hired',
            'pending': 'Application reset to Pending'
        };

        res.json({
            success: true,
            message: actionMessages[status] || 'Status updated',
            application: { id: parseInt(id), status, status_label: getStatusLabel(status), status_color: getStatusColor(status) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to review application', error: error.message });
    }
};

// ==================== ADMIN: DELETE APPLICATION ====================

const removeApplication = async (req, res) => {
    try {
        const { id } = req.params;
        // Get application to delete files
        const app = await getApplicationById(id);
        if (app && app.length > 0) {
            const a = app[0];
            const fileFields = ['cv_file', 'national_id_file', 'introduction_letter_file', 'passport_photo_file', 'application_letter_file', 'certificate_file', 'other_docs_file'];
            fileFields.forEach(field => {
                if (a[field]) {
                    const filePath = path.join(__dirname, '..', 'uploads', 'applications', a[field]);
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                }
            });
        }
        await deleteApplication(id);
        res.json({ success: true, message: 'Application and all documents deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete application', error: error.message });
    }
};

// ==================== ADMIN: DOWNLOAD APPLICATION AS PDF ====================

const downloadApplicationPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const application = await getApplicationById(id);
        if (!application || application.length === 0) return res.status(404).json({ message: 'Application not found' });

        const app = application[0];
        const filename = `Application_${app.reference_number}.pdf`;
        const filePath = path.join(pdfDir, filename);

        await generateApplicationPDF(app, filePath);

        res.download(filePath, filename, (err) => {
            if (err) console.error('Download error:', err);
            setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }, 5000);
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to download PDF', error: error.message });
    }
};

// ==================== ADMIN: VIEW APPLICATION PDF (SHARE) ====================

const viewApplicationPDF = async (req, res) => {
    try {
        const { id } = req.params;
        const application = await getApplicationById(id);
        if (!application || application.length === 0) return res.status(404).json({ message: 'Application not found' });

        const app = application[0];
        const filename = `Application_${app.reference_number}.pdf`;
        const filePath = path.join(pdfDir, filename);

        await generateApplicationPDF(app, filePath);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=${filename}`);
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        stream.on('end', () => {
            setTimeout(() => { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }, 5000);
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to view PDF', error: error.message });
    }
};

// ==================== GENERATE PDF ====================

const generateApplicationPDF = (app, filePath) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const pageWidth = doc.page.width;
        const margin = 40;
        const contentWidth = pageWidth - (margin * 2);

        // Top bar
        doc.rect(0, 0, pageWidth, 6).fill(BRANDING.primaryColor);

        // Header
        let yPos = 20;
        doc.rect(margin, yPos, 90, 65).fill(BRANDING.secondaryColor);
        doc.fillColor(BRANDING.white).fontSize(24).font('Helvetica-Bold').text('CS', margin, yPos + 8, { width: 90, align: 'center' });
        doc.fontSize(9).text('CleanSpark', margin, yPos + 42, { width: 90, align: 'center' });

        const rightX = pageWidth - margin - 180;
        doc.fillColor(BRANDING.primaryColor).fontSize(18).font('Helvetica-Bold').text('JOB APPLICATION', rightX, yPos);
        doc.fillColor(BRANDING.darkGray).fontSize(9).font('Helvetica').text(`Ref: ${app.reference_number}`, rightX, yPos + 25);

        yPos += 80;

        // Status badge
        const statusColor = getStatusColor(app.status);
        doc.roundedRect(pageWidth - margin - 140, yPos, 120, 22, 4).fill(statusColor);
        doc.fillColor(BRANDING.white).fontSize(9).font('Helvetica-Bold')
           .text(getStatusLabel(app.status).toUpperCase(), pageWidth - margin - 140, yPos + 5, { width: 120, align: 'center' });

        yPos += 35;

        // Personal Info Section
        doc.rect(margin, yPos, contentWidth, 30).fill(BRANDING.lightGray);
        doc.fillColor(BRANDING.primaryColor).fontSize(12).font('Helvetica-Bold').text('PERSONAL INFORMATION', margin + 10, yPos + 8);
        yPos += 38;

        doc.fillColor(BRANDING.darkGray).fontSize(9).font('Helvetica');
        const personalFields = [
            ['Full Name:', app.full_name], ['Address:', app.address], ['Age:', app.age.toString()],
            ['Gender:', app.gender], ['Phone:', app.phone], ['Email:', app.email]
        ];
        personalFields.forEach(([label, value]) => {
            doc.text(label, margin + 10, yPos, { width: 120 });
            doc.font('Helvetica-Bold').text(value || 'N/A', margin + 140, yPos, { width: contentWidth - 150 });
            yPos += 18;
        });

        yPos += 10;

        // Professional Info Section
        doc.rect(margin, yPos, contentWidth, 30).fill(BRANDING.lightGray);
        doc.fillColor(BRANDING.primaryColor).fontSize(12).font('Helvetica-Bold').text('PROFESSIONAL DETAILS', margin + 10, yPos + 8);
        yPos += 38;

        doc.fillColor(BRANDING.darkGray).fontSize(9).font('Helvetica');
        const profFields = [
            ['Education:', getEducationLabel(app.education_level)], ['Experience:', `${app.experience_years} years`],
            ['Skills:', app.skills], ['Position:', app.position_applying],
            ['Availability:', getAvailabilityLabel(app.availability)]
        ];
        profFields.forEach(([label, value]) => {
            doc.text(label, margin + 10, yPos, { width: 120 });
            doc.font('Helvetica-Bold').text(value || 'N/A', margin + 140, yPos, { width: contentWidth - 150 });
            yPos += 18;
        });

        if (app.additional_notes) {
            yPos += 5;
            doc.text('Additional Notes:', margin + 10, yPos, { width: 120 });
            doc.font('Helvetica').text(app.additional_notes, margin + 140, yPos, { width: contentWidth - 150 });
        }

        yPos += 25;

        // Documents Section
        doc.rect(margin, yPos, contentWidth, 30).fill(BRANDING.lightGray);
        doc.fillColor(BRANDING.primaryColor).fontSize(12).font('Helvetica-Bold').text('SUBMITTED DOCUMENTS', margin + 10, yPos + 8);
        yPos += 38;

        doc.fontSize(9).font('Helvetica');
        const docFields = [
            ['CV / Resume:', app.cv_file ? '✅ Submitted' : '❌ Missing'],
            ['National ID:', app.national_id_file ? '✅ Submitted' : '❌ Missing'],
            ['Introduction Letter:', app.introduction_letter_file ? '✅ Submitted' : '❌ Missing'],
            ['Passport Photo:', app.passport_photo_file ? '✅ Submitted' : '❌ Missing'],
            ['Application Letter:', app.application_letter_file ? '✅ Submitted' : 'Not Provided'],
            ['Certificate:', app.certificate_file ? '✅ Submitted' : 'Not Provided'],
            ['Other Documents:', app.other_docs_file ? '✅ Submitted' : 'Not Provided']
        ];
        docFields.forEach(([label, value]) => {
            doc.text(label, margin + 10, yPos, { width: 140 });
            doc.fillColor(value.includes('✅') ? BRANDING.successColor : (value.includes('❌') ? BRANDING.dangerColor : BRANDING.textGray))
               .text(value, margin + 160, yPos);
            doc.fillColor(BRANDING.darkGray);
            yPos += 16;
        });

        // Footer
        const footerY = doc.page.height - 40;
        doc.strokeColor('#3498db').lineWidth(1).moveTo(margin, footerY).lineTo(pageWidth - margin, footerY).stroke();
        doc.fillColor('#95a5a6').fontSize(7).font('Helvetica')
           .text(`Generated by CleanSpark on ${new Date().toLocaleDateString()} | Reference: ${app.reference_number}`,
                 margin, footerY + 8, { align: 'center', width: contentWidth });

        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
    });
};

// ==================== HELPERS ====================

const getStatusLabel = (status) => {
    const labels = {
        'pending': 'Pending', 'reviewed': 'Under Review', 'shortlisted': 'Shortlisted',
        'rejected': 'Rejected', 'hired': 'Approved'
    };
    return labels[status] || status;
};

const getStatusColor = (status) => {
    const colors = {
        'pending': '#f39c12', 'reviewed': '#3498db', 'shortlisted': '#9b59b6',
        'rejected': '#e74c3c', 'hired': '#27ae60'
    };
    return colors[status] || '#95a5a6';
};

const getEducationLabel = (level) => {
    const labels = { 'elementary': 'Elementary School', 'highschool': 'High School', 'diploma': 'Diploma', 'degree': 'Bachelor Degree', 'masters': 'Masters Degree', 'phd': 'PhD' };
    return labels[level] || level;
};

const getAvailabilityLabel = (availability) => {
    const labels = { 'immediately': 'Immediately', '2_weeks': '2 Weeks', '1_month': '1 Month' };
    return labels[availability] || availability;
};

const getCurrentStage = (status) => {
    const stages = { 'pending': 'Application Received', 'reviewed': 'Under Review', 'shortlisted': 'Shortlisted', 'rejected': 'Not Selected', 'hired': 'Hired' };
    return stages[status] || status;
};

const getProgressPercentage = (status) => {
    const progress = { 'pending': 25, 'reviewed': 50, 'shortlisted': 75, 'rejected': 100, 'hired': 100 };
    return progress[status] || 0;
};

const buildTrackingData = (app, includePersonal = false) => {
    const timeline = [
        { stage: 'Application Submitted', date: app.created_at, status: 'completed', icon: '📩', description: 'Your application has been received' }
    ];
    if (['reviewed', 'shortlisted', 'rejected', 'hired'].includes(app.status)) {
        timeline.push({ stage: 'Application Reviewed', date: app.reviewed_at, status: 'completed', icon: '👀', description: 'Your application has been reviewed' });
    }
    if (app.status === 'shortlisted') {
        timeline.push({ stage: 'Shortlisted', date: app.reviewed_at, status: 'completed', icon: '⭐', description: 'You have been shortlisted' });
        timeline.push({ stage: 'Interview', date: null, status: 'pending', icon: '🎤', description: 'Awaiting interview' });
        timeline.push({ stage: 'Final Decision', date: null, status: 'pending', icon: '🏆', description: 'Pending final selection' });
    }
    if (app.status === 'rejected') {
        timeline.push({ stage: 'Not Selected', date: app.reviewed_at, status: 'completed', icon: '❌', description: 'Other candidates selected' });
    }
    if (app.status === 'hired') {
        timeline.push({ stage: 'Shortlisted', date: app.reviewed_at, status: 'completed', icon: '⭐', description: 'Shortlisted' });
        timeline.push({ stage: 'Interview Passed', date: app.reviewed_at, status: 'completed', icon: '🎤', description: 'Interview passed' });
        timeline.push({ stage: 'Hired!', date: app.reviewed_at, status: 'completed', icon: '🎉', description: 'Welcome to CleanSpark!' });
    }
    const data = {
        reference_number: app.reference_number, position: app.position_applying,
        status: app.status, status_label: getStatusLabel(app.status),
        current_stage: getCurrentStage(app.status), progress_percentage: getProgressPercentage(app.status),
        timeline, review: app.review_notes ? { notes: app.review_notes, date: app.reviewed_at } : null, date: app.created_at
    };
    if (includePersonal) {
        data.personal_info = { full_name: app.full_name, email: app.email, phone: app.phone };
        data.professional_info = { education: getEducationLabel(app.education_level), experience: `${app.experience_years} years`, skills: app.skills, availability: getAvailabilityLabel(app.availability) };
    }
    return data;
};

module.exports = {
    getSettings, updateSettings, getStats,
    submitApplication, getMyApplications, trackByReference, trackMyApplication,
    getApplications, getSingleApplication, reviewApplication, removeApplication,
    downloadApplicationPDF, viewApplicationPDF
};