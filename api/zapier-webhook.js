// api/zapier-webhook.js — Send lead data to Zapier webhook (shared with Adsmith)
// Posts form data + source_tool identifier to the same webhook/sheet

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
    const webhookUrl = process.env.ZAPIER_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({ error: 'ZAPIER_WEBHOOK_URL not configured' });
    }

    const {
      // Contact info
      email,
      name,
      companyName,
      website,
      industry,
      // Form fields specific to Beacon
      keywords,
      leadership,
      competitors,
      checkLocalSeo,
      address,
    } = req.body || {};

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Build payload matching Adsmith's shared fields + Beacon extras
    const payload = {
      // Shared fields (same as Adsmith)
      email: email,
      name: name || '',
      companyName: companyName || '',
      websiteUrl: website || '',
      industry: industry || '',
      // Beacon specific fields
      keywords: Array.isArray(keywords) ? keywords.filter(Boolean).join(', ') : (keywords || ''),
      leadership: Array.isArray(leadership)
        ? leadership.filter(l => l.name).map(l => `${l.name} (${l.title || l.role || 'N/A'})`).join('; ')
        : '',
      competitors: Array.isArray(competitors)
        ? competitors.filter(c => c.name).map(c => `${c.name}${c.website ? ' - ' + c.website : ''}`).join('; ')
        : '',
      checkLocalSeo: checkLocalSeo ? 'Yes' : 'No',
      address: address || '',
      // Identification
      source_tool: 'Beacon',
      timestamp: new Date().toISOString(),
    };

    // Send to Zapier
    const zapResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!zapResponse.ok) {
      const errText = await zapResponse.text();
      console.error('Zapier webhook error:', errText);
      return res.status(500).json({ error: 'Failed to send data to webhook' });
    }

    return res.status(200).json({
      success: true,
      message: 'Lead data sent successfully',
    });

  } catch (error) {
    console.error('Zapier webhook error:', error);
    return res.status(500).json({ error: 'Failed to send lead data: ' + error.message });
  }
};
