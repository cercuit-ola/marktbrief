const https   = require("https");
const nodemailer = require("nodemailer");

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
          catch(e) { reject(new Error("Bad JSON: " + raw.slice(0, 200))); }
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
  const s = clean.indexOf("{"), e = clean.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error("No JSON in AI response");
  return JSON.parse(clean.slice(s, e + 1));
}

async function generateBriefing() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const today = new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  const prompt = `You are a senior financial analyst. Today is ${today}. Write a morning market briefing with realistic, specific numbers and analysis. Respond ONLY with a valid JSON object (no markdown, no text before or after the JSON):
{
  "summary": {"headline":"6-8 word market headline","mood":"bullish|bearish|neutral","sp500_snapshot":"one sentence with specific level","ngx_snapshot":"one sentence about NGX today","top_story":"one sentence top financial story"},
  "sp500": {"headline":"headline","level":"5847.23","change":"+0.42%","direction":"up","trend":"Two full analytical sentences.","sectors":["Technology: specific note","Financials: specific note","Energy: specific note"],"signal":"bullish"},
  "nigeria": {"headline":"headline","allshare":"104821.45","change":"+0.87%","direction":"up","top_movers":["DANGCEM: specific movement note","GTCO: specific movement note","ZENITHBANK: specific movement note"],"analysis":"Two analytical sentences about NGX including macro factors.","signal":"bullish"},
  "global": {"headline":"headline","indices":[{"name":"Dow Jones","value":"43891","change":"+0.31%","dir":"up"},{"name":"NASDAQ","value":"19284","change":"+0.67%","dir":"up"},{"name":"FTSE 100","value":"8412","change":"-0.18%","dir":"down"},{"name":"Crude Oil","value":"$74.21","change":"+1.12%","dir":"up"},{"name":"Gold","value":"$3042","change":"+0.44%","dir":"up"},{"name":"USD/NGN","value":"1614","change":"-0.22%","dir":"down"}],"summary":"Two sentences on global markets."},
  "news": {"headline":"macro theme","stories":[{"title":"specific news headline","impact":"one sentence impact"},{"title":"second headline","impact":"one sentence impact"},{"title":"Nigeria-focused headline","impact":"one sentence impact for Nigerian investors"}]},
  "opportunities": {"headline":"opportunity theme","picks":[{"ticker":"NVDA","name":"NVIDIA Corporation","thesis":"Two sentences on the opportunity.","signal":"bullish"},{"ticker":"JPM","name":"JPMorgan Chase","thesis":"Two sentences on the opportunity.","signal":"neutral"},{"ticker":"NGX:GTCO","name":"Guaranty Trust Holding Co.","thesis":"Two sentences on Nigerian opportunity.","signal":"bullish"}],"disclaimer":"For informational purposes only. Not financial advice."}
}`;

  const result = await httpsPost(
    "generativelanguage.googleapis.com",
    `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    { "Content-Type": "application/json" },
    { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 4096 } }
  );

  if (result.error) throw new Error("Gemini error: " + result.error.message);
  return extractJSON(result.candidates[0].content.parts[0].text);
}

function buildEmailHTML(data) {
  const dateStr = new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
  const badge = (sig) => {
    const c = { bullish:"background:#e8f5e9;color:#1a6b3a", bearish:"background:#fdecea;color:#c0392b", neutral:"background:#fef9e7;color:#c9a84c" };
    return `<span style="${c[sig]||c.neutral};padding:2px 8px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;font-family:monospace">${sig||"neutral"}</span>`;
  };
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f0e8;font-family:Georgia,serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px">
<table width="620" cellpadding="0" cellspacing="0" style="background:#f5f0e8">
<tr><td style="padding:24px 24px 0">
<!-- header -->
<table width="100%" cellpadding="0" cellspacing="0" style="border-bottom:3px double #0a0a0f;margin-bottom:20px;padding-bottom:14px">
<tr><td align="center" style="font-family:monospace;font-size:9px;letter-spacing:3px;color:#7a7a8a;text-transform:uppercase;padding-bottom:6px">AI-POWERED FINANCIAL INTELLIGENCE</td></tr>
<tr><td align="center" style="font-size:40px;color:#0a0a0f;font-family:Georgia,serif;line-height:1.1">The Market <em style="color:#c9a84c">Brief</em></td></tr>
<tr><td align="center" style="font-family:monospace;font-size:10px;color:#7a7a8a;padding-top:6px">${dateStr.toUpperCase()}</td></tr>
</table>
<!-- mood -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;margin-bottom:18px">
<tr><td style="padding:14px 18px">
<div style="font-family:monospace;font-size:9px;color:#c9a84c;letter-spacing:3px;text-transform:uppercase;margin-bottom:4px">TODAY'S SIGNAL</div>
<div style="font-size:19px;color:#f5f0e8;font-style:italic;font-family:Georgia,serif">${data.summary?.headline||""}</div>
<div style="margin-top:8px">${badge(data.summary?.mood)}</div>
</td></tr></table>
<!-- snapshot -->
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d4cfc4;background:white;margin-bottom:18px">
<tr>
<td width="50%" valign="top" style="padding:12px 16px;border-right:1px solid #d4cfc4">
<div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#7a7a8a;text-transform:uppercase;margin-bottom:4px">S&amp;P 500</div>
<div style="font-size:28px;color:#0a0a0f;font-family:Georgia,serif">${data.sp500?.level||"—"}</div>
<div style="font-family:monospace;font-size:12px;font-weight:700;color:${data.sp500?.direction==="up"?"#1a6b3a":"#c0392b"}">${data.sp500?.change||""}</div>
<div style="font-size:12px;color:#2c2c3a;margin-top:6px;line-height:1.6;font-family:Georgia,serif">${data.sp500?.trend||""}</div>
</td>
<td width="50%" valign="top" style="padding:12px 16px">
<div style="font-family:monospace;font-size:9px;letter-spacing:2px;color:#7a7a8a;text-transform:uppercase;margin-bottom:4px">NGX ALL-SHARE</div>
<div style="font-size:28px;color:#0a0a0f;font-family:Georgia,serif">${data.nigeria?.allshare||"—"}</div>
<div style="font-family:monospace;font-size:12px;font-weight:700;color:${data.nigeria?.direction==="up"?"#1a6b3a":"#c0392b"}">${data.nigeria?.change||""}</div>
<div style="font-size:12px;color:#2c2c3a;margin-top:6px;line-height:1.6;font-family:Georgia,serif">${data.nigeria?.analysis||""}</div>
</td>
</tr></table>
<!-- global -->
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d4cfc4;background:white;margin-bottom:18px">
<tr><td style="padding:10px 16px;border-bottom:2px solid #0a0a0f">
<div style="font-family:monospace;font-size:9px;letter-spacing:3px;color:#c9a84c;text-transform:uppercase">GLOBAL MARKETS</div>
<div style="font-size:16px;font-family:Georgia,serif">${data.global?.headline||""}</div>
</td></tr>
<tr><td style="padding:12px 16px">
${(data.global?.indices||[]).map(i=>`
<table width="100%" cellpadding="2" cellspacing="0" style="border-bottom:1px solid #f0ece4">
<tr><td style="font-family:monospace;font-size:11px;color:#0a0a0f">${i.name}</td>
<td align="center" style="font-size:14px;font-family:Georgia,serif">${i.value}</td>
<td align="right" style="font-family:monospace;font-size:11px;font-weight:700;color:${i.dir==="up"?"#1a6b3a":"#c0392b"}">${i.change}</td>
</tr></table>`).join("")}
<div style="font-size:12px;color:#2c2c3a;line-height:1.7;margin-top:10px;font-family:Georgia,serif">${data.global?.summary||""}</div>
</td></tr></table>
<!-- news -->
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d4cfc4;background:white;margin-bottom:18px">
<tr><td style="padding:10px 16px;border-bottom:2px solid #0a0a0f">
<div style="font-family:monospace;font-size:9px;letter-spacing:3px;color:#c9a84c;text-transform:uppercase">WORLD NEWS</div>
<div style="font-size:16px;font-family:Georgia,serif">${data.news?.headline||""}</div>
</td></tr>
<tr><td style="padding:12px 16px">
${(data.news?.stories||[]).map(s=>`
<div style="border-left:3px solid #c9a84c;padding:5px 0 5px 12px;margin-bottom:12px">
<div style="font-size:13px;font-weight:700;color:#0a0a0f;font-family:Georgia,serif;margin-bottom:3px">${s.title}</div>
<div style="font-size:11px;color:#7a7a8a;line-height:1.6;font-family:Georgia,serif">${s.impact}</div>
</div>`).join("")}
</td></tr></table>
<!-- picks -->
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #d4cfc4;background:white;margin-bottom:18px">
<tr><td style="padding:10px 16px;border-bottom:2px solid #0a0a0f">
<div style="font-family:monospace;font-size:9px;letter-spacing:3px;color:#c9a84c;text-transform:uppercase">INVESTMENT OPPORTUNITIES</div>
<div style="font-size:16px;font-family:Georgia,serif">${data.opportunities?.headline||""}</div>
</td></tr>
<tr><td style="padding:12px 16px">
${(data.opportunities?.picks||[]).map(p=>`
<div style="border-bottom:1px solid #e8e4dc;padding:10px 0">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-family:monospace;font-size:13px;font-weight:700">${p.ticker}</td>
<td align="center" style="font-size:11px;color:#7a7a8a;font-family:Georgia,serif">${p.name}</td>
<td align="right">${badge(p.signal)}</td>
</tr></table>
<div style="font-size:12px;color:#2c2c3a;line-height:1.7;margin-top:6px;font-family:Georgia,serif">${p.thesis}</div>
</div>`).join("")}
<div style="font-family:monospace;font-size:9px;color:#7a7a8a;margin-top:10px;line-height:1.6">${data.opportunities?.disclaimer||""}</div>
</td></tr></table>
<!-- footer -->
<table width="100%" cellpadding="0" cellspacing="0" style="border-top:3px double #0a0a0f;padding-top:12px;margin-top:4px">
<tr><td align="center" style="font-family:monospace;font-size:9px;color:#7a7a8a;line-height:1.9">
THE MARKET BRIEF · AI-GENERATED DAILY INTELLIGENCE<br>
Generated ${new Date().toLocaleTimeString()} · Indicative data only<br>
<span style="color:#c9a84c">Not financial advice. Do your own research.</span>
</td></tr></table>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };

  let recipientEmail;
  try { recipientEmail = JSON.parse(event.body || "{}").email; } catch { recipientEmail = null; }
  if (!recipientEmail) return { statusCode: 400, headers, body: JSON.stringify({ error: "email is required" }) };

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) return { statusCode: 500, headers, body: JSON.stringify({ error: "SMTP_USER / SMTP_PASS not set in environment" }) };

  try {
    const data = await generateBriefing();
    const html = buildEmailHTML(data);

    const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: smtpUser, pass: smtpPass } });
    await transporter.sendMail({
      from: `"The Market Brief 📊" <${smtpUser}>`,
      to: recipientEmail,
      subject: `📊 Market Brief — ${new Date().toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}`,
      html,
    });

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: `Sent to ${recipientEmail}` }) };
  } catch(err) {
    console.error("send error:", err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
