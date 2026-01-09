# Abstrakt AI Reputation Report v4.0

**AI Search Visibility, Social Sentiment & Competitive Analysis Tool**  
Built by Abstrakt Marketing Group

---

## 🚀 New Features in v4.0

- **Tabbed Interface** - Clean navigation between report sections:
  - Overview (Executive Summary)
  - Company (AI Visibility + SEMRush)
  - Leaders (Reputation + Press Opportunities)
  - Gap Analysis (Competitor Comparison)
  - Podcast Opportunities
  - Social Sentiment (NEW!)

- **Social Sentiment Analysis** - Scans social media presence for each leader
- **Press Opportunities** - Specific media/press recommendations for leadership
- **Abstrakt Logo** - Branded header with official logo
- **Comprehensive PDF** - All sections as pages in professional report

---

## 📁 Project Structure

```
ai-reputation-report/
├── api/
│   ├── analyze.js      # AI analysis (entity, leadership, press, social, podcast)
│   ├── semrush.js      # Backlink & authority data
│   ├── send-report.js  # PDF generation + email
│   └── test.js         # API diagnostics
├── src/
│   ├── App.js
│   ├── EntitySEOChecker.js  # Main component with tabs
│   ├── index.css
│   └── index.js
├── public/
│   └── index.html
├── package.json
├── vercel.json
└── .gitignore
```

---

## 🔧 Deployment

1. Replace all files in your GitHub repo with these
2. Commit changes
3. Vercel will auto-deploy

Your environment variables should already be set:
- `ANTHROPIC_API_KEY`
- `SEMRUSH_API_KEY`
- `RESEND_API_KEY`

---

## 📊 Report Sections

| Tab | Description |
|-----|-------------|
| **Overview** | Executive summary with key metrics |
| **Company** | AI visibility scores + SEMRush backlink data |
| **Leaders** | Reputation scores + press/media opportunities |
| **Gap Analysis** | Competitor comparison table + backlink gaps |
| **Podcast Opportunities** | Recommended podcasts for guest appearances |
| **Social Sentiment** | Social media sentiment analysis per leader |

---

## 📧 PDF Report

The emailed PDF includes all sections as separate pages:
1. Cover Page (branded)
2. Executive Overview
3. Company Analysis
4. Leadership Analysis
5. Competitor Gap Analysis
6. Podcast Opportunities
7. Social Sentiment Analysis
8. Contact/CTA Page

---

**Version 4.0** | Built with React, Anthropic Claude, SEMRush API, PDFKit, and Resend

