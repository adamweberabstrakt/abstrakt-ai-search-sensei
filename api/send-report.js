// PDF Report Generation and Email Sending
// Uses PDFKit for PDF generation and Resend for email delivery

const PDFDocument = require('pdfkit');
const { Resend } = require('resend');

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { recipientName, recipientCompany, recipientEmail, reportData } = req.body;

  // Validate required fields
  if (!recipientName || !recipientCompany || !recipientEmail) {
    return res.status(400).json({ 
      error: "Missing required fields",
      required: ["recipientName", "recipientCompany", "recipientEmail"]
    });
  }

  if (!reportData) {
    return res.status(400).json({ error: "Report data is required" });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    return res.status(500).json({ 
      error: "Email service not configured",
      hint: "Add RESEND_API_KEY to Vercel environment variables"
    });
  }

  console.log(`Generating AI Reputation Report for ${recipientName} at ${recipientCompany}`);

  try {
    // Generate PDF
    const pdfBuffer = await generatePDF(reportData, recipientName, recipientCompany);
    
    // Send email via Resend
    const resend = new Resend(resendKey);
    
    const { data, error } = await resend.emails.send({
      from: 'AI Reputation Report <onboarding@resend.dev>',
      to: [recipientEmail],
      subject: `AI Reputation Report - ${reportData.companyName || 'Your Company'}`,
      html: generateEmailHTML(recipientName, recipientCompany, reportData),
      attachments: [
        {
          filename: `AI-Reputation-Report-${reportData.companyName || 'Analysis'}-${new Date().toISOString().split('T')[0]}.pdf`,
          content: pdfBuffer.toString('base64'),
          type: 'application/pdf'
        }
      ]
    });

    if (error) {
      console.error("Resend error:", error);
      return res.status(500).json({ error: "Failed to send email", details: error });
    }

    console.log("Email sent successfully:", data);
    return res.status(200).json({ 
      success: true, 
      message: `Report sent to ${recipientEmail}`,
      emailId: data?.id 
    });

  } catch (error) {
    console.error("Report generation/sending error:", error);
    return res.status(500).json({ 
      error: "Failed to generate or send report", 
      message: error.message 
    });
  }
};

// Generate PDF using PDFKit - each section as a page
async function generatePDF(reportData, recipientName, recipientCompany) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'LETTER',
      margin: 50,
      info: {
        Title: `AI Reputation Report - ${reportData.companyName}`,
        Author: 'Abstrakt Marketing Group'
      }
    });
    
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Colors
    const primaryColor = '#E85D04';
    const secondaryColor = '#F48C06';
    const darkColor = '#1a1a2e';
    const grayColor = '#666666';

    // Helper functions
    const drawHeader = (title, subtitle = null) => {
      doc.rect(0, 0, doc.page.width, 100).fill(darkColor);
      doc.fillColor('#ffffff')
         .fontSize(24)
         .font('Helvetica-Bold')
         .text(title, 50, 35);
      if (subtitle) {
        doc.fontSize(12)
           .font('Helvetica')
           .fillColor(secondaryColor)
           .text(subtitle, 50, 65);
      }
      doc.moveDown(4);
    };

    const drawSectionTitle = (title, yPos) => {
      doc.fillColor(primaryColor)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text(title, 50, yPos);
      return yPos + 25;
    };

    const getScoreColor = (score) => {
      if (score >= 8) return '#22c55e';
      if (score >= 6) return '#3b82f6';
      if (score >= 4) return '#eab308';
      if (score >= 2) return '#f97316';
      return '#ef4444';
    };

    const getScoreLabel = (score) => {
      if (score >= 8) return 'Excellent';
      if (score >= 6) return 'Good';
      if (score >= 4) return 'Needs Work';
      if (score >= 2) return 'Poor';
      return 'Critical';
    };

    // ==================== PAGE 1: Cover Page ====================
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(darkColor);
    
    // Logo area
    doc.fillColor('#ffffff')
       .fontSize(14)
       .font('Helvetica')
       .text('ABSTRAKT MARKETING GROUP', 50, 80, { align: 'center' });
    
    // Main title
    doc.fontSize(42)
       .font('Helvetica-Bold')
       .fillColor(primaryColor)
       .text('AI Reputation', 50, 200, { align: 'center' });
    doc.text('Report', 50, 255, { align: 'center' });
    
    // Company name
    doc.fillColor('#ffffff')
       .fontSize(24)
       .font('Helvetica')
       .text(reportData.companyName || 'Company Analysis', 50, 350, { align: 'center' });
    
    // Prepared for
    doc.fontSize(14)
       .fillColor('rgba(255,255,255,0.7)')
       .text('Prepared for:', 50, 450, { align: 'center' });
    doc.fontSize(18)
       .fillColor('#ffffff')
       .text(`${recipientName}`, 50, 475, { align: 'center' });
    doc.fontSize(14)
       .text(`${recipientCompany}`, 50, 500, { align: 'center' });
    
    // Date
    doc.fontSize(12)
       .fillColor(secondaryColor)
       .text(new Date().toLocaleDateString('en-US', { 
         year: 'numeric', month: 'long', day: 'numeric' 
       }), 50, 550, { align: 'center' });

    // ==================== PAGE 2: Executive Overview ====================
    doc.addPage();
    drawHeader('Executive Overview', 'AI Search Visibility Summary');
    
    let yPos = 120;
    
    // Calculate scores
    const companyResults = reportData.company || {};
    const avgScore = calculateAverageScore(companyResults);
    const avgSentiment = calculateAverageSentiment(companyResults);
    
    // Quick Stats
    doc.fillColor(darkColor)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('KEY METRICS', 50, yPos);
    yPos += 25;
    
    doc.font('Helvetica')
       .fontSize(11);
    
    doc.fillColor(getScoreColor(avgScore))
       .text(`Overall AI Visibility Score: ${avgScore}/10 (${getScoreLabel(avgScore)})`, 50, yPos);
    yPos += 18;
    
    doc.fillColor(darkColor)
       .text(`Overall Sentiment: ${avgSentiment}`, 50, yPos);
    yPos += 18;
    
    if (reportData.semrushData?.authorityScore) {
      doc.text(`Domain Authority: ${reportData.semrushData.authorityScore}`, 50, yPos);
      yPos += 18;
    }
    
    if (reportData.semrushData?.backlinks?.referringDomains) {
      doc.text(`Referring Domains: ${reportData.semrushData.backlinks.referringDomains.toLocaleString()}`, 50, yPos);
      yPos += 18;
    }
    
    yPos += 20;
    
    // AI Engine Breakdown
    yPos = drawSectionTitle('AI Search Engine Breakdown', yPos);
    
    Object.entries(companyResults).forEach(([llmId, data]) => {
      if (yPos > 680) {
        doc.addPage();
        yPos = 50;
      }
      const score = data.results?.confidenceScore || 0;
      doc.fillColor(darkColor)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(`${data.llm?.name || llmId}:`, 50, yPos);
      doc.fillColor(getScoreColor(score))
         .font('Helvetica')
         .text(`${score}/10 - ${getScoreLabel(score)}`, 200, yPos);
      yPos += 18;
    });

    // ==================== PAGE 3: Company Analysis ====================
    doc.addPage();
    drawHeader('Company Analysis', reportData.companyName);
    
    yPos = 120;
    
    // SEMRush Data
    if (reportData.semrushData) {
      yPos = drawSectionTitle('Backlink Profile (SEMRush)', yPos);
      
      const semrush = reportData.semrushData;
      doc.fillColor(darkColor).fontSize(11).font('Helvetica');
      
      if (semrush.authorityScore !== undefined) {
        doc.text(`Domain Authority Score: ${semrush.authorityScore}`, 50, yPos);
        yPos += 16;
      }
      if (semrush.backlinks) {
        doc.text(`Total Backlinks: ${semrush.backlinks.total?.toLocaleString() || 'N/A'}`, 50, yPos);
        yPos += 16;
        doc.text(`Referring Domains: ${semrush.backlinks.referringDomains?.toLocaleString() || 'N/A'}`, 50, yPos);
        yPos += 16;
        doc.text(`Follow Links: ${semrush.backlinks.followLinks?.toLocaleString() || 'N/A'}`, 50, yPos);
        yPos += 16;
      }
      yPos += 15;
      
      // Top Backlinks
      if (semrush.topBacklinks && semrush.topBacklinks.length > 0) {
        doc.font('Helvetica-Bold').text('Top Referring Domains:', 50, yPos);
        yPos += 18;
        
        doc.font('Helvetica').fontSize(10);
        semrush.topBacklinks.slice(0, 8).forEach((link, i) => {
          if (yPos > 700) return;
          doc.fillColor(grayColor)
             .text(`${i + 1}. ${link.sourceUrl?.substring(0, 55) || 'Unknown'} (AS: ${link.authorityScore})`, 60, yPos);
          yPos += 14;
        });
      }
    }
    
    yPos += 20;
    
    // AI Analysis Results
    yPos = drawSectionTitle('AI Search Engine Results', yPos);
    
    Object.entries(companyResults).forEach(([llmId, data]) => {
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }
      
      const result = data.results || {};
      doc.fillColor(darkColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(data.llm?.name || llmId, 50, yPos);
      yPos += 18;
      
      if (result.summary) {
        doc.fillColor(grayColor)
           .fontSize(10)
           .font('Helvetica')
           .text(result.summary.substring(0, 400), 50, yPos, { width: 500 });
        yPos += doc.heightOfString(result.summary.substring(0, 400), { width: 500 }) + 10;
      }
      
      if (result.recommendations) {
        doc.fillColor(primaryColor).font('Helvetica-Bold').text('Recommendation:', 50, yPos);
        yPos += 14;
        doc.fillColor(grayColor).font('Helvetica').text(result.recommendations.substring(0, 300), 50, yPos, { width: 500 });
        yPos += doc.heightOfString(result.recommendations.substring(0, 300), { width: 500 }) + 15;
      }
    });

    // ==================== PAGE 4: Leadership Analysis ====================
    if (reportData.leadership && reportData.leadership.length > 0) {
      doc.addPage();
      drawHeader('Leadership Analysis', 'Reputation & Press Opportunities');
      
      yPos = 120;
      
      reportData.leadership.forEach(leader => {
        if (yPos > 600) {
          doc.addPage();
          yPos = 50;
        }
        
        doc.fillColor(darkColor)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(leader.name, 50, yPos);
        yPos += 18;
        
        if (leader.title) {
          doc.fillColor(grayColor)
             .fontSize(10)
             .font('Helvetica')
             .text(leader.title, 50, yPos);
          yPos += 16;
        }
        
        // Reputation scores
        doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('Reputation Scores:', 50, yPos);
        yPos += 16;
        
        if (leader.byLLM) {
          Object.entries(leader.byLLM).forEach(([llmId, data]) => {
            const score = data.results?.sentimentScore || 5;
            doc.fillColor(grayColor)
               .fontSize(10)
               .font('Helvetica')
               .text(`${data.llm?.name}: ${score}/10`, 60, yPos);
            yPos += 14;
          });
        }
        yPos += 10;
        
        // Press Opportunities
        if (leader.pressOpportunities) {
          doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold').text('Press Opportunities:', 50, yPos);
          yPos += 16;
          
          Object.entries(leader.pressOpportunities).slice(0, 1).forEach(([llmId, data]) => {
            if (data.results?.summary) {
              doc.fillColor(grayColor)
                 .fontSize(10)
                 .font('Helvetica')
                 .text(data.results.summary.substring(0, 350), 60, yPos, { width: 480 });
              yPos += doc.heightOfString(data.results.summary.substring(0, 350), { width: 480 }) + 10;
            }
          });
        }
        
        yPos += 20;
      });
    }

    // ==================== PAGE 5: Gap Analysis ====================
    if (reportData.competitors && reportData.competitors.length > 0) {
      doc.addPage();
      drawHeader('Competitor Gap Analysis', 'Backlink & Visibility Comparison');
      
      yPos = 120;
      
      // Comparison table header
      doc.fillColor(darkColor).fontSize(10).font('Helvetica-Bold');
      doc.text('Company', 50, yPos);
      doc.text('Authority', 200, yPos);
      doc.text('Backlinks', 280, yPos);
      doc.text('Ref. Domains', 370, yPos);
      doc.text('AI Score', 470, yPos);
      yPos += 20;
      
      doc.moveTo(50, yPos - 5).lineTo(550, yPos - 5).stroke(primaryColor);
      
      // Your company
      doc.font('Helvetica-Bold');
      doc.text(`${reportData.companyName} (You)`, 50, yPos);
      doc.font('Helvetica');
      doc.text(reportData.semrushData?.authorityScore?.toString() || '-', 200, yPos);
      doc.text(reportData.semrushData?.backlinks?.total?.toLocaleString() || '-', 280, yPos);
      doc.text(reportData.semrushData?.backlinks?.referringDomains?.toLocaleString() || '-', 370, yPos);
      doc.text(`${calculateAverageScore(reportData.company)}/10`, 470, yPos);
      yPos += 18;
      
      // Competitors
      reportData.competitors.forEach(comp => {
        doc.text(comp.name, 50, yPos);
        doc.text(comp.semrushData?.authorityScore?.toString() || '-', 200, yPos);
        doc.text(comp.semrushData?.backlinks?.total?.toLocaleString() || '-', 280, yPos);
        doc.text(comp.semrushData?.backlinks?.referringDomains?.toLocaleString() || '-', 370, yPos);
        const compScore = calculateAverageScore(comp.byLLM);
        doc.text(`${compScore}/10`, 470, yPos);
        yPos += 18;
      });
      
      yPos += 25;
      
      // Competitor backlink opportunities
      reportData.competitors.forEach(comp => {
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }
        
        if (comp.semrushData?.topBacklinks && comp.semrushData.topBacklinks.length > 0) {
          doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold')
             .text(`${comp.name}'s Top Backlinks (Gap Opportunities):`, 50, yPos);
          yPos += 18;
          
          doc.fillColor(grayColor).fontSize(9).font('Helvetica');
          comp.semrushData.topBacklinks.slice(0, 5).forEach((link, i) => {
            doc.text(`${i + 1}. ${link.sourceUrl?.substring(0, 60) || 'Unknown'} (AS: ${link.authorityScore})`, 60, yPos);
            yPos += 13;
          });
          yPos += 15;
        }
      });
    }

    // ==================== PAGE 6: Podcast Opportunities ====================
    if (reportData.podcastOpportunities && reportData.podcastOpportunities.length > 0) {
      doc.addPage();
      drawHeader('Podcast Opportunities', 'Guest Appearance Recommendations');
      
      yPos = 120;
      
      reportData.podcastOpportunities.forEach(item => {
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }
        
        doc.fillColor(darkColor)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(`Source: ${item.llm?.name}`, 50, yPos);
        yPos += 18;
        
        if (item.results?.summary) {
          doc.fillColor(grayColor)
             .fontSize(10)
             .font('Helvetica')
             .text(item.results.summary.substring(0, 400), 50, yPos, { width: 500 });
          yPos += doc.heightOfString(item.results.summary.substring(0, 400), { width: 500 }) + 10;
        }
        
        if (item.results?.podcastOpportunities && item.results.podcastOpportunities.length > 0) {
          doc.fillColor(primaryColor).font('Helvetica-Bold').text('Recommended Podcasts:', 50, yPos);
          yPos += 16;
          
          item.results.podcastOpportunities.slice(0, 5).forEach((pod, i) => {
            doc.fillColor(grayColor).fontSize(10).font('Helvetica');
            doc.text(`${i + 1}. ${pod.name}${pod.topic ? ` - ${pod.topic}` : ''}${pod.audienceSize ? ` (${pod.audienceSize})` : ''}`, 60, yPos);
            yPos += 14;
          });
        }
        
        yPos += 20;
      });
    }

    // ==================== PAGE 7: Social Sentiment ====================
    if (reportData.leadership && reportData.leadership.some(l => l.socialSentiment)) {
      doc.addPage();
      drawHeader('Social Sentiment Analysis', 'Online Reputation by Platform');
      
      yPos = 120;
      
      reportData.leadership.forEach(leader => {
        if (!leader.socialSentiment || Object.keys(leader.socialSentiment).length === 0) return;
        
        if (yPos > 600) {
          doc.addPage();
          yPos = 50;
        }
        
        doc.fillColor(darkColor)
           .fontSize(14)
           .font('Helvetica-Bold')
           .text(leader.name, 50, yPos);
        yPos += 16;
        
        if (leader.title) {
          doc.fillColor(grayColor).fontSize(10).font('Helvetica').text(leader.title, 50, yPos);
          yPos += 18;
        }
        
        Object.entries(leader.socialSentiment).forEach(([llmId, data]) => {
          if (yPos > 680) return;
          
          const score = data.results?.sentimentScore || 5;
          const sentiment = data.results?.sentiment || 'neutral';
          
          doc.fillColor(darkColor).fontSize(11).font('Helvetica-Bold')
             .text(`${data.llm?.name}: `, 50, yPos);
          doc.fillColor(getScoreColor(score)).font('Helvetica')
             .text(`${score}/10 (${sentiment})`, 180, yPos);
          yPos += 16;
          
          if (data.results?.summary) {
            doc.fillColor(grayColor).fontSize(10).font('Helvetica')
               .text(data.results.summary.substring(0, 300), 60, yPos, { width: 480 });
            yPos += doc.heightOfString(data.results.summary.substring(0, 300), { width: 480 }) + 10;
          }
        });
        
        yPos += 20;
      });
    }

    // ==================== Final Page: Contact ====================
    doc.addPage();
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(darkColor);
    
    doc.fillColor('#ffffff')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('Ready to Improve Your', 50, 200, { align: 'center' });
    doc.fillColor(primaryColor)
       .text('AI Reputation?', 50, 240, { align: 'center' });
    
    doc.fillColor('#ffffff')
       .fontSize(14)
       .font('Helvetica')
       .text('Contact Abstrakt Marketing Group to discuss', 50, 320, { align: 'center' });
    doc.text('strategies for improving your AI visibility and online reputation.', 50, 340, { align: 'center' });
    
    doc.fillColor(secondaryColor)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('www.abstraktmg.com', 50, 400, { align: 'center' });
    
    doc.fillColor('rgba(255,255,255,0.5)')
       .fontSize(10)
       .font('Helvetica')
       .text(`Report generated: ${new Date().toLocaleDateString()}`, 50, 700, { align: 'center' });

    doc.end();
  });
}

// Generate HTML email body
function generateEmailHTML(recipientName, recipientCompany, reportData) {
  const avgScore = calculateAverageScore(reportData.company || {});
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #E85D04, #F48C06); padding: 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">AI Reputation Report</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">by Abstrakt Marketing Group</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #333;">Hi ${recipientName},</p>
      
      <p style="font-size: 14px; color: #666; line-height: 1.6;">
        Your AI Reputation Report for <strong>${reportData.companyName || 'your company'}</strong> is ready! 
        Please find the detailed PDF report attached to this email.
      </p>
      
      <!-- Quick Stats Box -->
      <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #E85D04;">
        <h3 style="margin: 0 0 15px 0; color: #333; font-size: 16px;">Quick Overview</h3>
        <p style="margin: 5px 0; color: #666;">
          <strong>Overall AI Visibility Score:</strong> 
          <span style="color: ${getScoreColorHex(avgScore)}; font-weight: bold;">${avgScore}/10</span>
        </p>
        <p style="margin: 5px 0; color: #666;">
          <strong>Company:</strong> ${reportData.companyName || 'N/A'}
        </p>
        <p style="margin: 5px 0; color: #666;">
          <strong>Report Date:</strong> ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
      
      <p style="font-size: 14px; color: #666; line-height: 1.6;">
        Your report includes:
      </p>
      <ul style="font-size: 14px; color: #666; line-height: 1.8;">
        <li>Executive Overview & Key Metrics</li>
        <li>Company AI Search Visibility Analysis</li>
        <li>Leadership Reputation & Press Opportunities</li>
        <li>Competitor Gap Analysis</li>
        <li>Podcast Guest Opportunities</li>
        <li>Social Sentiment Analysis</li>
      </ul>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://abstraktmg.com/contact" 
           style="background: linear-gradient(135deg, #E85D04, #F48C06); 
                  color: #ffffff; 
                  padding: 14px 30px; 
                  text-decoration: none; 
                  border-radius: 6px; 
                  font-weight: 600;
                  display: inline-block;">
          Schedule a Strategy Call
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="background-color: #1a1a2e; padding: 20px; text-align: center;">
      <p style="color: #ffffff; margin: 0 0 5px 0; font-size: 14px; font-weight: 600;">
        Abstrakt Marketing Group
      </p>
      <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 12px;">
        B2B Lead Generation & Digital Marketing
      </p>
      <p style="color: rgba(255,255,255,0.4); margin: 15px 0 0 0; font-size: 11px;">
        © ${new Date().getFullYear()} Abstrakt Marketing Group. All rights reserved.
      </p>
    </div>
    
  </div>
</body>
</html>
  `;
}

// Helper functions
function calculateAverageScore(companyResults) {
  const scores = Object.values(companyResults || {})
    .map(r => r.results?.confidenceScore || 0)
    .filter(s => s > 0);
  if (scores.length === 0) return 0;
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}

function calculateAverageSentiment(companyResults) {
  const sentiments = Object.values(companyResults || {})
    .map(r => r.results?.sentiment)
    .filter(Boolean);
  if (sentiments.length === 0) return 'Unknown';
  
  const counts = { positive: 0, neutral: 0, negative: 0 };
  sentiments.forEach(s => counts[s.toLowerCase()] = (counts[s.toLowerCase()] || 0) + 1);
  
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function getScoreColorHex(score) {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#3b82f6';
  if (score >= 4) return '#eab308';
  if (score >= 2) return '#f97316';
  return '#ef4444';
}
