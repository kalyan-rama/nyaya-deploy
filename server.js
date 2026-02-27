// server.js — NYAYA Proxy (Gemini, instant response, no waiting)
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

try {
  const env = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  env.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.substring(0, eqIdx).trim();
    let val = trimmed.substring(eqIdx + 1).trim();
    if (val.indexOf(' #') !== -1) val = val.substring(0, val.indexOf(' #')).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (key) process.env[key] = val;
  });
  console.log('✅ .env loaded');
} catch(e) { console.log('⚠️  No .env file'); }
const path = require('path');

// Serve React build files
app.use(express.static(path.join(__dirname, 'build')));

// All non-API routes → serve React app
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api') && !req.path.startsWith('/health')) {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  }
});

const API_KEY = process.env.REACT_APP_GEMINI_API_KEY || '';
const PORT = process.env.PORT || 3001;

// Models ordered by reliability + free quota
// gemini-2.0-flash-exp has highest free RPM (10 req/min vs 2 for flash)
const MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
];

// Cooldown per model (ms timestamp until available)
const cooldownUntil = {};
function available(m) { return !cooldownUntil[m] || Date.now() > cooldownUntil[m]; }
function cooldown(m, ms) { cooldownUntil[m] = Date.now() + ms; }
function nextModel() { return MODELS.find(available) || MODELS[0]; }

function geminiRequest(model, body, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/${model}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      timeout: 12000  // 12s timeout — fail fast
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('TIMEOUT')); });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Try all models, return first success — no waiting, just fast switching
async function tryAllModels(geminiBody, apiKey) {
  const tried = new Set();
  for (let pass = 0; pass < MODELS.length; pass++) {
    const model = MODELS.find(m => available(m) && !tried.has(m));
    if (!model) break;
    tried.add(model);
    try {
      const r = await geminiRequest(model, geminiBody, apiKey);
      if (r.status === 429) {
        // Rate limited — short 30s cooldown (not 60s) then try next immediately
        cooldown(model, 30000);
        console.log(`⚡ ${model} rate-limited, switching instantly...`);
        continue;
      }
      if (r.status === 404 || r.status === 400) {
        cooldown(model, 3600000);
        console.log(`❌ ${model} unavailable`);
        continue;
      }
      let parsed;
      try { parsed = JSON.parse(r.body); } catch { continue; }
      if (parsed.error) {
        const code = parsed.error.code || parsed.error.status;
        if (code === 429 || code === 'RESOURCE_EXHAUSTED') { cooldown(model, 30000); continue; }
        continue;
      }
      const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) { console.log(`✅ ${model} replied`); return { ok: true, text, model }; }
    } catch(e) {
      if (e.message === 'TIMEOUT') { console.log(`⏱ ${model} timed out`); continue; }
      console.log(`❌ ${model}: ${e.message}`);
      continue;
    }
  }
  return { ok: false };
}

// Smart legal knowledge base for INSTANT fallback (shown immediately if all models busy)
const LEGAL_KB = {
  salary: {
    title: 'Payment of Wages Act 1936',
    body: `✅ Salary must be paid by 7th of every month\n✅ File FREE complaint at Labour Commissioner\n✅ Employer penalized ₹500–₹3000 per day of delay\n✅ You can claim **double** the unpaid amount\n\n📞 Labour Helpline: **1800-11-2004** (FREE)\n📞 Free Legal Aid: **15100**\n\n👉 **Do this now:** Visit Labour Commissioner with salary slips.`,
    keys: /salary|pay|wage|employer|job|unpaid|dues/i
  },
  arrest: {
    title: 'Articles 20, 21 & 22 — Your Rights',
    body: `✅ Right to know why you are arrested\n✅ FREE lawyer guaranteed — Article 39A\n✅ Magistrate within 24 hours — mandatory\n✅ Police MUST inform your family\n✅ File Habeas Corpus if illegally detained\n\n📞 Free Legal Aid: **15100** (24/7)\n📞 Human Rights: **14433**\n\n👉 **Do this now:** Call 15100 immediately for a free lawyer.`,
    keys: /arrest|police|custody|jail|fir|lockup|detain/i
  },
  domestic: {
    title: 'Domestic Violence Act 2005',
    body: `✅ You have the right to stay in your home\n✅ Protection Order issued within 24 hours\n✅ FREE shelter homes available\n✅ File FIR at any police station — FREE\n\n📞 Women Helpline: **181** (FREE, 24/7)\n📞 Police: **100**\n📞 Legal Aid: **15100**\n\n👉 **Do this now:** Call 181 — help arrives immediately.`,
    keys: /beat|violence|husband|wife|domestic|abuse|harass|dowry/i
  },
  consumer: {
    title: 'Consumer Protection Act 2019',
    body: `✅ File complaint at consumer forum — FREE\n✅ Online: consumerhelpline.gov.in\n✅ Claim full refund + compensation\n✅ File within 2 years of the issue\n\n📞 Consumer Helpline: **1800-11-4000** (FREE)\n📞 Legal Aid: **15100**\n\n👉 **Do this now:** Call 1800-11-4000 to register your complaint.`,
    keys: /consumer|product|refund|fraud|cheat|scam|defective|online/i
  },
  tenant: {
    title: 'Rent Control Act — Tenant Rights',
    body: `✅ Landlord cannot evict without court order\n✅ Minimum 30 days written notice required\n✅ No arbitrary rent hike without legal process\n✅ File complaint at Rent Controller office\n\n📞 Free Legal Aid: **15100**\n\n👉 **Do this now:** Contact Legal Aid at 15100 — free advice immediately.`,
    keys: /tenant|rent|landlord|evict|house|room|flat|deposit/i
  },
  rti: {
    title: 'RTI Act 2005 — Right to Information',
    body: `✅ Any citizen can file RTI — costs only ₹10\n✅ Government MUST reply within 30 days\n✅ File online at: **rtionline.gov.in**\n✅ No reply? File First Appeal within 30 days\n\n📞 Free Legal Aid: **15100**\n\n👉 **Do this now:** Go to rtionline.gov.in — file in 5 minutes.`,
    keys: /rti|information|government|officer|transparency/i
  },
  posh: {
    title: 'POSH Act 2013 — Workplace Harassment',
    body: `✅ Every workplace must have Internal Committee (IC)\n✅ File complaint with IC within 3 months\n✅ IC must complete inquiry in 90 days\n✅ Employer must take action — or face penalty\n\n📞 Women Helpline: **181**\n📞 Free Legal Aid: **15100**\n\n👉 **Do this now:** File written complaint with your company's Internal Committee.`,
    keys: /harass|posh|workplace|office|sexual|molest/i
  },
  labour: {
    title: 'Labour Laws — Worker Rights',
    body: `✅ Max 48 hrs/week, overtime must be paid double\n✅ Mandatory PF contribution by employer\n✅ Minimum wage varies by state — check online\n✅ File grievance at Labour Commissioner\n\n📞 Labour Helpline: **1800-11-2004** (FREE)\n📞 Free Legal Aid: **15100**\n\n👉 **Do this now:** Call 1800-11-2004 to report any labour violation.`,
    keys: /labour|labor|worker|overtime|pf|provident|minimum wage|factory/i
  }
};

function instantLegalResponse(question) {
  const q = (question || '').toLowerCase();
  for (const topic of Object.values(LEGAL_KB)) {
    if (topic.keys.test(q)) {
      return `**⚖️ ${topic.title}**\n\n${topic.body}`;
    }
  }
  return `**⚖️ NYAYA Legal AI — Your Rights at a Glance**\n\nI can help you with:\n💼 **Salary issues** → Payment of Wages Act\n👮 **Police & arrest** → Articles 20, 21, 22\n🏠 **Tenant rights** → Rent Control Act\n👩 **Women's safety** → Domestic Violence Act 2005\n🛒 **Consumer fraud** → Consumer Protection Act 2019\n📜 **RTI applications** → RTI Act 2005\n🏭 **Labour rights** → Labour Laws\n\n📞 **Free Legal Aid: 15100** (24/7, completely free)\n\n👉 **Please describe your problem in more detail** — e.g. "my employer didn't pay salary for 2 months" and I'll give you the exact law and steps.`;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      let payload;
      try { payload = JSON.parse(body); } catch {
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'Invalid JSON'})); return;
      }

      if (!API_KEY) {
        res.writeHead(500, {'Content-Type':'application/json'});
        res.end(JSON.stringify({error:'GEMINI_KEY_MISSING: Add REACT_APP_GEMINI_API_KEY to .env'})); return;
      }

      const geminiBody = {
        contents: payload.contents,
        generationConfig: { maxOutputTokens: 600, temperature: 0.7 }
      };
      if (payload.systemInstruction) {
        geminiBody.system_instruction = { parts: [{ text: payload.systemInstruction }] };
      }

      // Get the last user message for instant fallback
      const lastMsg = payload.contents?.slice(-1)?.[0]?.parts?.[0]?.text || '';

      // Race: try Gemini with 10s timeout
      // If it fails/times out → instant legal response, NO waiting
      const result = await Promise.race([
        tryAllModels(geminiBody, API_KEY),
        new Promise(r => setTimeout(() => r({ ok: false, timedOut: true }), 10000))
      ]);

      if (result.ok) {
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({
          candidates: [{ content: { parts: [{ text: result.text }] } }]
        }));
      } else {
        // Instant intelligent fallback — responds in <1ms
        const fallbackText = instantLegalResponse(lastMsg);
        console.log(result.timedOut ? '⚡ Timeout — instant fallback' : '⚡ All models busy — instant fallback');
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({
          candidates: [{ content: { parts: [{ text: fallbackText }] } }],
          _source: 'legal-kb'
        }));
      }
    });
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({
      status: 'ok', models: MODELS,
      available: MODELS.filter(available),
      apiKeySet: !!API_KEY,
      apiKeyPreview: API_KEY ? API_KEY.substring(0,8)+'...' : 'NOT SET'
    }));
    return;
  }
  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, () => {
  console.log('\n🟢 NYAYA Server — Instant Response Mode');
  console.log('   Models:  ' + MODELS.join(' → '));
  console.log('   URL:     http://localhost:' + PORT);
  console.log('   API Key: ' + (API_KEY ? '✅ (' + API_KEY.substring(0,8) + '...)' : '❌ NOT SET'));
  console.log('\nNow run: npm start\n');
});
