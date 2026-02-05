// api/local-seo.js — Google Places API for local SEO audit
// Returns: business listing details, rating, reviews, NAP data, photos

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
    const { companyName, address, website } = req.body || {};

    if (!companyName) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API;
    if (!apiKey) {
      return res.status(500).json({ error: 'GOOGLE_MAPS_API not configured' });
    }

    // Step 1: Find the business using Text Search
    const searchQuery = address
      ? `${companyName} ${address}`
      : companyName;

    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(searchQuery)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (searchData.status !== 'OK' || !searchData.results?.length) {
      return res.status(200).json({
        found: false,
        message: 'No Google Maps listing found for this business. This is an opportunity — claiming and optimizing a Google Business Profile is critical for local SEO.',
        recommendation: 'Create a Google Business Profile at business.google.com'
      });
    }

    // Take the top result
    const place = searchData.results[0];
    const placeId = place.place_id;

    // Step 2: Get detailed place info
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,reviews,opening_hours,business_status,types,url&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    if (detailsData.status !== 'OK') {
      return res.status(200).json({
        found: false,
        message: 'Could not retrieve listing details.',
      });
    }

    const details = detailsData.result;

    // Step 3: NAP Audit — check consistency
    const napAudit = runNAPAudit(details, companyName, address, website);

    // Step 4: Review analysis
    const reviewAnalysis = analyzeReviews(details.reviews || []);

    const result = {
      found: true,
      listing: {
        name: details.name || 'N/A',
        address: details.formatted_address || 'N/A',
        phone: details.formatted_phone_number || 'Not listed',
        website: details.website || 'Not listed',
        rating: details.rating || 0,
        totalReviews: details.user_ratings_total || 0,
        businessStatus: details.business_status || 'Unknown',
        hasHours: !!(details.opening_hours?.weekday_text?.length),
        hours: details.opening_hours?.weekday_text || [],
        googleMapsUrl: details.url || '',
        categories: details.types || [],
      },
      napAudit: napAudit,
      reviewAnalysis: reviewAnalysis,
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('Local SEO API error:', error);
    return res.status(500).json({ error: 'Failed to analyze local SEO: ' + error.message });
  }
};

// NAP (Name, Address, Phone) consistency audit
function runNAPAudit(details, inputName, inputAddress, inputWebsite) {
  const issues = [];
  const checks = [];

  // Name check
  const listedName = (details.name || '').toLowerCase();
  const givenName = (inputName || '').toLowerCase();
  const nameMatch = listedName.includes(givenName) || givenName.includes(listedName);
  checks.push({
    field: 'Business Name',
    listed: details.name || 'N/A',
    status: nameMatch ? 'match' : 'mismatch',
  });
  if (!nameMatch) issues.push('Business name on Google does not match the name you provided.');

  // Address check
  if (inputAddress) {
    const listedAddr = (details.formatted_address || '').toLowerCase();
    const givenAddr = inputAddress.toLowerCase();
    // Simple check — see if key parts of the address appear
    const addrParts = givenAddr.split(/[,\s]+/).filter(p => p.length > 2);
    const addrMatch = addrParts.filter(p => listedAddr.includes(p)).length >= Math.floor(addrParts.length * 0.5);
    checks.push({
      field: 'Address',
      listed: details.formatted_address || 'N/A',
      status: addrMatch ? 'match' : 'mismatch',
    });
    if (!addrMatch) issues.push('Address on Google does not match the address you provided.');
  }

  // Website check
  if (inputWebsite) {
    const listedSite = (details.website || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const givenSite = inputWebsite.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const siteMatch = listedSite === givenSite || listedSite.includes(givenSite) || givenSite.includes(listedSite);
    checks.push({
      field: 'Website',
      listed: details.website || 'Not listed',
      status: siteMatch ? 'match' : (details.website ? 'mismatch' : 'missing'),
    });
    if (!details.website) issues.push('No website listed on Google Business Profile.');
    else if (!siteMatch) issues.push('Website on Google does not match your actual website.');
  }

  // Phone check
  if (!details.formatted_phone_number) {
    issues.push('No phone number listed on Google Business Profile.');
    checks.push({ field: 'Phone', listed: 'Not listed', status: 'missing' });
  } else {
    checks.push({ field: 'Phone', listed: details.formatted_phone_number, status: 'present' });
  }

  // Hours check
  if (!details.opening_hours?.weekday_text?.length) {
    issues.push('No business hours listed on Google Business Profile.');
  }

  const score = Math.max(0, 10 - (issues.length * 2));

  return {
    score: score,
    maxScore: 10,
    checks: checks,
    issues: issues,
    summary: issues.length === 0
      ? 'NAP data is consistent across your listing.'
      : `Found ${issues.length} issue(s) with your listing consistency.`
  };
}

// Analyze Google reviews
function analyzeReviews(reviews) {
  if (!reviews || reviews.length === 0) {
    return {
      count: 0,
      averageRating: 0,
      sentiment: 'No reviews found',
      recentReviews: [],
      recommendation: 'Start collecting reviews — businesses with 10+ reviews see significantly higher local search rankings.'
    };
  }

  const ratings = reviews.map(r => r.rating);
  const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const fiveStarPct = Math.round((ratings.filter(r => r === 5).length / ratings.length) * 100);
  const lowReviews = ratings.filter(r => r <= 2).length;

  // Get most recent 3 reviews
  const recentReviews = reviews
    .sort((a, b) => b.time - a.time)
    .slice(0, 3)
    .map(r => ({
      rating: r.rating,
      text: r.text?.substring(0, 200) || '',
      timeAgo: r.relative_time_description || '',
    }));

  let sentiment = 'Positive';
  if (avgRating < 3) sentiment = 'Negative';
  else if (avgRating < 4) sentiment = 'Mixed';

  return {
    count: reviews.length,
    averageRating: Math.round(avgRating * 10) / 10,
    fiveStarPercentage: fiveStarPct,
    lowReviewCount: lowReviews,
    sentiment: sentiment,
    recentReviews: recentReviews,
  };
}
