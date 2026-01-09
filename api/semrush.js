// SEMRush API Integration
// Fetches Domain Authority and Backlink data

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { domain, type = "overview" } = req.body;

  if (!domain) {
    return res.status(400).json({ error: "Domain is required" });
  }

  const apiKey = process.env.SEMRUSH_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: "SEMRush API key not configured",
      hint: "Add SEMRUSH_API_KEY to Vercel environment variables"
    });
  }

  // Clean domain (remove protocol, www, trailing slash)
  const cleanDomain = domain
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .split('/')[0];

  console.log(`SEMRush API call for: ${cleanDomain}, type: ${type}`);

  try {
    let data = {};

    if (type === "overview" || type === "all") {
      // Domain Overview - Authority Score, Traffic, etc.
      const overviewUrl = `https://api.semrush.com/?type=domain_ranks&key=${apiKey}&export_columns=Dn,Rk,Or,Ot,Oc,Ad,At,Ac,Sh,Sv&domain=${cleanDomain}&database=us`;
      
      const overviewRes = await fetch(overviewUrl);
      const overviewText = await overviewRes.text();
      
      console.log("Overview response:", overviewText.substring(0, 200));
      
      if (overviewText.includes("ERROR")) {
        data.overview = { error: overviewText };
      } else {
        data.overview = parseSemrushResponse(overviewText, [
          'domain', 'rank', 'organic_keywords', 'organic_traffic', 
          'organic_cost', 'adwords_keywords', 'adwords_traffic',
          'adwords_cost', 'pl_keywords', 'pl_traffic'
        ]);
      }
    }

    if (type === "backlinks" || type === "all") {
      // Backlink Overview
      const backlinksUrl = `https://api.semrush.com/analytics/v1/?key=${apiKey}&type=backlinks_overview&target=${cleanDomain}&target_type=root_domain&export_columns=total,domains_num,urls_num,ips_num,follows_num,nofollows_num,texts_num,images_num,forms_num,frames_num`;
      
      const backlinksRes = await fetch(backlinksUrl);
      const backlinksText = await backlinksRes.text();
      
      console.log("Backlinks response:", backlinksText.substring(0, 200));
      
      if (backlinksText.includes("ERROR")) {
        data.backlinks = { error: backlinksText };
      } else {
        data.backlinks = parseSemrushBacklinks(backlinksText);
      }

      // Top Backlinks (referring domains)
      const topBacklinksUrl = `https://api.semrush.com/analytics/v1/?key=${apiKey}&type=backlinks&target=${cleanDomain}&target_type=root_domain&export_columns=source_url,source_title,external_num,internal_num,last_seen,first_seen,anchor,form,nofollow,page_ascore&display_limit=20`;
      
      const topBacklinksRes = await fetch(topBacklinksUrl);
      const topBacklinksText = await topBacklinksRes.text();
      
      if (!topBacklinksText.includes("ERROR")) {
        data.topBacklinks = parseSemrushTopBacklinks(topBacklinksText);
      }
    }

    if (type === "authority" || type === "all") {
      // Authority Score
      const authorityUrl = `https://api.semrush.com/analytics/v1/?key=${apiKey}&type=domain_rank&target=${cleanDomain}&export_columns=domain_ascore`;
      
      const authorityRes = await fetch(authorityUrl);
      const authorityText = await authorityRes.text();
      
      console.log("Authority response:", authorityText.substring(0, 200));
      
      if (!authorityText.includes("ERROR")) {
        const lines = authorityText.trim().split('\n');
        if (lines.length > 1) {
          data.authorityScore = parseInt(lines[1]) || 0;
        }
      }
    }

    return res.status(200).json({
      domain: cleanDomain,
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("SEMRush API error:", error);
    return res.status(500).json({ 
      error: "SEMRush API call failed", 
      message: error.message 
    });
  }
};

// Parse semicolon-separated SEMRush response
function parseSemrushResponse(text, columns) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;
  
  const values = lines[1].split(';');
  const result = {};
  
  columns.forEach((col, i) => {
    result[col] = values[i] || '';
  });
  
  return result;
}

// Parse backlinks overview
function parseSemrushBacklinks(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return null;
  
  const headers = lines[0].split(';');
  const values = lines[1].split(';');
  
  return {
    total: parseInt(values[0]) || 0,
    referringDomains: parseInt(values[1]) || 0,
    referringUrls: parseInt(values[2]) || 0,
    referringIps: parseInt(values[3]) || 0,
    followLinks: parseInt(values[4]) || 0,
    nofollowLinks: parseInt(values[5]) || 0,
    textLinks: parseInt(values[6]) || 0,
    imageLinks: parseInt(values[7]) || 0
  };
}

// Parse top backlinks list
function parseSemrushTopBacklinks(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(';');
    if (values.length > 0) {
      results.push({
        sourceUrl: values[0] || '',
        sourceTitle: values[1] || '',
        externalLinks: parseInt(values[2]) || 0,
        internalLinks: parseInt(values[3]) || 0,
        lastSeen: values[4] || '',
        firstSeen: values[5] || '',
        anchor: values[6] || '',
        type: values[7] || '',
        nofollow: values[8] === '1',
        authorityScore: parseInt(values[9]) || 0
      });
    }
  }
  
  return results;
}
