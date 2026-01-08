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

  console.log(`Generating report for ${recipientName} at ${recipientCompany}`);

  try {
    // Generate PDF
    const pdfBuffer = await generatePDF(reportData, recipientName, recipientCompany);
    
    // Send email via Resend
    const resend = new Resend(resendKey);
    
    const { data, error } = await resend.emails.send({
      from: 'Entity SEO Report <onboarding@resend.dev>',
      to: [recipientEmail],
      subject: `Entity SEO Analysis Report - ${reportData.companyName || 'Your Company'}`,
      html: generateEmailHTML(recipientName, recipientCompany, reportData),
      attachments: [
        {
          filename: `Entity-SEO-Report-${reportData.companyName || 'Analysis'}-${new Date().toISOString().split('T')[0]}.pdf`,
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

// Generate PDF using PDFKit
async function generatePDF(reportData, recipientName, recipientCompany) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'LETTER',
      margin: 50,
      info: {
        Title: `Entity SEO Report - ${reportData.companyName}`,
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

    // Header
    doc.rect(0, 0, doc.page.width, 120).fill(darkColor);
    doc.fillColor('#ffffff')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('Entity SEO Analysis Report', 50, 40);
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor(secondaryColor)
       .text('AI Search Visibility Analysis by Abstrakt Marketing Group', 50, 75);
    doc.fillColor('#cccccc')
       .fontSize(10)
       .text(`Generated: ${new Date().toLocaleDateString('en-US', { 
         year: 'numeric', month: 'long', day: 'numeric' 
       })}`, 50, 95);

    doc.moveDown(4);

    // Report Info
    doc.fillColor(darkColor)
       .fontSize(14)
       .font('Helvetica-Bold')
       .text('Prepared For:', 50, 140);
    doc.fontSize(12)
       .font('Helvetica')
       .fillColor(grayColor)
       .text(`${recipientName}`, 50, 160)
       .text(`${recipientCompany}`, 50, 175);

    if (reportData.companyName) {
      doc.fillColor(darkColor)
         .fontSize(14)
         .font('Helvetica-Bold')
         .text('Company Analyzed:', 300, 140);
      doc.fontSize(12)
         .font('Helvetica')
         .fillColor(grayColor)
         .text(reportData.companyName, 300, 160);
      if (reportData.website) {
        doc.text(reportData.website, 300, 175);
      }
    }

    doc.moveDown(3);
    let yPos = 220;

    // Divider
    doc.moveTo(50, yPos).lineTo(562, yPos).stroke(primaryColor);
    yPos += 20;

    // Executive Summary
    doc.fillColor(primaryColor)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('Executive Summary', 50, yPos);
    yPos += 25;

    // Calculate average scores
    const companyResults = reportData.company || {};
    const avgScore = calculateAverageScore(companyResults);
    const avgSentiment = calculateAverageSentiment(companyResults);

    doc.fillColor(darkColor)
       .fontSize(11)
       .font('Helvetica')
       .text(`Overall AI Visibility Score: ${avgScore}/10 (${getScoreLabel(avgScore)})`, 50, yPos);
    yPos += 18;
    doc.text(`Overall Sentiment: ${avgSentiment}`, 50, yPos);
    yPos += 30;

    // AI Search Engine Results
    doc.fillColor(primaryColor)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('AI Search Engine Visibility', 50, yPos);
    yPos += 25;

    Object.entries(companyResults).forEach(([llmId, data]) => {
      if (yPos > 680) {
        doc.addPage();
        yPos = 50;
      }

      const result = data.results || {};
      const score = result.confidenceScore || 0;
      
      // LLM Name
      doc.fillColor(darkColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(`${data.llm?.name || llmId}`, 50, yPos);
      
      // Score badge
      doc.fillColor(getScoreColorHex(score))
         .text(`${score}/10 - ${getScoreLabel(score)}`, 400, yPos);
      yPos += 18;

      // Summary
      if (result.summary) {
        doc.fillColor(grayColor)
           .fontSize(10)
           .font('Helvetica')
           .text(result.summary.substring(0, 300) + (result.summary.length > 300 ? '...' : ''), 50, yPos, {
             width: 500,
             align: 'left'
           });
        yPos += doc.heightOfString(result.summary.substring(0, 300), { width: 500 }) + 10;
      }

      // Recommendations
      if (result.recommendations) {
        doc.fillColor(primaryColor)
           .fontSize(10)
           .font('Helvetica-Bold')
           .text('Recommendation:', 50, yPos);
        yPos += 14;
        doc.fillColor(grayColor)
           .font('Helvetica')
           .text(result.recommendations.substring(0, 250), 50, yPos, { width: 500 });
        yPos += doc.heightOfString(result.recommendations.substring(0, 250), { width: 500 }) + 15;
      }

      yPos += 10;
    });

    // Leadership Section
    if (reportData.leadership && reportData.leadership.length > 0) {
      if (yPos > 600) {
        doc.addPage();
        yPos = 50;
      }

      doc.fillColor(primaryColor)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('Leadership Visibility Analysis', 50, yPos);
      yPos += 25;

      reportData.leadership.forEach(leader => {
        if (yPos > 680) {
          doc.addPage();
          yPos = 50;
        }

        doc.fillColor(darkColor)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(`${leader.name}${leader.title ? ` - ${leader.title}` : ''}`, 50, yPos);
        yPos += 20;

        if (leader.byLLM) {
          Object.entries(leader.byLLM).forEach(([llmId, data]) => {
            const sentimentScore = data.results?.sentimentScore || 5;
            doc.fillColor(grayColor)
               .fontSize(10)
               .font('Helvetica')
               .text(`${data.llm?.name}: Sentiment Score ${sentimentScore}/10`, 70, yPos);
            yPos += 15;
          });
        }
        yPos += 10;
      });
    }

    // SEMRush Data Section
    if (reportData.semrushData) {
      if (yPos > 550) {
        doc.addPage();
        yPos = 50;
      }

      doc.fillColor(primaryColor)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('SEMRush Backlink Analysis', 50, yPos);
      yPos += 25;

      const semrush = reportData.semrushData;
      
      if (semrush.authorityScore !== undefined) {
        doc.fillColor(darkColor)
           .fontSize(11)
           .font('Helvetica')
           .text(`Domain Authority Score: ${semrush.authorityScore}`, 50, yPos);
        yPos += 18;
      }

      if (semrush.backlinks) {
        doc.text(`Total Backlinks: ${semrush.backlinks.total?.toLocaleString() || 'N/A'}`, 50, yPos);
        yPos += 15;
        doc.text(`Referring Domains: ${semrush.backlinks.referringDomains?.toLocaleString() || 'N/A'}`, 50, yPos);
        yPos += 15;
        doc.text(`Follow Links: ${semrush.backlinks.followLinks?.toLocaleString() || 'N/A'}`, 50, yPos);
        yPos += 15;
        doc.text(`NoFollow Links: ${semrush.backlinks.nofollowLinks?.toLocaleString() || 'N/A'}`, 50, yPos);
        yPos += 25;
      }

      // Top Backlinks
      if (semrush.topBacklinks && semrush.topBacklinks.length > 0) {
        doc.fillColor(darkColor)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('Top Referring Domains:', 50, yPos);
        yPos += 18;

        semrush.topBacklinks.slice(0, 10).forEach((link, i) => {
          if (yPos > 700) {
            doc.addPage();
            yPos = 50;
          }
          doc.fillColor(grayColor)
             .fontSize(9)
             .font('Helvetica')
             .text(`${i + 1}. ${link.sourceUrl?.substring(0, 60) || 'Unknown'} (AS: ${link.authorityScore})`, 60, yPos);
          yPos += 14;
        });
      }
    }

    // Competitor Comparison
    if (reportData.competitors && reportData.competitors.length > 0) {
      doc.addPage();
      yPos = 50;

      doc.fillColor(primaryColor)
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('Competitor Analysis', 50, yPos);
      yPos += 25;

      reportData.competitors.forEach(competitor => {
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }

        doc.fillColor(darkColor)
           .fontSize(12)
           .font('Helvetica-Bold')
           .text(competitor.name, 50, yPos);
        if (competitor.website) {
          doc.fillColor(grayColor)
             .fontSize(10)
             .font('Helvetica')
             .text(competitor.website, 200, yPos);
        }
        yPos += 20;

        // Competitor SEMRush data if available
        if (competitor.semrushData) {
          doc.fillColor(grayColor)
             .fontSize(10)
             .text(`Authority Score: ${competitor.semrushData.authorityScore || 'N/A'}`, 70, yPos);
          yPos += 15;
          if (competitor.semrushData.backlinks) {
            doc.text(`Backlinks: ${competitor.semrushData.backlinks.total?.toLocaleString() || 'N/A'}`, 70, yPos);
            yPos += 15;
            doc.text(`Referring Domains: ${competitor.semrushData.backlinks.referringDomains?.toLocaleString() || 'N/A'}`, 70, yPos);
            yPos += 20;
          }
        }
      });
    }

    // Footer on last page
    doc.fillColor(grayColor)
       .fontSize(9)
       .text('© Abstrakt Marketing Group | Entity SEO Checker', 50, doc.page.height - 50, {
         align: 'center',
         width: doc.page.width - 100
       });

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
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Entity SEO Analysis Report</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px;">AI Search Visibility Analysis</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <p style="font-size: 16px; color: #333;">Hi ${recipientName},</p>
      
      <p style="font-size: 14px; color: #666; line-height: 1.6;">
        Your Entity SEO Analysis report for <strong>${reportData.companyName || 'your company'}</strong> is ready! 
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
        The attached report includes:
      </p>
      <ul style="font-size: 14px; color: #666; line-height: 1.8;">
        <li>AI Search Engine Visibility Analysis (ChatGPT, Gemini, Claude, etc.)</li>
        <li>Leadership Reputation Scoring</li>
        <li>SEMRush Backlink Analysis</li>
        <li>Competitor Comparison</li>
        <li>Actionable Recommendations</li>
      </ul>
      
      <p style="font-size: 14px; color: #666; line-height: 1.6;">
        Have questions about your report or want to discuss strategies to improve your AI visibility? 
        We're here to help!
      </p>
      
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
  const scores = Object.values(companyResults)
    .map(r => r.results?.confidenceScore || 0)
    .filter(s => s > 0);
  if (scores.length === 0) return 0;
  return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
}

function calculateAverageSentiment(companyResults) {
  const sentiments = Object.values(companyResults)
    .map(r => r.results?.sentiment)
    .filter(Boolean);
  if (sentiments.length === 0) return 'Unknown';
  
  const counts = { positive: 0, neutral: 0, negative: 0 };
  sentiments.forEach(s => counts[s] = (counts[s] || 0) + 1);
  
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function getScoreLabel(score) {
  if (score >= 8) return 'Excellent';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Needs Work';
  if (score >= 2) return 'Poor';
  return 'Critical';
}

function getScoreColorHex(score) {
  if (score >= 8) return '#22c55e';
  if (score >= 6) return '#3b82f6';
  if (score >= 4) return '#eab308';
  if (score >= 2) return '#f97316';
  return '#ef4444';
}
