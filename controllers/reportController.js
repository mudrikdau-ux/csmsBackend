const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Ensure reports directory exists
const reportsDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
}

// In-memory storage for reports
const reports = [];
let reportIdCounter = 1;

// Company colors and branding - Premium CleanSpark Identity
const BRANDING = {
    primaryColor: '#0B2B40',      // Deep teal - professional and calming
    secondaryColor: '#1E6F5C',    // Rich emerald green - growth and cleanliness
    accentColor: '#F2A65A',       // Warm amber - highlights and CTAs
    successColor: '#2E8B57',      // Sea green - positive metrics
    warningColor: '#E9C46A',      // Soft gold - warnings
    dangerColor: '#E76F51',       // Terracotta - alerts
    lightGray: '#F4F6F9',         // Subtle background
    mediumGray: '#E0E5EC',        // Borders and separators
    darkGray: '#2D3E50',          // Body text
    white: '#FFFFFF',
    gold: '#D4AF37',              // Premium accent
    
    // Company Details
    companyName: 'CleanSpark',
    tagline: 'Professional Cleaning Services',
    address: 'Stone Town, Zanzibar',
    phone: '+255 777 000 000',
    email: 'info@cleanspark.co.tz',
    website: 'www.cleanspark.co.tz',
    registration: 'Reg: ZNSB-2024-0782'
};

// ==================== PROFESSIONAL PDF GENERATION ====================

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

        const validTypes = ['comprehensive', 'booking', 'revenue', 'staff_performance', 'contractors'];
        if (!validTypes.includes(report_type)) {
            return res.status(400).json({ message: 'Invalid report type', valid_types: validTypes });
        }

        const validFormats = ['detailed', 'summary'];
        if (!validFormats.includes(format)) {
            return res.status(400).json({ message: 'Invalid format', valid_formats: validFormats });
        }

        let reportData = generateReportData(report_type, format, date_from, date_to);

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

// ==================== PROFESSIONAL PDF WITH BEAUTIFUL STYLING ====================

const generateProfessionalPDF = (type, format, dateFrom, dateTo, data) => {
    return new Promise((resolve, reject) => {
        const filename = `CleanSpark_${type}_${dateFrom}_to_${dateTo}_${Date.now()}.pdf`;
        const filePath = path.join(reportsDir, filename);
        
        // Create PDF with professional settings
        const doc = new PDFDocument({ 
            margin: 50, 
            size: 'A4', 
            bufferPages: true,
            info: {
                Title: `${BRANDING.companyName} - ${type.toUpperCase()} Report`,
                Author: BRANDING.companyName,
                Subject: `Performance Report for ${dateFrom} to ${dateTo}`,
                Keywords: `${type}, report, analytics, cleaning services`,
                Creator: BRANDING.companyName
            }
        });
        
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        // Generate all sections with consistent styling
        generateCoverPage(doc, type, dateFrom, dateTo);
        generateExecutiveSummary(doc, data);
        
        if (format === 'detailed') {
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

// ==================== BEAUTIFUL COVER PAGE ====================

const generateCoverPage = (doc, type, dateFrom, dateTo) => {
    const centerX = doc.page.width / 2;
    
    // Premium gradient-like background using shapes
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(BRANDING.primaryColor);
    
    // Decorative geometric pattern
    for (let i = 0; i < 20; i++) {
        doc.opacity(0.03)
           .circle(50 + (i * 35), 100 + (i * 25), 40)
           .fill(BRANDING.white);
    }
    
    // Main content card
    doc.opacity(1);
    doc.roundedRect(40, 80, doc.page.width - 80, doc.page.height - 160, 20)
       .fill(BRANDING.white);
    
    // Top accent bar
    doc.rect(40, 80, doc.page.width - 80, 8).fill(BRANDING.gold);
    
    // Company Logo Circle
    doc.circle(centerX, 160, 45).fill(BRANDING.secondaryColor);
    doc.circle(centerX, 160, 38).fill(BRANDING.white);
    doc.fontSize(34).font('Helvetica-Bold').fillColor(BRANDING.secondaryColor)
       .text('CS', centerX - 18, 142);
    
    // Company Name
    doc.fontSize(32).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
       .text(BRANDING.companyName, 50, 230, { align: 'center' });
    
    doc.fontSize(13).font('Helvetica').fillColor(BRANDING.secondaryColor)
       .text(BRANDING.tagline, 50, 270, { align: 'center' });
    
    // Gold Divider
    doc.moveTo(centerX - 120, 295).lineTo(centerX + 120, 295)
       .stroke(BRANDING.gold).lineWidth(2);
    
    // Report Title
    const reportTitle = type.replace(/_/g, ' ').toUpperCase();
    doc.fontSize(26).font('Helvetica-Bold').fillColor(BRANDING.darkGray)
       .text(`${reportTitle} REPORT`, 50, 325, { align: 'center' });
    
    // Info Box
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
    doc.font('Helvetica').text(new Date().toLocaleDateString('en-GB', { 
        day: '2-digit', month: 'long', year: 'numeric' 
    }), leftColX + 100, lineY);
    
    // Footer details
    doc.fontSize(8).fillColor('#95A5A6')
       .text(`${BRANDING.companyName} | ${BRANDING.address} | ${BRANDING.phone} | ${BRANDING.email}`,
             50, doc.page.height - 70, { align: 'center' });
    
    doc.fontSize(7).fillColor('#BDC3C7')
       .text('CONFIDENTIAL DOCUMENT — PROPRIETARY INFORMATION', 50, doc.page.height - 50, { align: 'center' });
};

// ==================== EXECUTIVE SUMMARY ====================

const generateExecutiveSummary = (doc, data) => {
    doc.addPage();
    
    // Header with gradient effect
    doc.rect(0, 0, doc.page.width, 95).fill(BRANDING.primaryColor);
    doc.rect(0, 90, doc.page.width, 8).fill(BRANDING.gold);
    
    doc.fontSize(24).font('Helvetica-Bold').fillColor(BRANDING.white)
       .text('Executive Summary', 50, 35);
    doc.fontSize(11).font('Helvetica').fillColor('#BDC3C7')
       .text('Performance overview and key metrics', 50, 68);
    
    let currentY = 130;
    
    // KPI Cards Grid
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
            
            // Card background with subtle shadow effect
            doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 8)
               .fill(BRANDING.white);
            doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 8)
               .stroke(BRANDING.mediumGray);
            
            // Accent line
            doc.rect(cardX, cardY, cardWidth, 4).fill(BRANDING.accentColor);
            
            // Label
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#7F8C8D')
               .text(label.toUpperCase(), cardX + 15, cardY + 18, { width: cardWidth - 30 });
            
            // Value
            const displayValue = typeof value === 'number' ? 
                (value > 1000 ? value.toLocaleString() : value.toString()) : value;
            doc.fontSize(20).font('Helvetica-Bold').fillColor(BRANDING.secondaryColor)
               .text(displayValue, cardX + 15, cardY + 40, { width: cardWidth - 30 });
            
            cardX += cardWidth + 15;
            cardIndex++;
        }
        
        currentY = cardY + cardHeight + 40;
    }
    
    // Narrative summary box
    doc.roundedRect(50, currentY, doc.page.width - 100, 100, 10)
       .fill(BRANDING.lightGray);
    
    doc.fontSize(12).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
       .text('Performance Overview', 70, currentY + 18);
    
    doc.fontSize(9).font('Helvetica').fillColor(BRANDING.darkGray)
       .text(`During the reporting period from ${data.date_range?.from || 'the selected dates'}, ` +
             `CleanSpark has demonstrated strong operational performance. ` +
             `Key metrics indicate positive growth trends with high customer satisfaction rates.`, 
             70, currentY + 42, { width: doc.page.width - 140, lineGap: 4 });
    
    doc.fontSize(9).font('Helvetica').fillColor(BRANDING.darkGray)
       .text(`The comprehensive analysis below provides detailed insights into ` +
             `booking patterns, revenue streams, and staff productivity.`, 
             70, currentY + 75, { width: doc.page.width - 140 });
};

// ==================== PERFORMANCE DASHBOARD WITH VISUALS ====================

const generatePerformanceDashboard = (doc, type, data) => {
    doc.addPage();
    
    // Page Header
    doc.rect(0, 0, doc.page.width, 95).fill(BRANDING.primaryColor);
    doc.rect(0, 90, doc.page.width, 8).fill(BRANDING.gold);
    
    doc.fontSize(24).font('Helvetica-Bold').fillColor(BRANDING.white)
       .text('Performance Dashboard', 50, 35);
    doc.fontSize(11).font('Helvetica').fillColor('#BDC3C7')
       .text('Visual analytics and trend analysis', 50, 68);
    
    let currentY = 130;
    
    // Charts Section
    if (data.charts && Object.keys(data.charts).length > 0) {
        const chartEntries = Object.entries(data.charts);
        
        for (let i = 0; i < Math.min(chartEntries.length, 2); i++) {
            const [chartName, chartData] = chartEntries[i];
            
            if (currentY > doc.page.height - 200) {
                doc.addPage();
                currentY = 50;
            }
            
            // Chart container
            doc.roundedRect(50, currentY, doc.page.width - 100, 120, 8)
               .fill(BRANDING.white);
            doc.roundedRect(50, currentY, doc.page.width - 100, 120, 8)
               .stroke(BRANDING.mediumGray);
            
            // Chart header
            doc.rect(50, currentY, doc.page.width - 100, 30).fill(BRANDING.lightGray);
            
            const chartTitle = chartName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            doc.fontSize(11).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
               .text(chartTitle, 70, currentY + 9);
            
            // Visual representation (simple bars for print)
            if (chartData.data && Array.isArray(chartData.data)) {
                const maxValue = Math.max(...chartData.data);
                const barWidth = (doc.page.width - 220) / chartData.data.length;
                let barX = 70;
                
                doc.fontSize(7).font('Helvetica').fillColor('#7F8C8D');
                
                for (let j = 0; j < chartData.data.length; j++) {
                    const barHeight = (chartData.data[j] / maxValue) * 50;
                    const barY = currentY + 95 - barHeight;
                    
                    doc.rect(barX, barY, barWidth - 4, barHeight)
                       .fill(BRANDING.secondaryColor);
                    
                    // Label
                    const label = chartData.labels && chartData.labels[j] ? 
                        chartData.labels[j] : `Item ${j+1}`;
                    doc.text(label, barX, currentY + 98, { 
                        width: barWidth - 4, 
                        align: 'center',
                        ellipsis: true
                    });
                    
                    // Value
                    doc.fontSize(6).font('Helvetica-Bold').fillColor(BRANDING.darkGray)
                       .text(chartData.data[j].toLocaleString(), barX, barY - 12, 
                             { width: barWidth - 4, align: 'center' });
                    
                    barX += barWidth;
                }
            }
            
            currentY += 150;
        }
    }
    
    // Metrics comparison table
    if (currentY < doc.page.height - 150) {
        doc.roundedRect(50, currentY, doc.page.width - 100, 80, 8)
           .fill(BRANDING.lightGray);
        
        doc.fontSize(10).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
           .text('Key Performance Indicators', 70, currentY + 15);
        
        const metrics = [
            { label: 'Growth Rate', value: '+15%', trend: 'up' },
            { label: 'Efficiency', value: '92%', trend: 'up' },
            { label: 'Satisfaction', value: '4.8/5', trend: 'up' }
        ];
        
        let metricX = 70;
        metrics.forEach(metric => {
            doc.fontSize(9).font('Helvetica').fillColor('#7F8C8D')
               .text(metric.label, metricX, currentY + 42);
            doc.fontSize(16).font('Helvetica-Bold').fillColor(BRANDING.secondaryColor)
               .text(metric.value, metricX, currentY + 55);
            metricX += 150;
        });
    }
};

// ==================== DATA TABLES WITH PREMIUM STYLING ====================

const generateDataTables = (doc, type, data, dateFrom, dateTo) => {
    if (!data.table_data || !data.table_data.headers || !data.table_data.rows) return;
    
    doc.addPage();
    
    // Page Header
    doc.rect(0, 0, doc.page.width, 95).fill(BRANDING.primaryColor);
    doc.rect(0, 90, doc.page.width, 8).fill(BRANDING.gold);
    
    doc.fontSize(24).font('Helvetica-Bold').fillColor(BRANDING.white)
       .text('Detailed Data Analysis', 50, 35);
    doc.fontSize(11).font('Helvetica').fillColor('#BDC3C7')
       .text('Comprehensive breakdown and statistics', 50, 68);
    
    const { headers, rows } = data.table_data;
    const colCount = headers.length;
    const tableWidth = doc.page.width - 100;
    const colWidth = tableWidth / colCount;
    const rowHeight = 35;
    let currentY = 130;
    
    // Table header with premium styling
    doc.roundedRect(50, currentY, tableWidth, rowHeight, 6)
       .fill(BRANDING.secondaryColor);
    doc.fontSize(9).font('Helvetica-Bold').fillColor(BRANDING.white);
    
    let headerX = 50;
    headers.forEach(header => {
        doc.text(header.toUpperCase(), headerX + 8, currentY + 12, 
                { width: colWidth - 16, align: 'left' });
        headerX += colWidth;
    });
    
    currentY += rowHeight;
    
    // Table rows with alternating colors
    rows.forEach((row, rowIndex) => {
        // Check page break
        if (currentY + rowHeight > doc.page.height - 80) {
            doc.addPage();
            // Recreate header on new page
            doc.rect(0, 0, doc.page.width, 95).fill(BRANDING.primaryColor);
            doc.rect(0, 90, doc.page.width, 8).fill(BRANDING.gold);
            
            currentY = 130;
            
            doc.roundedRect(50, currentY, tableWidth, rowHeight, 6)
               .fill(BRANDING.secondaryColor);
            doc.fontSize(9).font('Helvetica-Bold').fillColor(BRANDING.white);
            
            headerX = 50;
            headers.forEach(header => {
                doc.text(header.toUpperCase(), headerX + 8, currentY + 12, 
                        { width: colWidth - 16, align: 'left' });
                headerX += colWidth;
            });
            currentY += rowHeight;
        }
        
        // Row background
        if (rowIndex % 2 === 0) {
            doc.rect(50, currentY, tableWidth, rowHeight).fill(BRANDING.white);
        } else {
            doc.rect(50, currentY, tableWidth, rowHeight).fill(BRANDING.lightGray);
        }
        
        // Row border
        doc.rect(50, currentY, tableWidth, rowHeight).stroke(BRANDING.mediumGray);
        
        doc.fontSize(8).font('Helvetica').fillColor(BRANDING.darkGray);
        
        let cellX = 50;
        row.forEach(cell => {
            doc.text(String(cell), cellX + 8, currentY + 12, 
                    { width: colWidth - 16, align: 'left' });
            cellX += colWidth;
        });
        
        currentY += rowHeight;
    });
    
    // Table footer note
    if (currentY < doc.page.height - 60) {
        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#95A5A6')
           .text(`* Data shown for period: ${dateFrom} to ${dateTo}`, 50, currentY + 15);
    }
};

// ==================== KEY INSIGHTS SECTION ====================

const generateKeyInsights = (doc, data) => {
    doc.addPage();
    
    // Page Header
    doc.rect(0, 0, doc.page.width, 95).fill(BRANDING.primaryColor);
    doc.rect(0, 90, doc.page.width, 8).fill(BRANDING.gold);
    
    doc.fontSize(24).font('Helvetica-Bold').fillColor(BRANDING.white)
       .text('Key Insights & Recommendations', 50, 35);
    doc.fontSize(11).font('Helvetica').fillColor('#BDC3C7')
       .text('Strategic takeaways and action items', 50, 68);
    
    let currentY = 130;
    
    // Insight cards
    const insights = [
        { 
            icon: '📈', 
            title: 'Growth Opportunity', 
            description: 'Booking volume shows consistent upward trend. Consider expanding service capacity.',
            color: BRANDING.successColor
        },
        { 
            icon: '💰', 
            title: 'Revenue Optimization', 
            description: 'Premium services contribute 40% of total revenue. Increase marketing focus.',
            color: BRANDING.accentColor
        },
        { 
            icon: '⭐', 
            title: 'Customer Satisfaction', 
            description: '4.8/5 rating indicates strong service quality. Maintain current standards.',
            color: BRANDING.gold
        },
        { 
            icon: '👥', 
            title: 'Staff Performance', 
            description: 'Top performers exceed targets by 15%. Implement recognition program.',
            color: BRANDING.secondaryColor
        }
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
        
        // Card
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 10)
           .fill(BRANDING.white);
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 10)
           .stroke(BRANDING.mediumGray);
        
        // Icon circle
        doc.circle(cardX + 25, cardY + 25, 18).fill(insight.color);
        doc.fontSize(16).fillColor(BRANDING.white)
           .text(insight.icon, cardX + 18, cardY + 20);
        
        // Title
        doc.fontSize(11).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
           .text(insight.title, cardX + 55, cardY + 18);
        
        // Description
        doc.fontSize(8).font('Helvetica').fillColor(BRANDING.darkGray)
           .text(insight.description, cardX + 15, cardY + 50, 
                { width: cardWidth - 30, align: 'left', lineGap: 3 });
        
        cardX += cardWidth + 15;
    });
    
    currentY = cardY + cardHeight + 30;
    
    // Recommendation box
    doc.roundedRect(50, currentY, doc.page.width - 100, 90, 10)
       .fill(BRANDING.lightGray);
    
    doc.fontSize(12).font('Helvetica-Bold').fillColor(BRANDING.primaryColor)
       .text('📋 Actionable Recommendations', 70, currentY + 18);
    
    const recommendations = [
        '• Increase marketing efforts for premium service packages',
        '• Implement staff incentive program based on performance metrics',
        '• Expand weekend service availability to capture demand',
        '• Launch customer loyalty program to increase retention'
    ];
    
    doc.fontSize(9).font('Helvetica').fillColor(BRANDING.darkGray);
    let recY = currentY + 45;
    recommendations.forEach(rec => {
        doc.text(rec, 70, recY);
        recY += 18;
    });
};

// ==================== FOOTER BAND ====================

const generateFooterBand = (doc) => {
    // This creates a consistent footer band on a dedicated page or as a closing element
    doc.addPage();
    
    // Full page background
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(BRANDING.primaryColor);
    
    // Decorative elements
    doc.circle(doc.page.width - 80, 80, 100).fill(BRANDING.secondaryColor).opacity(0.1);
    doc.circle(80, doc.page.height - 80, 120).fill(BRANDING.secondaryColor).opacity(0.1);
    
    // Thank you message
    doc.opacity(1);
    doc.fontSize(28).font('Helvetica-Bold').fillColor(BRANDING.gold)
       .text('Thank You', 50, doc.page.height / 2 - 60, { align: 'center' });
    
    doc.fontSize(13).font('Helvetica').fillColor(BRANDING.white)
       .text('For your continued trust in CleanSpark Professional Services', 
             50, doc.page.height / 2 - 20, { align: 'center' });
    
    doc.moveTo(doc.page.width / 2 - 100, doc.page.height / 2 + 10)
       .lineTo(doc.page.width / 2 + 100, doc.page.height / 2 + 10)
       .stroke(BRANDING.gold).lineWidth(1.5);
    
    // Contact info
    doc.fontSize(9).fillColor('#BDC3C7')
       .text(BRANDING.address, 50, doc.page.height - 100, { align: 'center' });
    doc.text(`${BRANDING.phone}  |  ${BRANDING.email}  |  ${BRANDING.website}`, 
             50, doc.page.height - 80, { align: 'center' });
    doc.text(BRANDING.registration, 50, doc.page.height - 60, { align: 'center' });
};

// ==================== WATERMARK AND FOOTERS ====================

const addWatermarkAndFooters = (doc) => {
    const pages = doc.bufferedPageRange();
    const totalPages = pages.count;
    
    for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        
        // Subtle watermark on all pages except cover (page 0) and last page
        if (i !== 0 && i !== totalPages - 1) {
            doc.opacity(0.03)
               .fontSize(50).font('Helvetica-Bold')
               .fillColor(BRANDING.primaryColor)
               .text('CONFIDENTIAL', doc.page.width / 2 - 120, doc.page.height / 2 - 20, 
                     { align: 'center', rotate: 45 });
            doc.opacity(1);
        }
        
        // Footer line
        doc.moveTo(50, doc.page.height - 55).lineTo(doc.page.width - 50, doc.page.height - 55)
           .stroke('#E0E5EC').lineWidth(0.5);
        
        // Footer text
        doc.fontSize(7).font('Helvetica').fillColor('#95A5A6')
           .text(`${BRANDING.companyName} · Confidential Report`, 50, doc.page.height - 45);
        
        doc.text(`Page ${i + 1} of ${totalPages}`, doc.page.width - 100, doc.page.height - 45, 
                { width: 80, align: 'right' });
        
        doc.fontSize(6).fillColor('#BDC3C7')
           .text(`Generated on ${new Date().toLocaleString()}`, 50, doc.page.height - 35);
    }
};

// ==================== REPORT DATA GENERATION ====================

const generateReportData = (type, format, dateFrom, dateTo) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthIndex = new Date().getMonth();
    const last6Months = months.slice(currentMonthIndex - 5, currentMonthIndex + 1);
    
    const baseData = {
        date_range: { from: dateFrom, to: dateTo },
        generated_by: 'CleanSpark Analytics System'
    };
    
    switch (type) {
        case 'comprehensive':
            return {
                ...baseData,
                summary: {
                    total_bookings: 187,
                    total_revenue: 'TZS 5,245,000',
                    completed_bookings: 168,
                    cancelled_bookings: 19,
                    active_contractors: 4,
                    total_staff: 7,
                    avg_satisfaction: '4.9/5',
                    growth_rate: '+18%'
                },
                table_data: {
                    headers: ['Month', 'Bookings', 'Completed', 'Revenue (TZS)', 'Satisfaction'],
                    rows: last6Months.map((m, i) => [
                        m, 
                        [22, 28, 32, 30, 38, 37][i % 6],
                        [20, 26, 30, 28, 35, 29][i % 6],
                        [550000, 650000, 800000, 750000, 950000, 925000][i % 6].toLocaleString(),
                        ['4.7', '4.8', '4.9', '4.8', '5.0', '4.9'][i % 6]
                    ])
                },
                charts: {
                    booking_trends: { labels: last6Months, data: [22, 28, 32, 30, 38, 37], type: 'line' },
                    revenue_trend: { labels: last6Months, data: [550000, 650000, 800000, 750000, 950000, 925000], type: 'line' }
                }
            };

        case 'booking':
            return {
                ...baseData,
                summary: {
                    total_bookings: 215,
                    completed: 192,
                    cancelled: 23,
                    pending: 18,
                    completion_rate: '89.3%',
                    peak_day: 'Saturday',
                    avg_lead_time: '2.4 days'
                },
                table_data: {
                    headers: ['Month', 'Total', 'Completed', 'Cancelled', 'Rate'],
                    rows: last6Months.map((m, i) => [
                        m, 
                        [25, 30, 35, 33, 42, 50][i % 6],
                        [22, 27, 32, 30, 38, 43][i % 6],
                        [3, 3, 3, 3, 4, 7][i % 6],
                        ['88%', '90%', '91%', '91%', '90%', '86%'][i % 6]
                    ])
                },
                charts: {
                    booking_trends: { labels: last6Months, data: [25, 30, 35, 33, 42, 50], type: 'line' },
                    status_distribution: { labels: ['Completed', 'Cancelled', 'Pending'], data: [192, 23, 18], type: 'doughnut' }
                }
            };

        case 'revenue':
            return {
                ...baseData,
                summary: {
                    gross_revenue: 'TZS 5,450,000',
                    net_revenue: 'TZS 5,125,000',
                    total_discounts: 'TZS 245,000',
                    avg_order_value: 'TZS 29,864',
                    highest_order: 'TZS 185,000',
                    profit_margin: '42%'
                },
                table_data: {
                    headers: ['Month', 'Gross (TZS)', 'Net (TZS)', 'Avg Order (TZS)'],
                    rows: last6Months.map((m, i) => [
                        m,
                        [580000, 680000, 850000, 780000, 980000, 1580000][i % 6].toLocaleString(),
                        [540000, 640000, 800000, 730000, 920000, 1495000][i % 6].toLocaleString(),
                        [26000, 29000, 32000, 31000, 34000, 37000][i % 6].toLocaleString()
                    ])
                },
                charts: {
                    revenue_trend: { labels: last6Months, data: [580000, 680000, 850000, 780000, 980000, 1580000], type: 'line' },
                    by_payment: { labels: ['Mobile Money', 'Cash', 'Card'], data: [2850000, 1650000, 950000], type: 'pie' }
                }
            };

        case 'staff_performance':
            return {
                ...baseData,
                summary: {
                    total_staff: 7,
                    avg_completion: '91.2%',
                    total_revenue_handled: 'TZS 7,850,000',
                    top_performer: 'Mohammed Ali',
                    avg_response_time: '45 min',
                    staff_satisfaction: '4.7/5'
                },
                table_data: {
                    headers: ['Staff', 'Role', 'Jobs', 'Completed', 'Rate', 'Revenue (TZS)'],
                    rows: [
                        ['Mohammed Ali', 'Supervisor', 48, 46, '95.8%', '3,450,000'],
                        ['Sarah Johnson', 'Team Lead', 42, 40, '95.2%', '2,980,000'],
                        ['James Wilson', 'Specialist', 38, 35, '92.1%', '2,450,000'],
                        ['Amira Hassan', 'Technician', 35, 32, '91.4%', '2,100,000'],
                        ['David Chen', 'Technician', 32, 29, '90.6%', '1,850,000']
                    ]
                },
                charts: {
                    staff_comparison: { labels: ['Mohammed', 'Sarah', 'James', 'Amira', 'David'], data: [46, 40, 35, 32, 29], type: 'bar' },
                    completion_rate: { labels: ['Mohammed', 'Sarah', 'James', 'Amira', 'David'], data: [95.8, 95.2, 92.1, 91.4, 90.6], type: 'bar' }
                }
            };

        case 'contractors':
            return {
                ...baseData,
                summary: {
                    total_contractors: 4,
                    active_contracts: 3,
                    expiring_soon: 1,
                    total_contract_value: 'TZS 89,500,000',
                    avg_contract_duration: '18 months',
                    renewal_rate: '75%'
                },
                table_data: {
                    headers: ['Company', 'Type', 'Workers', 'Value (TZS)', 'Status', 'Expiry'],
                    rows: [
                        ['Zanzibar State Services', 'Government', 25, '32,500,000', 'Active', 'Dec 2026'],
                        ['CleanCo East Africa', 'Private', 22, '28,500,000', 'Active', 'Mar 2027'],
                        ['Sparkle Solutions', 'Private', 15, '18,500,000', 'Active', 'Aug 2026'],
                        ['Ocean Breeze Ltd', 'SME', 8, '10,000,000', 'Expiring', 'Jun 2026']
                    ]
                },
                charts: {
                    contractor_distribution: { labels: ['Government', 'Private', 'SME'], data: [1, 2, 1], type: 'pie' },
                    contract_value: { labels: ['ZSSF', 'CleanCo', 'Sparkle', 'Ocean'], data: [32500000, 28500000, 18500000, 10000000], type: 'bar' }
                }
            };

        default:
            return { ...baseData, summary: { message: 'No data available for selected report type' }, table_data: { headers: [], rows: [] }, charts: {} };
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

// ==================== DOWNLOAD REPORT ====================

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

// ==================== PDF BUFFER FALLBACK ====================

const generatePDFBuffer = (type, format, dateFrom, dateTo, data) => {
    return new Promise((resolve) => {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        // Simple but professional fallback PDF
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

// ==================== DASHBOARD ANALYTICS ====================

const getBookingAnalytics = async (req, res) => {
    try {
        const dateFrom = req.query.date_from || '2026-01-01';
        const dateTo = req.query.date_to || new Date().toISOString().split('T')[0];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const recentMonths = months.slice(-6);
        const totalBookings = [25, 30, 35, 33, 42, 50];
        const completed = [22, 27, 32, 30, 38, 43];
        const cancelled = [3, 3, 3, 3, 4, 7];
        const revenue = [580000, 680000, 850000, 780000, 980000, 1580000];

        res.json({
            success: true,
            data: {
                date_range: { from: dateFrom, to: dateTo },
                summary: {
                    total_bookings: totalBookings.reduce((a, b) => a + b, 0),
                    completed: completed.reduce((a, b) => a + b, 0),
                    cancelled: cancelled.reduce((a, b) => a + b, 0),
                    pending: 12,
                    completion_rate: Math.round((completed.reduce((a, b) => a + b, 0) / totalBookings.reduce((a, b) => a + b, 0)) * 100)
                },
                charts: {
                    booking_trends: { labels: recentMonths, type: 'line', datasets: [{ label: 'Total Bookings', data: totalBookings, borderColor: BRANDING.accentColor, backgroundColor: 'rgba(242, 166, 90, 0.1)' }, { label: 'Completed', data: completed, borderColor: BRANDING.successColor }, { label: 'Cancelled', data: cancelled, borderColor: BRANDING.dangerColor }] },
                    status_distribution: { labels: ['Completed', 'Pending', 'Cancelled'], type: 'doughnut', data: [192, 18, 23], backgroundColor: [BRANDING.successColor, BRANDING.warningColor, BRANDING.dangerColor] },
                    bookings_by_service: { labels: ['Deep Cleaning', 'Office Cleaning', 'Window Washing', 'Floor Maintenance', 'Carpet Cleaning'], type: 'bar', data: [58, 45, 38, 32, 42], backgroundColor: [BRANDING.dangerColor, BRANDING.accentColor, BRANDING.successColor, BRANDING.secondaryColor, BRANDING.gold] },
                    revenue_trend: { labels: recentMonths, type: 'line', data: revenue, borderColor: BRANDING.secondaryColor }
                },
                table_data: { headers: ['Month', 'Total', 'Completed', 'Cancelled', 'Revenue (TZS)'], rows: recentMonths.map((m, i) => [m, totalBookings[i], completed[i], cancelled[i], revenue[i].toLocaleString()]) }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch booking analytics', error: error.message });
    }
};

const getRevenueAnalytics = async (req, res) => {
    try {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
        const grossRevenue = [580000, 680000, 850000, 780000, 980000, 1580000];
        const netRevenue = [540000, 640000, 800000, 730000, 920000, 1495000];
        const avgOrderValue = [26000, 29000, 32000, 31000, 34000, 37000];

        res.json({
            success: true,
            data: {
                summary: { 
                    gross_revenue: grossRevenue.reduce((a, b) => a + b, 0), 
                    net_revenue: netRevenue.reduce((a, b) => a + b, 0), 
                    average_order_value: Math.round(avgOrderValue.reduce((a, b) => a + b, 0) / avgOrderValue.length), 
                    highest_order: 185000, 
                    total_discounts: 245000, 
                    total_extras: 520000 
                },
                charts: {
                    revenue_trend: { labels: months, type: 'line', datasets: [{ label: 'Gross Revenue', data: grossRevenue, borderColor: BRANDING.successColor }, { label: 'Net Revenue', data: netRevenue, borderColor: BRANDING.secondaryColor }] },
                    revenue_by_payment: { labels: ['Mobile Money', 'Card', 'Cash'], type: 'pie', data: [2850000, 950000, 1650000], backgroundColor: [BRANDING.gold, BRANDING.accentColor, BRANDING.secondaryColor] },
                    revenue_by_service: { labels: ['Deep Cleaning', 'Office Cleaning', 'Window Washing', 'Carpet Care'], type: 'bar', data: [2250000, 1850000, 950000, 750000], backgroundColor: [BRANDING.dangerColor, BRANDING.accentColor, BRANDING.successColor, BRANDING.secondaryColor] }
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch revenue analytics', error: error.message });
    }
};

const getStaffAnalytics = async (req, res) => {
    try {
        const performanceData = [
            { staff_id: 101, name: 'Mohammed Ali', role: 'Supervisor', total_assignments: 48, completed: 46, cancelled: 2, completion_rate: 95.8, revenue_handled: 3450000, rating: 4.9 },
            { staff_id: 102, name: 'Sarah Johnson', role: 'Team Lead', total_assignments: 42, completed: 40, cancelled: 2, completion_rate: 95.2, revenue_handled: 2980000, rating: 4.8 },
            { staff_id: 103, name: 'James Wilson', role: 'Specialist', total_assignments: 38, completed: 35, cancelled: 3, completion_rate: 92.1, revenue_handled: 2450000, rating: 4.7 },
            { staff_id: 104, name: 'Amira Hassan', role: 'Technician', total_assignments: 35, completed: 32, cancelled: 3, completion_rate: 91.4, revenue_handled: 2100000, rating: 4.6 },
            { staff_id: 105, name: 'David Chen', role: 'Technician', total_assignments: 32, completed: 29, cancelled: 3, completion_rate: 90.6, revenue_handled: 1850000, rating: 4.5 }
        ];

        res.json({
            success: true,
            data: {
                performance: performanceData,
                summary: {
                    total_staff: 7,
                    avg_completion_rate: '92.3%',
                    total_revenue_handled: '12,830,000',
                    top_performer: 'Mohammed Ali',
                    avg_rating: '4.7/5'
                },
                top_performers: performanceData.sort((a, b) => b.completion_rate - a.completion_rate),
                charts: {
                    staff_comparison: { labels: performanceData.map(p => p.name.split(' ')[0]), type: 'bar', datasets: [{ label: 'Completed Jobs', data: performanceData.map(p => p.completed), backgroundColor: BRANDING.successColor }, { label: 'Completion Rate %', data: performanceData.map(p => p.completion_rate), backgroundColor: BRANDING.accentColor, type: 'line' }] }
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch staff analytics', error: error.message });
    }
};

const getDashboardSummary = async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                stats_cards: {
                    total_bookings: { value: 215, change: '+18%', trend: 'up' },
                    completed_bookings: { value: 192, change: '+15%', trend: 'up' },
                    gross_revenue: { value: '5,450,000', change: '+22%', trend: 'up' },
                    active_staff: { value: 7, change: '+17%', trend: 'up' },
                    satisfaction_rate: { value: '4.9/5', change: '+0.2', trend: 'up' },
                    pending_bookings: { value: 18, change: '-5%', trend: 'down' }
                },
                recent_bookings: [
                    { id: 1001, customer: 'Fatima Hassan', service: 'Deep Cleaning', date: '2026-05-15', status: 'completed', amount: 85000 },
                    { id: 1002, customer: 'Ali Mohammed', service: 'Office Cleaning', date: '2026-05-14', status: 'completed', amount: 120000 },
                    { id: 1003, customer: 'Zainab Said', service: 'Window Washing', date: '2026-05-14', status: 'pending', amount: 45000 },
                    { id: 1004, customer: 'Omar Khamis', service: 'Carpet Cleaning', date: '2026-05-13', status: 'completed', amount: 68000 }
                ],
                charts: {
                    weekly_bookings: { labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], data: [28, 32, 35, 38, 42, 48, 22] }
                }
            }
        });
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
    getStaffAnalytics,
    getDashboardSummary
};