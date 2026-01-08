# Entity SEO Checker v3.0

**AI Search Visibility & Backlink Analysis Tool**  
Built by Abstrakt Marketing Group

---  

## 🚀 Features

- **AI Search Visibility Analysis** - See how your brand appears across ChatGPT, Gemini, Claude, Perplexity, and Copilot
- **SEMRush Backlink Data** - Real domain authority scores, backlink counts, and referring domains
- **Competitor Gap Analysis** - Side-by-side comparison of backlink profiles
- **Leadership Sentiment Scoring** - Track executive reputation across AI platforms
- **PDF Report Generation** - Professional reports generated server-side
- **Email Delivery** - Send reports directly to clients via Resend

---

## 📋 Setup Instructions

### Step 1: Create a Resend Account (Email Service)

1. Go to [resend.com](https://resend.com)
2. Click **"Start Building"** → Sign up
3. Go to **"API Keys"** → **"Create API Key"**
4. Name: `Entity SEO Checker`, Permission: **Full access**
5. Copy the key (starts with `re_...`)

> **Note:** The default `onboarding@resend.dev` sender works immediately. To use your own domain (e.g., `reports@abstraktmg.com`), add it under **Domains** and verify DNS.

---

### Step 2: Get Your SEMRush API Key

1. Log into [semrush.com](https://www.semrush.com)
2. Go to **Settings → API** (or Profile → Subscription Info → API)
3. Copy your API key

> **Note:** SEMRush API requires a paid plan with API access enabled.

---

### Step 3: Add Environment Variables to Vercel

1. Go to [vercel.com](https://vercel.com) → Your Project
2. Click **Settings** → **Environment Variables**
3. Add these variables:

| Name | Value | Description |
|------|-------|-------------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Claude API for AI analysis |
| `SEMRUSH_API_KEY` | Your key | Backlink & domain data |
| `RESEND_API_KEY` | `re_...` | Email delivery |

4. **Important:** Click **Redeploy** after adding variables!

---

### Step 4: Deploy to Vercel

**Option A: Update Existing Deployment**
1. Download the zip file
2. Extract and replace all files in your GitHub repo
3. Commit changes → Vercel auto-deploys

**Option B: New Deployment**
1. Upload files to a new GitHub repository
2. Go to Vercel → **Add New Project** → Import repo
3. Add environment variables before deploying
4. Deploy

---

## 🧪 Testing Your Setup

After deployment, visit: `https://your-app.vercel.app/api/test`

This will show the status of all three API integrations:
- ✅ Anthropic API (AI analysis)
- ✅ SEMRush API (backlink data)  
- ✅ Resend API (email delivery)

---

## 📁 Project Structure

```
entity-seo-checker/
├── api/
│   ├── analyze.js      # AI visibility analysis (Anthropic)
│   ├── semrush.js      # Backlink & authority data
│   ├── send-report.js  # PDF generation + email
│   └── test.js         # API diagnostics
├── src/
│   ├── App.js
│   ├── EntitySEOChecker.js  # Main component
│   ├── index.css
│   └── index.js
├── public/
│   └── index.html
├── package.json
├── vercel.json
└── .gitignore
```

---

## 💰 API Costs

| Service | Cost | Notes |
|---------|------|-------|
| Anthropic API | ~$3-15/M tokens | ~$0.10-0.30 per analysis |
| Anthropic Web Search | $10/1,000 searches | Included in analysis |
| SEMRush API | Per your plan | Check your SEMRush subscription |
| Resend | Free: 3,000 emails/mo | Plenty for most use cases |

**Cost-saving tips:**
- Select only ChatGPT + Gemini (default)
- Limit competitors to 1-2
- Run test analyses sparingly

---

## 🔧 Troubleshooting

### "API key not configured"
→ Add the missing key in Vercel → Settings → Environment Variables → **Redeploy**

### "SEMRush API error"
→ Check your SEMRush subscription includes API access
→ Verify the API key is correct

### "Email failed to send"
→ Check Resend API key is valid
→ View Resend dashboard for delivery logs

### "Analysis taking too long"
→ Web search can take 30-60 seconds
→ Check Vercel function logs for errors

---

## 🔜 Future: Custom Email Domain

When ready to send from `@abstraktmg.com`:

1. Go to [resend.com](https://resend.com) → **Domains**
2. Click **Add Domain** → Enter `abstraktmg.com`
3. Add the DNS records Resend provides (work with IT)
4. Wait for verification (usually 24-48 hours)
5. Update `api/send-report.js` line 51:
   ```javascript
   from: 'Entity SEO Report <reports@abstraktmg.com>',
   ```

---

## 📧 Support

Questions? Contact the Abstrakt Marketing Group development team.

---

**Version 3.0** | Built with React, Anthropic Claude, SEMRush API, PDFKit, and Resend
