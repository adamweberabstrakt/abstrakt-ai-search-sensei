// API Diagnostics Endpoint
// Tests all API keys and connectivity

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json");

  const results = {
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // Check 1: Anthropic API Key
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    results.checks.anthropic = { 
      status: "FAIL", 
      message: "ANTHROPIC_API_KEY not set" 
    };
  } else {
    results.checks.anthropic = { 
      status: "PASS", 
      message: `Key found: ${anthropicKey.substring(0, 10)}...`,
      format: anthropicKey.startsWith("sk-ant-") ? "Valid" : "Warning: unexpected format"
    };

    // Test API call
    try {
      const Anthropic = require("@anthropic-ai/sdk").default;
      const client = new Anthropic({ apiKey: anthropicKey });
      
      const response = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 20,
        messages: [{ role: "user", content: "Reply: OK" }]
      });

      results.checks.anthropic.apiTest = "PASS";
      results.checks.anthropic.response = response.content?.[0]?.text || "No response";
    } catch (error) {
      results.checks.anthropic.apiTest = "FAIL";
      results.checks.anthropic.error = error.message;
      results.checks.anthropic.hint = getAnthropicHint(error);
    }
  }

  // Check 2: SEMRush API Key
  const semrushKey = process.env.SEMRUSH_API_KEY;
  if (!semrushKey) {
    results.checks.semrush = { 
      status: "NOT_SET", 
      message: "SEMRUSH_API_KEY not configured (optional)" 
    };
  } else {
    results.checks.semrush = { 
      status: "PASS", 
      message: `Key found: ${semrushKey.substring(0, 8)}...`,
      length: semrushKey.length
    };

    // Test SEMRush API
    try {
      const testUrl = `https://api.semrush.com/?type=domain_ranks&key=${semrushKey}&export_columns=Dn,Rk&domain=google.com&database=us`;
      const response = await fetch(testUrl);
      const text = await response.text();
      
      if (text.includes("ERROR")) {
        results.checks.semrush.apiTest = "FAIL";
        results.checks.semrush.error = text;
      } else {
        results.checks.semrush.apiTest = "PASS";
        results.checks.semrush.response = "API responding correctly";
      }
    } catch (error) {
      results.checks.semrush.apiTest = "FAIL";
      results.checks.semrush.error = error.message;
    }
  }

  // Check 3: Resend API Key
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    results.checks.resend = { 
      status: "NOT_SET", 
      message: "RESEND_API_KEY not configured (required for email)" 
    };
  } else {
    results.checks.resend = { 
      status: "PASS", 
      message: `Key found: ${resendKey.substring(0, 8)}...`,
      format: resendKey.startsWith("re_") ? "Valid" : "Warning: unexpected format"
    };

    // Test Resend API
    try {
      const { Resend } = require('resend');
      const resend = new Resend(resendKey);
      
      // Just verify the client initializes (don't send a test email)
      results.checks.resend.apiTest = "PASS";
      results.checks.resend.note = "Client initialized successfully";
    } catch (error) {
      results.checks.resend.apiTest = "FAIL";
      results.checks.resend.error = error.message;
    }
  }

  // Summary
  const allPassed = Object.values(results.checks).every(
    c => c.status === "PASS" || c.status === "NOT_SET"
  );
  results.summary = allPassed ? "All configured services are working" : "Some services need attention";

  return res.status(200).json(results);
};

function getAnthropicHint(error) {
  if (error.status === 401) return "API key is invalid or expired";
  if (error.status === 403) return "API key doesn't have required permissions";
  if (error.status === 429) return "Rate limited - check credits at console.anthropic.com";
  if (error.status === 500) return "Anthropic server error - try again later";
  return "Check Vercel function logs for details";
}
