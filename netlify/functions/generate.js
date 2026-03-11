const https = require("https");

// ─── helpers ────────────────────────────────────────────────────────────────
function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req  = https.request(
      { hostname, path, method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(data) } },
      (res) => {
        let raw = "";
        res.on("data", c => raw += c);
        res.on("end", () => {
          try { resolve(JSON.parse(raw)); }
          catch(e) { reject(new Error("Bad JSON from AI: " + raw.slice(0, 200))); }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

function extractJSON(text) {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end   = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in AI response");
  return JSON.parse(clean.slice(start, end + 1));
}

// ─── AI call ────────────────────────────────────────────────────────────────
async function generateBriefing() {
  const apiKey  = process.env.GEMINI_API_KEY;
  if (!apiKey)  throw new Error("GEMINI_API_KEY is not set in environment variables");

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const prompt = `You are a senior financial analyst writing a morning market briefing. Today is ${today}.

Write a detailed, realistic briefing. Use plausible, specific numbers based on recent market knowledge.
Include real company names, realistic index levels, and concrete analysis.

Respond with ONLY a valid JSON object — no markdown fences, no explanation text before or after. Start your response with { and end with }.

{
  "summary": {
    "headline": "Write a punchy 6-8 word headline capturing today's market mood",
    "mood": "bullish",
    "sp500_snapshot": "Write one specific sentence about S&P 500 today with a plausible level",
    "ngx_snapshot": "Write one specific sentence about Nigerian Stock Exchange today",
    "top_story": "Write one sentence about the single most important financial story today"
  },
  "sp500": {
    "headline": "Write a descriptive S&P 500 headline for today",
    "level": "5847.23",
    "change": "+0.42%",
    "direction": "up",
    "trend": "Write two full sentences analysing the current S&P 500 trend, what is driving it, and what investors should watch.",
    "sectors": [
      "Technology: Write a specific note on tech sector performance today",
      "Financials: Write a specific note on financials sector today",
      "Energy: Write a specific note on energy sector today"
    ],
    "signal": "bullish"
  },
  "nigeria": {
    "headline": "Write a descriptive NGX headline for today",
    "allshare": "104821.45",
    "change": "+0.87%",
    "direction": "up",
    "top_movers": [
      "DANGCEM: Write why this stock moved today and by how much",
      "GTCO: Write why this stock moved today and by how much",
      "ZENITHBANK: Write why this stock moved today and by how much"
    ],
    "analysis": "Write two sentences analysing the Nigerian stock market today, including oil prices, CBN policy, or FX factors.",
    "signal": "bullish"
  },
  "global": {
    "headline": "Write a global markets theme headline",
    "indices": [
      {"name": "Dow Jones",  "value": "43891", "change": "+0.31%", "dir": "up"},
      {"name": "NASDAQ",     "value": "19284", "change": "+0.67%", "dir": "up"},
      {"name": "FTSE 100",   "value": "8412",  "change": "-0.18%", "dir": "down"},
      {"name": "Crude Oil",  "value": "$74.21","change": "+1.12%", "dir": "up"},
      {"name": "Gold",       "value": "$3042", "change": "+0.44%", "dir": "up"},
      {"name": "USD/NGN",    "value": "1614",  "change": "-0.22%", "dir": "down"}
    ],
    "summary": "Write two sentences describing today's overall global market picture and the key macro driver."
  },
  "news": {
    "headline": "Write today's dominant macro theme as a headline",
    "stories": [
      {
        "title": "Write a specific, realistic financial news headline",
        "impact": "Write one clear sentence explaining the market impact of this story."
      },
      {
        "title": "Write a second specific financial news headline",
        "impact": "Write one clear sentence explaining the market impact of this story."
      },
      {
        "title": "Write a Nigeria or Africa-focused financial news headline",
        "impact": "Write one sentence explaining why this matters to Nigerian investors specifically."
      }
    ]
  },
  "opportunities": {
    "headline": "Write a theme headline for today's investment opportunities",
    "picks": [
      {
        "ticker": "NVDA",
        "name": "NVIDIA Corporation",
        "thesis": "Write two sentences explaining the investment opportunity, recent catalyst, and near-term outlook.",
        "signal": "bullish"
      },
      {
        "ticker": "JPM",
        "name": "JPMorgan Chase",
        "thesis": "Write two sentences explaining the investment case, key risk/reward, and catalyst.",
        "signal": "neutral"
      },
      {
        "ticker": "NGX:GTCO",
        "name": "Guaranty Trust Holding Co.",
        "thesis": "Write two sentences explaining this Nigerian stock opportunity, its fundamentals, and local market context.",
        "signal": "bullish"
      }
    ],
    "disclaimer": "For informational purposes only. Not financial advice. Always conduct your own research before investing."
  }
}`;

  const result = await httpsPost(
    "generativelanguage.googleapis.com",
    `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    { "Content-Type": "application/json" },
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
    }
  );

  if (result.error) throw new Error("Gemini API error: " + result.error.message);
  if (!result.candidates?.[0]?.content?.parts?.[0]?.text)
    throw new Error("Unexpected Gemini response shape: " + JSON.stringify(result).slice(0, 300));

  const text = result.candidates[0].content.parts[0].text;
  return extractJSON(text);
}

// ─── Netlify handler ─────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {
    const data = await generateBriefing();
    return { statusCode: 200, headers, body: JSON.stringify({ success: true, data }) };
  } catch (err) {
    console.error("generate error:", err);
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
