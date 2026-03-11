# 📊 The Market Brief — Netlify Edition

AI morning market agent. Click **Generate** → get a full formatted briefing covering S&P 500, NGX Nigeria, global markets, world news, and investment picks. Send to email on demand or daily at 9AM.

**The Gemini API key lives on the server. Users just click a button.**

---

## 🗂 Structure
```
market-brief/
├── index.html                        ← entire React frontend (no build needed)
├── netlify/functions/
│   ├── generate.js                   ← POST /.netlify/functions/generate
│   └── send.js                       ← POST /.netlify/functions/send
├── netlify.toml                      ← Netlify config
└── package.json                      ← only nodemailer needed
```

---

## 🚀 Deploy to Netlify (3 minutes)

### Option A — Drag & Drop (fastest, no CLI)
1. Go to **app.netlify.com** → "Add new site" → "Deploy manually"
2. Drag the entire `market-brief` folder into the upload box
3. Done — you get a live URL instantly

### Option B — GitHub
1. Push this folder to a GitHub repo
2. app.netlify.com → "Add new site" → "Import from Git"
3. Build command: *(leave blank)*  |  Publish directory: `.`
4. Deploy

---

## 🔑 Environment Variables

After deploying, go to **Netlify Dashboard → Site → Environment Variables** and add:

| Variable          | Value                        | What it's for              |
|-------------------|------------------------------|----------------------------|
| `GEMINI_API_KEY`  | `AIzaSy...`                  | Generates the briefing     |
| `SMTP_USER`       | `yourgmail@gmail.com`        | Sends the email            |
| `SMTP_PASS`       | `xxxx xxxx xxxx xxxx`        | Gmail App Password         |

After adding env vars → **Trigger deploy** once to activate them.

---

## 🆓 Getting a Free Gemini API Key

1. Go to **aistudio.google.com**
2. Sign in with Google
3. Click "Get API key" → Create API key
4. Copy and paste as `GEMINI_API_KEY`

Free tier: **1,500 requests/day** — more than enough.

---

## 📧 Gmail App Password (for email sending)

1. **myaccount.google.com** → Security
2. Enable **2-Step Verification**
3. Search "App Passwords" → Select "Mail" → Generate
4. Copy the 16-character password → paste as `SMTP_PASS`

---

## 💻 Local Development

```bash
npm install -g netlify-cli
npm install
netlify dev
# App runs at http://localhost:8888
```

Create a `.env` file (copy from `.env.example`) with your keys.

---

*Not financial advice. Always do your own research.*
