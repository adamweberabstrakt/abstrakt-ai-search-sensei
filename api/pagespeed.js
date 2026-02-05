// api/pagespeed.js — Google PageSpeed Insights API
// Returns: performance score, load times, core web vitals, CMS detection

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { website } = req.body || {};

    if (!website) {
      return res.status(400).json({ error: 'Website URL is required' });
    }

    const apiKey = process.env.PAGESPEED_INSIGHTS_API;
    if (!apiKey) {
      return res.status(500).json({ error: 'PAGESPEED_INSIGHTS_API not configured' });
    }

    // Normalize URL
    let url = website.trim();
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    // Fetch both mobile and desktop strategies
    const [mobileRes, desktopRes] = await Promise.all([
      fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&key=${apiKey}`),
      fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=desktop&key=${apiKey}`)
    ]);

    const mobileData = await mobileRes.json();
    const desktopData = await desktopRes.json();

    if (mobileData.error) {
      return res.status(400).json({ error: mobileData.error.message || 'PageSpeed API error' });
    }

    // Extract key metrics from Lighthouse results
    const mobileLH = mobileData.lighthouseResult || {};
    const desktopLH = desktopData.lighthouseResult || {};

    // Core Web Vitals
    const mobileAudits = mobileLH.audits || {};
    const desktopAudits = desktopLH.audits || {};

    // CMS Detection — check meta generators and known patterns
    const cms = detectCMS(mobileLH);

    const result = {
      url: url,
      mobile: {
        performanceScore: Math.round((mobileLH.categories?.performance?.score || 0) * 100),
        seoScore: Math.round((mobileLH.categories?.seo?.score || 0) * 100),
        accessibilityScore: Math.round((mobileLH.categories?.accessibility?.score || 0) * 100),
        bestPracticesScore: Math.round((mobileLH.categories?.['best-practices']?.score || 0) * 100),
        firstContentfulPaint: mobileAudits['first-contentful-paint']?.displayValue || 'N/A',
        largestContentfulPaint: mobileAudits['largest-contentful-paint']?.displayValue || 'N/A',
        totalBlockingTime: mobileAudits['total-blocking-time']?.displayValue || 'N/A',
        cumulativeLayoutShift: mobileAudits['cumulative-layout-shift']?.displayValue || 'N/A',
        speedIndex: mobileAudits['speed-index']?.displayValue || 'N/A',
        timeToInteractive: mobileAudits['interactive']?.displayValue || 'N/A',
      },
      desktop: {
        performanceScore: Math.round((desktopLH.categories?.performance?.score || 0) * 100),
        seoScore: Math.round((desktopLH.categories?.seo?.score || 0) * 100),
        accessibilityScore: Math.round((desktopLH.categories?.accessibility?.score || 0) * 100),
        bestPracticesScore: Math.round((desktopLH.categories?.['best-practices']?.score || 0) * 100),
        firstContentfulPaint: desktopAudits['first-contentful-paint']?.displayValue || 'N/A',
        largestContentfulPaint: desktopAudits['largest-contentful-paint']?.displayValue || 'N/A',
        totalBlockingTime: desktopAudits['total-blocking-time']?.displayValue || 'N/A',
        cumulativeLayoutShift: desktopAudits['cumulative-layout-shift']?.displayValue || 'N/A',
        speedIndex: desktopAudits['speed-index']?.displayValue || 'N/A',
        timeToInteractive: desktopAudits['interactive']?.displayValue || 'N/A',
      },
      cms: cms,
      // Server info if available
      serverResponseTime: mobileAudits['server-response-time']?.displayValue || 'N/A',
      usesHttps: mobileAudits['is-on-https']?.score === 1,
      hasViewport: mobileAudits['viewport']?.score === 1,
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('PageSpeed API error:', error);
    return res.status(500).json({ error: 'Failed to analyze site speed: ' + error.message });
  }
};

// Detect CMS from Lighthouse data
function detectCMS(lighthouseResult) {
  const stacks = lighthouseResult?.stackPacks || [];
  const audits = lighthouseResult?.audits || {};
  const finalUrl = lighthouseResult?.finalUrl || '';

  // Check Lighthouse stack packs (most reliable)
  for (const pack of stacks) {
    const id = (pack.id || '').toLowerCase();
    if (id.includes('wordpress')) return { name: 'WordPress', confidence: 'high' };
    if (id.includes('drupal')) return { name: 'Drupal', confidence: 'high' };
    if (id.includes('joomla')) return { name: 'Joomla', confidence: 'high' };
    if (id.includes('magento')) return { name: 'Magento', confidence: 'high' };
    if (id.includes('wix')) return { name: 'Wix', confidence: 'high' };
    if (id.includes('squarespace')) return { name: 'Squarespace', confidence: 'high' };
    if (id.includes('shopify')) return { name: 'Shopify', confidence: 'high' };
    if (id.includes('webflow')) return { name: 'Webflow', confidence: 'high' };
  }

  // Check diagnostics/rendered HTML hints
  const diagnostics = JSON.stringify(audits).toLowerCase();
  if (diagnostics.includes('wp-content') || diagnostics.includes('wp-includes')) return { name: 'WordPress', confidence: 'medium' };
  if (diagnostics.includes('squarespace')) return { name: 'Squarespace', confidence: 'medium' };
  if (diagnostics.includes('shopify')) return { name: 'Shopify', confidence: 'medium' };
  if (diagnostics.includes('wix.com')) return { name: 'Wix', confidence: 'medium' };
  if (diagnostics.includes('webflow')) return { name: 'Webflow', confidence: 'medium' };
  if (diagnostics.includes('hubspot')) return { name: 'HubSpot CMS', confidence: 'medium' };
  if (diagnostics.includes('duda')) return { name: 'Duda', confidence: 'medium' };

  return { name: 'Unknown', confidence: 'low' };
}
