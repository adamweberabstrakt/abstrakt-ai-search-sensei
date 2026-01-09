const Anthropic = require("@anthropic-ai/sdk").default;

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  console.log("=== Analyze API Request ===");

  try {
    const { query, llmName, analysisType } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: "API key not configured",
        hint: "Add ANTHROPIC_API_KEY to Vercel environment variables"
      });
    }

    const client = new Anthropic({ apiKey });

    // Build prompt based on analysis type
    let promptAddition = "";
    let jsonStructure = "";

    if (analysisType === "press") {
      promptAddition = "Focus on finding press opportunities, media outlets, industry publications, speaking engagements, and places where this person could contribute articles or be featured.";
      jsonStructure = `{
  "summary": "2-3 sentence summary of press/media opportunities",
  "entityFound": true/false,
  "confidenceScore": 1-10,
  "pressOpportunities": [{"outlet": "publication/media name", "type": "press release/feature/interview/contributed article/podcast/speaking", "relevance": "high/medium/low", "notes": "why this is a good fit"}],
  "recommendations": "specific actionable recommendation for getting press coverage"
}`;
    } else if (analysisType === "social") {
      promptAddition = "Focus on analyzing social media presence, sentiment on LinkedIn, Twitter/X, industry forums, and online discussions. Look for positive mentions, concerns, thought leadership presence, and overall reputation.";
      jsonStructure = `{
  "summary": "2-3 sentence summary of social media sentiment and online reputation",
  "entityFound": true/false,
  "confidenceScore": 1-10,
  "sentimentScore": 1-10 (10 = very positive sentiment),
  "sentiment": "positive/neutral/negative",
  "platforms": [{"platform": "LinkedIn/Twitter/Forum name", "sentiment": "positive/neutral/negative", "notes": "key observations"}],
  "positiveHighlights": ["positive mention 1", "positive mention 2"],
  "concerns": ["concern or negative mention if any"],
  "recommendations": "specific recommendation for improving social sentiment"
}`;
    } else if (analysisType === "podcast") {
      promptAddition = "Focus on finding specific podcasts that would be good for executives to appear on as guests. Include both industry-specific podcasts and broader business podcasts. Provide podcast names, topics, and audience size estimates.";
      jsonStructure = `{
  "summary": "2-3 sentence summary of podcast opportunity landscape",
  "entityFound": true/false,
  "confidenceScore": 1-10,
  "podcastOpportunities": [{"name": "podcast name", "topic": "main topics covered", "audienceSize": "small/medium/large", "host": "host name if known", "fit": "why this is a good match"}],
  "recommendations": "strategy for approaching podcasts and what topics to pitch"
}`;
    } else if (analysisType === "leadership") {
      promptAddition = "Focus on the person's online reputation, sentiment, thought leadership presence, media appearances, and speaking engagements.";
      jsonStructure = `{
  "summary": "2-3 sentence summary of this person's online presence",
  "entityFound": true/false,
  "confidenceScore": 1-10,
  "sentimentScore": 1-10 (10 = very positive reputation),
  "sentiment": "positive/neutral/negative",
  "mediaAppearances": [{"outlet": "name", "type": "podcast/interview/article", "title": "if found"}],
  "topSources": [{"url": "url", "title": "title", "snippet": "description"}],
  "recommendations": "specific recommendation for improving thought leadership presence"
}`;
    } else if (analysisType === "competitor") {
      promptAddition = "Analyze this competitor's online presence, content strategy, backlink profile, and key differentiators.";
      jsonStructure = `{
  "summary": "2-3 sentence competitive analysis",
  "entityFound": true/false,
  "confidenceScore": 1-10,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "keyBacklinks": [{"url": "url", "type": "press/editorial/directory", "domainAuthority": 1-100}],
  "contentStrategy": "brief description of their content approach",
  "recommendations": "how to compete or differentiate"
}`;
    } else {
      // Default entity analysis
      jsonStructure = `{
  "summary": "2-3 sentence summary of findings",
  "entityFound": true/false,
  "confidenceScore": 1-10,
  "sentimentScore": 1-10 (10 = very positive),
  "sentiment": "positive/neutral/negative",
  "topSources": [{"url": "url", "title": "title", "snippet": "description", "domainAuthority": 1-100}],
  "backlinks": [{"url": "url", "anchorText": "text", "domainAuthority": 1-100, "type": "editorial/directory/press"}],
  "pressOpportunities": [{"outlet": "name", "type": "press release/feature/interview", "relevance": "high/medium/low"}],
  "podcastOpportunities": [{"name": "podcast name", "topic": "relevant topic", "audienceSize": "small/medium/large"}],
  "recommendations": "specific actionable recommendation"
}`;
    }

    console.log(`Analyzing: ${query.substring(0, 100)}...`);
    console.log(`LLM: ${llmName}, Type: ${analysisType}`);

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5
        }
      ],
      messages: [
        {
          role: "user",
          content: `You are simulating how the AI search engine "${llmName}" would respond to a query. Search the web thoroughly to find current, accurate information. ${promptAddition}

Query: ${query}

After searching, respond ONLY with valid JSON (no markdown code blocks, no extra text before or after):
${jsonStructure}`
        }
      ]
    });

    console.log("API response received, stop_reason:", response.stop_reason);

    // Extract text content
    let responseText = "";
    if (response.content) {
      responseText = response.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");
    }

    // Parse JSON response
    let parsedResponse;
    try {
      // Remove markdown code blocks if present
      let cleanText = responseText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON object found in response");
      }
    } catch (parseError) {
      console.log("JSON parse error:", parseError.message);
      console.log("Raw response:", responseText.substring(0, 500));
      
      parsedResponse = {
        summary: responseText || "Analysis completed but response format was unexpected",
        entityFound: responseText.length > 100,
        confidenceScore: 5,
        sentimentScore: 5,
        sentiment: "neutral",
        topSources: [],
        backlinks: [],
        pressOpportunities: [],
        podcastOpportunities: [],
        recommendations: "Please try again or refine your search criteria",
        _parseError: true
      };
    }

    return res.status(200).json(parsedResponse);

  } catch (error) {
    console.error("=== API ERROR ===");
    console.error("Error:", error.message);
    
    let errorResponse = {
      error: "Analysis failed",
      message: error.message,
      type: error.name
    };

    if (error.status === 401) {
      errorResponse.hint = "Invalid API key. Check ANTHROPIC_API_KEY in Vercel.";
    } else if (error.status === 429) {
      errorResponse.hint = "Rate limited. Add credits or wait.";
    } else if (error.status === 500) {
      errorResponse.hint = "Anthropic server error. Try again later.";
    }

    return res.status(500).json(errorResponse);
  }
};
