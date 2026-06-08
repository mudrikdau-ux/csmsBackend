const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const {
    saveReport,
    getReportById,
    getAllReports,
    getBookingTrends,
    getBookingStatusDistribution,
    getBookingByService,
    getBookingByLocation,
    getRevenueStats,
    getRevenueByPaymentMethod,
    getRevenueSummary,
    getStaffReportData,
    getContractorStats,
    getContractorExpiringSoon,
    getComprehensiveReport,
    getCachedData,
    setCachedData
} = require('../models/reportModel');

// Ensure reports directory exists
const reportsDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
}

// In-memory storage for reports
const reports = [];
let reportIdCounter = 1;

// Company colors and branding
const BRANDING = {
    primaryColor: '#0B2B40',
    secondaryColor: '#1E6F5C',
    accentColor: '#F2A65A',
    successColor: '#2E8B57',
    warningColor: '#E9C46A',
    dangerColor: '#E76F51',
    lightGray: '#F4F6F9',
    mediumGray: '#E0E5EC',
    darkGray: '#2D3E50',
    white: '#FFFFFF',
    gold: '#D4AF37',
    
    companyName: 'CleanSpark',
    tagline: 'Professional Cleaning Services',
    address: 'Stone Town, Zanzibar',
    phone: '+255 777 000 000',
    email: 'info@cleanspark.co.tz',
    website: 'www.cleanspark.co.tz',
    registration: 'Reg: ZNSB-2024-0782'
};

// ==================== REPORT GENERATION ====================

const generateReport = async (req, res) => {
    try {
        const { date_from, date_to, report_type, format } = req.body;

        if (!date_from || !date_to || !report_type || !format) {
            return res.status(400).json({
                message: 'All fields are required',
                required: ['date_from', 'date_to', 'report_type', 'format']
            });
        }

        if (new Date(date_to) < new Date(date_from)) {
            return res.status(400).json({ message: 'End date must be after start date' });
        }

        const validTypes = ['comprehensive', 'booking', 'revenue', 'contractors', 'staff_report'];
        if (!validTypes.includes(report_type)) {
            return res.status(400).json({ message: 'Invalid report type', valid_types: validTypes });
        }

        const validFormats = ['detailed', 'summary'];
        if (!validFormats.includes(format)) {
            return res.status(400).json({ message: 'Invalid format', valid_formats: validFormats });
        }

        let reportData = await generateReportData(report_type, format, date_from, date_to);

        let filePath = null;
        if (req.query.download === 'true') {
            filePath = await generateProfessionalPDF(report_type, format, date_from, date_to, reportData);
        }

        const report = {
            id: reportIdCounter++,
            report_type,
            format,
            date_range: { from: date_from, to: date_to },
            generated_by: req.user?.email || 'admin@cleanspark.co.tz',
            file_path: filePath,
            data: reportData,
            created_at: new Date().toISOString()
        };
        reports.unshift(report);

        // Save to database
        await saveReport({
            report_type,
            report_format: format,
            date_from,
            date_to,
            generated_by: req.user.id,
            file_path: filePath,
            report_data: reportData
        });

        res.status(201).json({
            success: true,
            message: 'Report generated successfully',
            report: {
                id: report.id,
                report_type,
                report_format: format,
                date_range: { from: date_from, to: date_to },
                generated_by: report.generated_by,
                file_path: filePath ? `/reports/${filePath}` : null,
                data: reportData
            }
        });

    } catch (error) {
        console.error('Generate report error:', error);
        res.status(500).json({ success: false, message: 'Failed to generate report', error: error.message });
    }
};

// ==================== GENERATE REPORT DATA ====================

const generateReportData = async (type, format, dateFrom, dateTo) => {
    switch (type) {
        case 'comprehensive':
            return await getComprehensiveReport(dateFrom, dateTo);
        
        case 'booking':
            return {
                date_range: { from: dateFrom, to: dateTo },
                trends: await getBookingTrends(dateFrom, dateTo),
                status_distribution: await getBookingStatusDistribution(dateFrom, dateTo),
                by_service: await getBookingByService(dateFrom, dateTo),
                by_location: await getBookingByLocation(dateFrom, dateTo)
            };
        
        case 'revenue':
            return {
                date_range: { from: dateFrom, to: dateTo },
                daily_stats: await getRevenueStats(dateFrom, dateTo),
                by_payment_method: await getRevenueByPaymentMethod(dateFrom, dateTo),
                summary: await getRevenueSummary(dateFrom, dateTo)
            };
        
        case 'staff_report':
            return await getStaffReportData(dateFrom, dateTo);
        
        case 'contractors':
            return {
                date_range: { from: dateFrom, to: dateTo },
                contractor_stats: await getContractorStats(dateFrom, dateTo),
                expiring_soon: await getContractorExpiringSoon(30)
            };
        
        default:
            return { message: 'No data available for selected report type' };
    }
};

// ==================== PROFESSIONAL PDF GENERATION ====================

const generateProfessionalPDF = async (type, format, dateFrom, dateTo, data) => {
    return new Promise((resolve, reject) => {
        const filename = `CleanSpark_${type}_${dateFrom}_to_${dateTo}_${Date.now()}.pdf`;
        const filePath = path.join(reportsDir, filename);
        
        const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        generateCoverPage(doc, type, dateFrom, dateTo);
        generateExecutiveSummary(doc, data);
        
        if (type === 'staff_report') {
            generateStaffReportContent(doc, data, format);
        } else if (format === 'detailed') {
            generatePerformanceDashboard(doc, type, data);
            generateDataTables(doc, type, data, dateFrom, dateTo);
            generateKeyInsights(doc, data);
        }
        
        generateFooterBand(doc);
        addWatermarkAndFooters(doc);
        
        doc.end();

        stream.on('finish', () => resolve(filename));
        stream.on('error', reject);
    });
};

// ==================== STAFF REPORT SPECIFIC CONTENT ====================

const generateStaffReportContent = (doc, data, format) => {
    doc.addPage();
    
    // Header
    doc.rect(0, 0, doc.page.width, 95).fill(BRANDING.primaryColor);
    doc.rect(0, 90, doc.page.width, 8).fill(BRANDING.gold);
    doc.fontSize(24).font('Helvetica-Bold').fillColor(BRANDING.white)
       .text('Staff Report', 50, 35);
    doc.fontSize(11).font('Helvetica').fillColor('#BDC3C7')
       .text('Complete staff directory with performance metrics', 50, 68);
    
    let currentY = 130;
    
    // Staff Summary Cards
    if (data.summary) {
        const cardWidth = (doc.page.width - 130) / 3;
        const cardHeight = 80;
        let cardX = 50;
        
        const summaryItems = [
            { label: 'Total Staff', value: data.summary.total_staff, icon: '👥' },
            { label: 'Supervisors', value: data.summary.total_supervisors, icon: '👔' },
            { label: 'General Supervisors', value: data.summary.total_general_supervisors, icon: '⭐' },
            { label: 'Normal Staff', value: data.summary.total_normal_staff, icon: '👤' },
            { label: 'Avg Rating', value: data.summary.average_rating, icon: '⭐' },
            { label: 'Total Ratings', value: data.summary.total_customer_ratings, icon: '💬' }
        ];
        
        summaryItems.forEach((item, index) => {
            const colIndex = index % 3;
            if (colIndex === 0 && index > 0) {
                cardX = 50;
                currentY += cardHeight + 15;
            }
            
            doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 8)
               .fill(BRANDING.white);
            doc.roundedRect(cardX, currentY, cardWidth, cardHeight, 8)
               .stroke(BRANDING.mediumGray);
            doc.rect(cardX, currentY, cardWidth, 4).fill(BRANDING.accentColor);
            
            doc.fontSize(20).fillColor(BRANDING.darkGray)
               .text(item.icon, cardX + 15, currentY + 15);
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#7F8C8D')
               .text(item.label.toUpperCase(), cardX + 50, currentY + 18);
            doc.fontSize(22).font('Helvetica-Bold').fillColor(BRANDING.secondaryColor)
               .text(item.value.toString(), cardX + 50, currentY + 40);
            
            cardX += cardWidth + 15;
        });
        
        currentY += cardHeight + 30;
    }
    
    // Totals Section
    if (data.totals) {
        doc.roundedRect(50, currentY, doc.page.width - 100, 70, 8)
           .fill(BRANDING.lightGray);
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
           .text('Overall Staff Performance', 70, currentY + 15);
        
        const totals = [
            { label: 'Total Jobs', value: data.totals.total_jobs },
            { label: 'Completed Jobs', value: data.totals.total_completed_jobs },
            { label: 'Total Revenue', value: `TZS ${data.totals.total_revenue.toLocaleString()}` },
            { label: 'Staff Earnings', value: `TZS ${data.totals.total_earnings.toLocaleString()}` },
            { label: 'Avg Completion Rate', value: `${data.totals.average_completion_rate}%` }
        ];
        
        let totalX = 70;
        totals.forEach(total => {
            doc.fontSize(8).font('Helvetica').fillColor('#7F8C8D')
               .text(total.label, totalX, currentY + 42);
            doc.fontSize(12).font('Helvetica-Bold').fillColor(BRANDING.secondaryColor)
               .text(total.value.toString(), totalX, currentY + 58);
            totalX += 110;
        });
        
        currentY += 90;
    }
    
    // Staff Distribution Chart
    if (data.staff_distribution) {
        doc.roundedRect(50, currentY, doc.page.width - 100, 140, 8)
           .fill(BRANDING.white);
        doc.roundedRect(50, currentY, doc.page.width - 100, 140, 8)
           .stroke(BRANDING.mediumGray);
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
           .text('Staff Distribution by Type', 70, currentY + 15);
        
        const chartData = data.staff_distribution;
        const maxValue = Math.max(...chartData.data);
        const barWidth = (doc.page.width - 220) / chartData.data.length;
        let barX = 70;
        
        chartData.labels.forEach((label, index) => {
            const barHeight = (chartData.data[index] / maxValue) * 80;
            const barY = currentY + 110 - barHeight;
            
            doc.rect(barX, barY, barWidth - 8, barHeight)
               .fill(BRANDING.secondaryColor);
            
            doc.fontSize(8).font('Helvetica').fillColor(BRANDING.darkGray)
               .text(label, barX, currentY + 118, { width: barWidth - 8, align: 'center' });
            doc.fontSize(10).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
               .text(chartData.data[index].toString(), barX, barY - 15, { width: barWidth - 8, align: 'center' });
            
            barX += barWidth;
        });
        
        currentY += 165;
    }
    
    // Top Performers
    if (data.top_performers && data.top_performers.length > 0) {
        doc.roundedRect(50, currentY, doc.page.width - 100, 50 + (data.top_performers.length * 25), 8)
           .fill(BRANDING.white);
        doc.roundedRect(50, currentY, doc.page.width - 100, 50 + (data.top_performers.length * 25), 8)
           .stroke(BRANDING.mediumGray);
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
           .text('🏆 Top Performing Staff', 70, currentY + 15);
        
        let rowY = currentY + 45;
        const col1 = 70, col2 = 200, col3 = 300, col4 = 400, col5 = 470;
        
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#7F8C8D');
        doc.text('Staff Name', col1, rowY);
        doc.text('Role', col2, rowY);
        doc.text('Completed', col3, rowY);
        doc.text('Rate', col4, rowY);
        doc.text('Rating', col5, rowY);
        rowY += 15;
        
        doc.fontSize(8).font('Helvetica');
        data.top_performers.forEach(performer => {
            doc.fillColor(BRANDING.darkGray);
            doc.text(performer.name, col1, rowY);
            doc.text(performer.staff_type, col2, rowY);
            doc.text(performer.completed_jobs.toString(), col3, rowY);
            doc.text(`${performer.completion_rate}%`, col4, rowY);
            doc.text(performer.rating.toFixed(1), col5, rowY);
            rowY += 20;
        });
        
        currentY += 55 + (data.top_performers.length * 25);
    }
    
    // Staff List Table - Complete Directory
    if (data.staff_list && data.staff_list.length > 0) {
        if (currentY > doc.page.height - 150) {
            doc.addPage();
            currentY = 50;
        }
        
        doc.roundedRect(50, currentY, doc.page.width - 100, 35, 6)
           .fill(BRANDING.secondaryColor);
        doc.fontSize(11).font('Helvetica-Bold').fillColor(BRANDING.white)
           .text('COMPLETE STAFF DIRECTORY', 70, currentY + 10);
        
        currentY += 45;
        
        const headers = ['Name', 'Role', 'Email', 'Phone', 'Total Jobs', 'Completed', 'Rate', 'Rating'];
        const colWidths = [130, 100, 140, 90, 70, 70, 60, 60];
        let headerX = 50;
        
        headers.forEach((header, index) => {
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#7F8C8D')
               .text(header, headerX + 5, currentY, { width: colWidths[index] - 10 });
            headerX += colWidths[index];
        });
        
        currentY += 18;
        
        data.staff_list.forEach(staff => {
            if (currentY > doc.page.height - 80) {
                doc.addPage();
                currentY = 50;
                
                // Re-draw header on new page
                doc.roundedRect(50, currentY, doc.page.width - 100, 35, 6)
                   .fill(BRANDING.secondaryColor);
                doc.fontSize(11).font('Helvetica-Bold').fillColor(BRANDING.white)
                   .text('COMPLETE STAFF DIRECTORY', 70, currentY + 10);
                currentY += 45;
                
                headerX = 50;
                headers.forEach((header, index) => {
                    doc.fontSize(7).font('Helvetica-Bold').fillColor('#7F8C8D')
                       .text(header, headerX + 5, currentY, { width: colWidths[index] - 10 });
                    headerX += colWidths[index];
                });
                currentY += 18;
            }
            
            let cellX = 50;
            const rowColor = data.staff_list.indexOf(staff) % 2 === 0 ? BRANDING.white : BRANDING.lightGray;
            doc.rect(cellX, currentY - 5, doc.page.width - 100, 22).fill(rowColor);
            
            doc.fontSize(7).font('Helvetica').fillColor(BRANDING.darkGray);
            doc.text(staff.personal_info.full_name, cellX + 5, currentY, { width: colWidths[0] - 10 });
            cellX += colWidths[0];
            doc.text(staff.personal_info.staff_type_label, cellX + 5, currentY, { width: colWidths[1] - 10 });
            cellX += colWidths[1];
            doc.text(staff.personal_info.email, cellX + 5, currentY, { width: colWidths[2] - 10 });
            cellX += colWidths[2];
            doc.text(staff.personal_info.phone, cellX + 5, currentY, { width: colWidths[3] - 10 });
            cellX += colWidths[3];
            doc.text(staff.job_statistics.total_jobs.toString(), cellX + 5, currentY, { width: colWidths[4] - 10 });
            cellX += colWidths[4];
            doc.text(staff.job_statistics.completed_jobs.toString(), cellX + 5, currentY, { width: colWidths[5] - 10 });
            cellX += colWidths[5];
            doc.text(`${staff.job_statistics.completion_rate}%`, cellX + 5, currentY, { width: colWidths[6] - 10 });
            cellX += colWidths[6];
            doc.text(staff.ratings.overall_rating.toFixed(1), cellX + 5, currentY, { width: colWidths[7] - 10 });
            
            currentY += 20;
        });
    }
};

// ==================== COVER PAGE ====================

const generateCoverPage = (doc, type, dateFrom, dateTo) => {
    const centerX = doc.page.width / 2;
    
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(BRANDING.primaryColor);
    
    for (let i = 0; i < 20; i++) {
        doc.opacity(0.03)
           .circle(50 + (i * 35), 100 + (i * 25), 40)
           .fill(BRANDING.white);
    }
    
    doc.opacity(1);
    doc.roundedRect(40, 80, doc.page.width - 80, doc.page.height - 160, 20)
       .fill(BRANDING.white);
    doc.rect(40, 80, doc.page.width - 80, 8).fill(BRANDING.gold);
    
    doc.circle(centerX, 160, 45).fill(BRANDING.secondaryColor);
    doc.circle(centerX, 160, 38).fill(BRANDING.white);
    doc.fontSize(34).font('Helvetica-Bold').fillColor(BRANDING.secondaryColor)
       .text('CS', centerX - 18, 142);
    
    doc.fontSize(32).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
       .text(BRANDING.companyName, 50, 230, { align: 'center' });
    doc.fontSize(13).font('Helvetica').fillColor(BRANDING.secondaryColor)
       .text(BRANDING.tagline, 50, 270, { align: 'center' });
    
    doc.moveTo(centerX - 120, 295).lineTo(centerX + 120, 295)
       .stroke(BRANDING.gold).lineWidth(2);
    
    const reportTitle = type === 'staff_report' ? 'STAFF REPORT' : type.replace(/_/g, ' ').toUpperCase();
    doc.fontSize(26).font('Helvetica-Bold').fillColor(BRANDING.darkGray)
       .text(`${reportTitle}`, 50, 325, { align: 'center' });
    
    const infoBoxY = 380;
    doc.roundedRect(60, infoBoxY, doc.page.width - 120, 130, 12)
       .fill(BRANDING.lightGray);
    
    doc.fontSize(10).font('Helvetica').fillColor(BRANDING.darkGray);
    const leftColX = 85;
    let lineY = infoBoxY + 25;
    
    doc.font('Helvetica-Bold').text('PERIOD:', leftColX, lineY);
    doc.font('Helvetica').text(`${dateFrom} — ${dateTo}`, leftColX + 100, lineY);
    
    lineY += 28;
    doc.font('Helvetica-Bold').text('REPORT TYPE:', leftColX, lineY);
    doc.font('Helvetica').text(reportTitle, leftColX + 100, lineY);
    
    lineY += 28;
    doc.font('Helvetica-Bold').text('FORMAT:', leftColX, lineY);
    doc.font('Helvetica').text(format.toUpperCase(), leftColX + 100, lineY);
    
    lineY += 28;
    doc.font('Helvetica-Bold').text('GENERATED:', leftColX, lineY);
    doc.font('Helvetica').text(new Date().toLocaleDateString('en-GB'), leftColX + 100, lineY);
    
    doc.fontSize(8).fillColor('#95A5A6')
       .text(`${BRANDING.companyName} | ${BRANDING.address} | ${BRANDING.phone} | ${BRANDING.email}`,
             50, doc.page.height - 70, { align: 'center' });
    doc.fontSize(7).fillColor('#BDC3C7')
       .text('CONFIDENTIAL DOCUMENT — PROPRIETARY INFORMATION', 50, doc.page.height - 50, { align: 'center' });
};

// ==================== EXECUTIVE SUMMARY ====================

const generateExecutiveSummary = (doc, data) => {
    doc.addPage();
    
    doc.rect(0, 0, doc.page.width, 95).fill(BRANDING.primaryColor);
    doc.rect(0, 90, doc.page.width, 8).fill(BRANDING.gold);
    doc.fontSize(24).font('Helvetica-Bold').fillColor(BRANDING.white)
       .text('Executive Summary', 50, 35);
    doc.fontSize(11).font('Helvetica').fillColor('#BDC3C7')
       .text('Performance overview and key metrics', 50, 68);
    
    let currentY = 130;
    
    if (data.summary && Object.keys(data.summary).length > 0) {
        const cardWidth = (doc.page.width - 130) / 2;
        const cardHeight = 85;
        let cardX = 50;
        let cardY = currentY;
        let cardIndex = 0;
        
        const summaryEntries = Object.entries(data.summary);
        
        for (const [key, value] of summaryEntries) {
            if (cardIndex > 0 && cardIndex % 2 === 0) {
                cardX = 50;
                cardY += cardHeight + 15;
            }
            
            doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 8)
               .fill(BRANDING.white);
            doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 8)
               .stroke(BRANDING.mediumGray);
            doc.rect(cardX, cardY, cardWidth, 4).fill(BRANDING.accentColor);
            
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#7F8C8D')
               .text(label.toUpperCase(), cardX + 15, cardY + 18, { width: cardWidth - 30 });
            
            const displayValue = typeof value === 'number' ? 
                (value > 1000 ? value.toLocaleString() : value.toString()) : value;
            doc.fontSize(20).font('Helvetica-Bold').fillColor(BRANDING.secondaryColor)
               .text(displayValue, cardX + 15, cardY + 40, { width: cardWidth - 30 });
            
            cardX += cardWidth + 15;
            cardIndex++;
        }
        
        currentY = cardY + cardHeight + 40;
    }
    
    if (data.totals) {
        doc.roundedRect(50, currentY, doc.page.width - 100, 100, 10)
           .fill(BRANDING.lightGray);
        
        doc.fontSize(12).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
           .text('Key Performance Indicators', 70, currentY + 18);
        
        const metrics = [
            { label: 'Total Jobs', value: data.totals.total_jobs },
            { label: 'Completed Jobs', value: data.totals.total_completed_jobs },
            { label: 'Completion Rate', value: `${data.totals.average_completion_rate}%` },
            { label: 'Total Revenue', value: `TZS ${data.totals.total_revenue.toLocaleString()}` }
        ];
        
        let metricX = 70;
        metrics.forEach(metric => {
            doc.fontSize(8).font('Helvetica').fillColor('#7F8C8D')
               .text(metric.label, metricX, currentY + 42);
            doc.fontSize(14).font('Helvetica-Bold').fillColor(BRANDING.secondaryColor)
               .text(metric.value.toString(), metricX, currentY + 58);
            metricX += 150;
        });
    }
};

const generatePerformanceDashboard = (doc, type, data) => {
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 95).fill(BRANDING.primaryColor);
    doc.rect(0, 90, doc.page.width, 8).fill(BRANDING.gold);
    doc.fontSize(24).font('Helvetica-Bold').fillColor(BRANDING.white)
       .text('Performance Dashboard', 50, 35);
    doc.fontSize(11).font('Helvetica').fillColor('#BDC3C7')
       .text('Visual analytics and trend analysis', 50, 68);
};

const generateDataTables = (doc, type, data, dateFrom, dateTo) => {
    // Simplified - can be expanded as needed
    if (data.by_service && data.by_service.length > 0) {
        doc.addPage();
        currentY = 130;
        
        doc.roundedRect(50, currentY, doc.page.width - 100, 35, 6)
           .fill(BRANDING.secondaryColor);
        doc.fontSize(11).font('Helvetica-Bold').fillColor(BRANDING.white)
           .text('BOOKINGS BY SERVICE', 70, currentY + 10);
        
        currentY += 45;
        
        const headers = ['Service', 'Bookings', 'Revenue (TZS)'];
        const colWidths = [250, 100, 150];
        let headerX = 50;
        
        headers.forEach((header, index) => {
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#7F8C8D')
               .text(header, headerX + 10, currentY, { width: colWidths[index] - 20 });
            headerX += colWidths[index];
        });
        
        currentY += 18;
        
        data.by_service.forEach(service => {
            let cellX = 50;
            doc.fontSize(8).font('Helvetica').fillColor(BRANDING.darkGray);
            doc.text(service.service_name, cellX + 10, currentY, { width: colWidths[0] - 20 });
            cellX += colWidths[0];
            doc.text(service.booking_count.toString(), cellX + 10, currentY, { width: colWidths[1] - 20 });
            cellX += colWidths[1];
            doc.text(service.total_revenue.toLocaleString(), cellX + 10, currentY, { width: colWidths[2] - 20 });
            currentY += 18;
        });
    }
};

const generateKeyInsights = (doc, data) => {
    doc.addPage();
    
    doc.rect(0, 0, doc.page.width, 95).fill(BRANDING.primaryColor);
    doc.rect(0, 90, doc.page.width, 8).fill(BRANDING.gold);
    doc.fontSize(24).font('Helvetica-Bold').fillColor(BRANDING.white)
       .text('Key Insights & Recommendations', 50, 35);
    doc.fontSize(11).font('Helvetica').fillColor('#BDC3C7')
       .text('Strategic takeaways and action items', 50, 68);
    
    let currentY = 130;
    
    const insights = [
        { icon: '📈', title: 'Growth Opportunity', description: 'Booking volume shows consistent upward trend. Consider expanding service capacity.', color: BRANDING.successColor },
        { icon: '💰', title: 'Revenue Optimization', description: 'Premium services contribute significantly to total revenue. Increase marketing focus.', color: BRANDING.accentColor },
        { icon: '⭐', title: 'Staff Performance', description: 'Top performers exceed targets. Implement recognition program to motivate staff.', color: BRANDING.gold },
        { icon: '👥', title: 'Team Development', description: 'Consider additional training for underperforming staff to improve overall metrics.', color: BRANDING.secondaryColor }
    ];
    
    const cardWidth = (doc.page.width - 130) / 2;
    const cardHeight = 110;
    let cardX = 50;
    let cardY = currentY;
    
    insights.forEach((insight, index) => {
        if (index > 0 && index % 2 === 0) {
            cardX = 50;
            cardY += cardHeight + 15;
        }
        
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 10)
           .fill(BRANDING.white);
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 10)
           .stroke(BRANDING.mediumGray);
        
        doc.circle(cardX + 25, cardY + 25, 18).fill(insight.color);
        doc.fontSize(16).fillColor(BRANDING.white)
           .text(insight.icon, cardX + 18, cardY + 20);
        
        doc.fontSize(11).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
           .text(insight.title, cardX + 55, cardY + 18);
        
        doc.fontSize(8).font('Helvetica').fillColor(BRANDING.darkGray)
           .text(insight.description, cardX + 15, cardY + 50, { width: cardWidth - 30, lineGap: 3 });
        
        cardX += cardWidth + 15;
    });
};

const generateFooterBand = (doc) => {
    doc.addPage();
    
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(BRANDING.primaryColor);
    doc.circle(doc.page.width - 80, 80, 100).fill(BRANDING.secondaryColor).opacity(0.1);
    doc.circle(80, doc.page.height - 80, 120).fill(BRANDING.secondaryColor).opacity(0.1);
    
    doc.opacity(1);
    doc.fontSize(28).font('Helvetica-Bold').fillColor(BRANDING.gold)
       .text('Thank You', 50, doc.page.height / 2 - 60, { align: 'center' });
    doc.fontSize(13).font('Helvetica').fillColor(BRANDING.white)
       .text('For your continued trust in CleanSpark Professional Services', 50, doc.page.height / 2 - 20, { align: 'center' });
    
    doc.moveTo(doc.page.width / 2 - 100, doc.page.height / 2 + 10)
       .lineTo(doc.page.width / 2 + 100, doc.page.height / 2 + 10)
       .stroke(BRANDING.gold).lineWidth(1.5);
    
    doc.fontSize(9).fillColor('#BDC3C7')
       .text(BRANDING.address, 50, doc.page.height - 100, { align: 'center' });
    doc.text(`${BRANDING.phone}  |  ${BRANDING.email}  |  ${BRANDING.website}`, 50, doc.page.height - 80, { align: 'center' });
    doc.text(BRANDING.registration, 50, doc.page.height - 60, { align: 'center' });
};

const addWatermarkAndFooters = (doc) => {
    const pages = doc.bufferedPageRange();
    const totalPages = pages.count;
    
    for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        
        if (i !== 0 && i !== totalPages - 1) {
            doc.opacity(0.03)
               .fontSize(50).font('Helvetica-Bold')
               .fillColor(BRANDING.primaryColor)
               .text('CONFIDENTIAL', doc.page.width / 2 - 120, doc.page.height / 2 - 20, 
                     { align: 'center', rotate: 45 });
            doc.opacity(1);
        }
        
        doc.moveTo(50, doc.page.height - 55).lineTo(doc.page.width - 50, doc.page.height - 55)
           .stroke('#E0E5EC').lineWidth(0.5);
        
        doc.fontSize(7).font('Helvetica').fillColor('#95A5A6')
           .text(`${BRANDING.companyName} · Confidential Report`, 50, doc.page.height - 45);
        doc.text(`Page ${i + 1} of ${totalPages}`, doc.page.width - 100, doc.page.height - 45, 
                { width: 80, align: 'right' });
        doc.fontSize(6).fillColor('#BDC3C7')
           .text(`Generated on ${new Date().toLocaleString()}`, 50, doc.page.height - 35);
    }
};

// ==================== REPORT HISTORY ====================

const getReportHistory = async (req, res) => {
    try {
        const { report_type, date_from, date_to } = req.query;
        let filteredReports = [...reports];

        if (report_type) {
            filteredReports = filteredReports.filter(r => r.report_type === report_type);
        }
        if (date_from) {
            filteredReports = filteredReports.filter(r => r.date_range.from >= date_from);
        }
        if (date_to) {
            filteredReports = filteredReports.filter(r => r.date_range.to <= date_to);
        }

        filteredReports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({
            success: true,
            count: filteredReports.length,
            reports: filteredReports.map(r => ({
                id: r.id,
                report_type: r.report_type,
                report_format: r.format,
                date_range: r.date_range,
                generated_by: r.generated_by,
                created_at: r.created_at,
                has_file: r.file_path ? true : false
            }))
        });

    } catch (error) {
        console.error('Get report history error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch report history', error: error.message });
    }
};

const downloadReport = async (req, res) => {
    try {
        const { id } = req.params;
        const report = reports.find(r => r.id === parseInt(id));

        if (!report) {
            return res.status(404).json({ message: 'Report not found' });
        }

        if (report.file_path) {
            const filePath = path.join(reportsDir, report.file_path);
            if (fs.existsSync(filePath)) {
                const downloadName = `${BRANDING.companyName}_${report.report_type}_${report.date_range.from}_to_${report.date_range.to}.pdf`;
                return res.download(filePath, downloadName);
            }
        }

        const pdfBuffer = await generatePDFBuffer(report.report_type, report.format, report.date_range.from, report.date_range.to, report.data);
        const downloadName = `${BRANDING.companyName}_${report.report_type}_${report.date_range.from}_to_${report.date_range.to}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
        res.send(pdfBuffer);

    } catch (error) {
        console.error('Download report error:', error);
        res.status(500).json({ success: false, message: 'Failed to download report', error: error.message });
    }
};

const generatePDFBuffer = (type, format, dateFrom, dateTo, data) => {
    return new Promise((resolve) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        doc.rect(0, 0, doc.page.width, 80).fill(BRANDING.primaryColor);
        doc.fontSize(20).font('Helvetica-Bold').fillColor(BRANDING.white)
           .text(BRANDING.companyName, 50, 25);
        doc.fontSize(12).fillColor(BRANDING.white)
           .text(`${type.replace('_', ' ').toUpperCase()} REPORT`, 50, 55);
        doc.fontSize(9).fillColor('#BDC3C7')
           .text(`Period: ${dateFrom} to ${dateTo}`, 50, 72);
        
        doc.moveDown(3);
        
        if (data.summary) {
            doc.fontSize(14).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
               .text('Executive Summary', 50);
            doc.moveDown(0.5);
            
            doc.fontSize(10).font('Helvetica').fillColor(BRANDING.darkGray);
            Object.entries(data.summary).forEach(([key, value]) => {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                doc.text(`${label}: ${value}`, 50, null, { lineGap: 4 });
            });
        }
        
        doc.end();
    });
};

// ==================== ANALYTICS ENDPOINTS ====================

const getBookingAnalytics = async (req, res) => {
    try {
        const dateFrom = req.query.date_from || '2026-01-01';
        const dateTo = req.query.date_to || new Date().toISOString().split('T')[0];
        
        const trends = await getBookingTrends(dateFrom, dateTo);
        const statusDistribution = await getBookingStatusDistribution(dateFrom, dateTo);
        const byService = await getBookingByService(dateFrom, dateTo);
        const byLocation = await getBookingByLocation(dateFrom, dateTo);

        res.json({
            success: true,
            data: {
                date_range: { from: dateFrom, to: dateTo },
                trends,
                status_distribution: statusDistribution,
                by_service: byService,
                by_location: byLocation
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch booking analytics', error: error.message });
    }
};

const getRevenueAnalytics = async (req, res) => {
    try {
        const dateFrom = req.query.date_from || '2026-01-01';
        const dateTo = req.query.date_to || new Date().toISOString().split('T')[0];
        
        const dailyStats = await getRevenueStats(dateFrom, dateTo);
        const byPaymentMethod = await getRevenueByPaymentMethod(dateFrom, dateTo);
        const summary = await getRevenueSummary(dateFrom, dateTo);

        res.json({
            success: true,
            data: {
                date_range: { from: dateFrom, to: dateTo },
                daily_stats: dailyStats,
                by_payment_method: byPaymentMethod,
                summary
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch revenue analytics', error: error.message });
    }
};

const getDashboardSummary = async (req, res) => {
    try {
        const dateFrom = req.query.date_from || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
        const dateTo = req.query.date_to || new Date().toISOString().split('T')[0];
        
        const cacheKey = `dashboard_summary_${dateFrom}_${dateTo}`;
        let cachedData = await getCachedData(cacheKey);
        
        if (cachedData) {
            return res.json({ success: true, data: JSON.parse(cachedData) });
        }
        
        const bookingSummary = await getRevenueSummary(dateFrom, dateTo);
        const statusDistribution = await getBookingStatusDistribution(dateFrom, dateTo);
        const staffData = await getStaffReportData(dateFrom, dateTo);
        
        const dashboardData = {
            date_range: { from: dateFrom, to: dateTo },
            booking_summary: bookingSummary[0],
            status_distribution: statusDistribution,
            staff_summary: staffData.summary,
            top_performers: staffData.top_performers
        };
        
        await setCachedData(cacheKey, dashboardData, 30);
        
        res.json({ success: true, data: dashboardData });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch dashboard', error: error.message });
    }
};

module.exports = {
    generateReport,
    getReportHistory,
    downloadReport,
    getBookingAnalytics,
    getRevenueAnalytics,
    getDashboardSummary
};