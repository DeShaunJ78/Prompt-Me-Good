# PromptMeGood — Full AI Integration Build
### Replit Handoff — April 26, 2026

> **This is a complete implementation command. Execute everything top to bottom, in order.**

---

## BEFORE YOU START

### Install dependencies
Run in the Replit **Shell** tab:
```bash
npm install openai express-rate-limit @replit/database
```

### Add your OpenAI API key
1. Open the **Secrets** tab (lock icon in the left sidebar)
2. Add: **Key** `OPENAI_API_KEY` → **Value**: your key from platform.openai.com

### Set OpenAI spend caps (do this now, before testing)
In your OpenAI dashboard:
- Daily limit: **$3**
- Monthly limit: **$50**

---

## CONTEXT

PromptMeGood is a live prompt builder at promptmegood.com. The frontend is complete. A Node.js/Express backend with `/api/generate` already exists and is connected to OpenAI via Replit Secrets.

This build upgrades the app from a template-based prompt generator into a full AI-powered product where users can:
1. Generate an optimized prompt using AI
2. Edit that prompt
3. Run it with AI directly inside the app
4. See the AI response without leaving the site

UI changes are welcome — change whatever is needed for flow and continuity.

---

## PHASE 1 — COST PROTECTION ⚠️ DO THIS FIRST

### 1A. Create `/middleware/costGuard.js`
```js
// Daily spend ceiling — stops all AI calls if daily cost exceeds limit
const Database = require('@replit/database');
const db = new Database();

const DAILY_COST_LIMIT_USD = 3.00;
const COST_PER_GENERATE = 0.004;  // ~400 in + 300 out tokens, GPT-4o
const COST_PER_RUN = 0.010;       // ~500 in + 800 out tokens, GPT-4o

async function costGuard(endpoint) {
  return async (req, res, next) => {
    const today = new Date().toISOString().slice(0, 10);
    const key = `dailySpend_${today}`;
    const spent = (await db.get(key)) || 0;
    const cost = endpoint === 'generate' ? COST_PER_GENERATE : COST_PER_RUN;

    if (spent + cost > DAILY_COST_LIMIT_USD) {
      return res.status(429).json({
        error: 'Daily usage limit reached. Service resets at midnight UTC. Try again tomorrow.'
      });
    }

    await db.set(key, spent + cost);
    next();
  };
}

module.exports = { costGuard };
```

### 1B. Create `/middleware/rateLimit.js`
```js
const rateLimit = require('express-rate-limit');

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  message: { error: 'Too many prompt generations. Please wait before trying again.' }
});

const runLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: { error: 'Too many AI executions. Please wait before trying again.' }
});

module.exports = { generateLimiter, runLimiter };
```

### 1C. Create `/middleware/sanitize.js`
```js
function sanitizeInput(req, res, next) {
  const { goal } = req.body;

  if (!goal || typeof goal !== 'string') {
    return res.status(400).json({ error: 'A goal is required.' });
  }

  if (goal.length > 500) {
    return res.status(400).json({ error: 'Goal must be under 500 characters.' });
  }

  const blocked = [
    'ignore previous instructions',
    'disregard your instructions',
    'you are now',
    'forget everything'
  ];
  const lower = goal.toLowerCase();
  if (blocked.some(phrase => lower.includes(phrase))) {
    return res.status(400).json({ error: 'Invalid input detected.' });
  }

  next();
}

module.exports = { sanitizeInput };
```

---

## PHASE 2 — BACKEND ENDPOINTS

### 2A. Update `/routes/generate.js`
Replace the existing generate endpoint entirely:
```js
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { costGuard } = require('../middleware/costGuard');
const { generateLimiter } = require('../middleware/rateLimit');
const { sanitizeInput } = require('../middleware/sanitize');
const { incrementCounter } = require('../utils/counter');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function buildSystemPrompt(body) {
  const {
    tone, experience, format, language, personality,
    extraDetails, avoid, moneyMode, humanVoice, clarityBoost, expertMode
  } = body;

  let system = `You are an expert prompt engineer. Write the most effective, structured AI prompt possible for the user's goal.

Always include:
- Role assignment ("Act as...")
- The user's goal stated clearly
- Specific constraints: tone (${tone}), experience level (${experience}), output format (${format})
- Instruction to avoid vague or generic advice
- End with: "Finish with the top 3 next actions I should take."
- Output in: ${language}`;

  if (moneyMode)    system += `\n- MONEY MODE: Prioritize fast, practical, income-focused execution. Avoid theory and vanity metrics.`;
  if (humanVoice)   system += `\n- HUMAN VOICE: Write naturally and conversationally. Avoid robotic phrasing.`;
  if (clarityBoost) system += `\n- CLARITY BOOST: Add structure, headers, and explicit formatting instructions.`;
  if (expertMode)   system += `\n- EXPERT MODE: Skip simplified explanations. Assume advanced knowledge.`;
  if (avoid)        system += `\n- The user wants to avoid: ${avoid}`;
  if (extraDetails) system += `\n- Extra context: ${extraDetails}`;

  const personalities = {
    'Bold & Persuasive':        'Write with confidence and conviction. Strong, clear, compelling.',
    'Friendly & Conversational':'Warm, approachable, encouraging tone.',
    'Direct & Straightforward': 'No preamble. Action-first. Get to the point.',
    'Faith-Based & Convicting': 'Grounded in purpose and values.',
    'Street-Smart & Practical': 'Real-world, no-nonsense, gritty and direct.',
    'Luxury Brand Voice':       'Elevated, aspirational, premium.',
    'Viral Social Media Voice': 'Punchy, hook-driven, shareable.',
    'Professional & Structured':'Formal, organized, polished.',
    'Creative & Expressive':    'Imaginative, vivid, original.'
  };

  if (personality && personalities[personality]) {
    system += `\n- Personality: ${personalities[personality]}`;
  }

  return system;
}

router.post('/', generateLimiter, costGuard('generate'), sanitizeInput, async (req, res) => {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      messages: [
        { role: 'system', content: buildSystemPrompt(req.body) },
        { role: 'user', content: `My goal: ${req.body.goal}` }
      ]
    });

    const prompt = completion.choices[0].message.content;
    await incrementCounter('promptCount');
    res.json({ prompt });

  } catch (err) {
    console.error('Generate error:', err.message);
    res.status(500).json({ error: 'Generation failed. Please try again.' });
  }
});

module.exports = router;
```

### 2B. Create `/routes/run.js`
```js
const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const { costGuard } = require('../middleware/costGuard');
const { runLimiter } = require('../middleware/rateLimit');
const { incrementCounter } = require('../utils/counter');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', runLimiter, costGuard('run'), async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'A prompt is required.' });
  }

  if (prompt.length > 2000) {
    return res.status(400).json({ error: 'Prompt is too long. Please shorten it.' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1000,
      stream: true,
      messages: [
        {
          role: 'system',
          content: "You are a helpful, direct AI assistant. Execute the user's prompt exactly as instructed. Be specific, practical, and thorough."
        },
        { role: 'user', content: prompt }
      ]
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    await incrementCounter('runCount');
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (err) {
    console.error('Run error:', err.message);
    res.write(`data: ${JSON.stringify({ error: 'AI execution failed. Please try again.' })}\n\n`);
    res.end();
  }
});

module.exports = router;
```

### 2C. Create `/utils/counter.js`
```js
const Database = require('@replit/database');
const db = new Database();

async function incrementCounter(key) {
  const current = (await db.get(key)) || 0;
  await db.set(key, current + 1);
}

async function getCounter(key) {
  return (await db.get(key)) || 0;
}

module.exports = { incrementCounter, getCounter };
```

### 2D. Create `/routes/stats.js`
```js
const express = require('express');
const router = express.Router();
const { getCounter } = require('../utils/counter');

router.get('/', async (req, res) => {
  const promptCount = await getCounter('promptCount');
  const runCount = await getCounter('runCount');
  res.json({ promptCount, runCount });
});

module.exports = router;
```

### 2E. Update `index.js` (main Express app)
```js
const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public')); // adjust path if needed

// Routes
app.use('/api/generate', require('./routes/generate'));
app.use('/api/run',      require('./routes/run'));
app.use('/api/stats',    require('./routes/stats'));

// Health check — prevents Replit cold starts
app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PromptMeGood running on port ${PORT}`));
```

---

## PHASE 3 — FRONTEND JAVASCRIPT

### 3A. Replace `generatePrompt()` with real AI call
Find the existing `generatePrompt()` function and replace its body entirely:
```js
async function generatePrompt() {
  const goal = document.getElementById('goal')?.value?.trim();

  if (!goal) {
    showToast('Please enter your goal first.');
    return;
  }

  const payload = {
    goal,
    category:     getVal('category'),
    experience:   getVal('experience'),
    tone:         getVal('tone'),
    format:       getVal('format'),
    language:     getVal('language'),
    personality:  getVal('personality'),
    extraDetails: getVal('extraDetails'),
    avoid:        getVal('avoid'),
    moneyMode:    getChecked('moneyMode'),
    humanVoice:   getChecked('humanVoice'),
    clarityBoost: getChecked('clarityBoost'),
    expertMode:   document.body.classList.contains('expert-mode-active')
  };

  setButtonState('generate', 'loading');
  setOutputText('');
  setOutputPlaceholder('Building your optimized prompt…');
  hideRunSection();

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (data.prompt) {
      setOutputText(data.prompt);
      showRunSection();
      scrollToPromptOutput();
      showToast('Prompt ready. Review it, edit if needed, then run it with AI.');
      saveToHistory(data.prompt, payload);
      loadUsageCounter();
    } else {
      setOutputPlaceholder('Something went wrong. Please try again.');
      showToast(data.error || 'Generation failed.');
    }

  } catch (err) {
    setOutputPlaceholder('Connection error. Please try again.');
    showToast('Could not reach the server.');
    console.error(err);
  } finally {
    setButtonState('generate', 'ready');
  }
}

// Field helpers
function getVal(id)     { return document.getElementById(id)?.value || ''; }
function getChecked(id) { return document.getElementById(id)?.checked || false; }
```

### 3B. Add `runWithAI()` function
```js
async function runWithAI() {
  const prompt = getPromptOutput();

  if (!prompt || prompt.trim() === '') {
    showToast('Generate a prompt first before running it.');
    return;
  }

  setButtonState('run', 'loading');
  clearAIResponse();
  showAIResponseSection();
  scrollToAIResponse();

  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Execution failed.');
      setButtonState('run', 'ready');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6);
        if (raw === '[DONE]') {
          showToast('Done. Review the response below.');
          saveAIResponse(fullResponse);
          break;
        }
        try {
          const parsed = JSON.parse(raw);
          if (parsed.text)  { fullResponse += parsed.text; appendAIResponse(parsed.text); }
          if (parsed.error) { showToast(parsed.error); }
        } catch (_) {}
      }
    }

  } catch (err) {
    showToast('Connection error. Please try again.');
    console.error(err);
  } finally {
    setButtonState('run', 'ready');
  }
}
```

### 3C. Add usage counter loader
```js
async function loadUsageCounter() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    const total = (data.promptCount || 0) + (data.runCount || 0);

    if (total > 100) {
      const el    = document.getElementById('usageCounter');
      const count = document.getElementById('usageCount');
      if (el && count) {
        count.textContent = total.toLocaleString();
        el.style.display = 'block';
      }
    }
  } catch (_) {
    // Fail silently — counter is not critical
  }
}

document.addEventListener('DOMContentLoaded', loadUsageCounter);
```

### 3D. Add DOM helper functions
```js
function showRunSection() {
  const el = document.getElementById('runSection');
  if (el) el.style.display = 'block';
}

function hideRunSection() {
  const el = document.getElementById('runSection');
  if (el) el.style.display = 'none';
  clearAIResponse();
}

function showAIResponseSection() {
  const el = document.getElementById('aiResponseSection');
  if (el) el.style.display = 'block';
}

function clearAIResponse() {
  const el = document.getElementById('aiResponseOutput');
  if (el) el.textContent = '';
  const section = document.getElementById('aiResponseSection');
  if (section) section.style.display = 'none';
}

function appendAIResponse(text) {
  const el = document.getElementById('aiResponseOutput');
  if (el) el.textContent += text;
}

function copyAIResponse() {
  const text = document.getElementById('aiResponseOutput')?.textContent;
  if (text) {
    navigator.clipboard.writeText(text);
    showToast('Response copied.');
  }
}

function saveAIResponse(text) {
  try { localStorage.setItem('pmg_last_response', text); } catch (_) {}
}

function getPromptOutput() {
  // Matches whichever element type your output uses
  return document.getElementById('promptOutput')?.value
      || document.getElementById('promptOutput')?.textContent
      || '';
}

function scrollToPromptOutput() {
  document.getElementById('promptOutput')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function scrollToAIResponse() {
  setTimeout(() => {
    document.getElementById('aiResponseSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function setButtonState(button, state) {
  const ids    = { generate: 'generateBtn', run: 'runBtn' };
  const labels = {
    generate: { loading: 'Generating…',  ready: 'Generate Prompt' },
    run:      { loading: 'Running…',     ready: '▶ Run With AI'   }
  };
  const el = document.getElementById(ids[button]);
  if (!el) return;
  el.textContent  = labels[button][state];
  el.disabled     = state === 'loading';
  el.style.opacity = state === 'loading' ? '0.7' : '1';
}

function setOutputText(text) {
  const el = document.getElementById('promptOutput');
  if (!el) return;
  if (el.tagName === 'TEXTAREA') el.value = text;
  else el.textContent = text;
}

function setOutputPlaceholder(text) {
  const el = document.getElementById('promptOutput');
  if (!el) return;
  if (el.tagName === 'TEXTAREA') el.placeholder = text;
  else el.textContent = text;
}
```

### 3E. Add keep-alive ping (prevents Replit cold starts)
```js
setInterval(() => {
  fetch('/health').catch(() => {});
}, 4 * 60 * 1000);
```

---

## PHASE 4 — HTML ADDITIONS

### 4A. Usage counter in hero section
Insert between the tagline and CTA buttons:
```html
<p id="usageCounter" style="display:none; font-size:0.85rem; color:#6b7280; margin: 0 0 16px 0;">
  <strong id="usageCount">0</strong>+ prompts generated
</p>
```

### 4B. Run With AI + AI Response sections
Add directly below the existing prompt output panel:
```html
<!-- RUN WITH AI — hidden until a prompt is generated -->
<div id="runSection" style="display:none; margin-top:24px;">
  <div style="border-top:1px solid #e5e7eb; padding-top:24px;">
    <h3 style="font-size:1rem; font-weight:700; margin-bottom:4px;">Run This Prompt With AI</h3>
    <p style="font-size:0.85rem; color:#6b7280; margin-bottom:16px;">
      Your prompt is ready. Review it above, edit if needed, then run it here.
    </p>
    <button id="runBtn" onclick="runWithAI()"
      style="background:#1a6b5e; color:white; border:none; border-radius:9999px;
             padding:14px 28px; font-size:1rem; font-weight:600; cursor:pointer; width:100%;">
      ▶ Run With AI
    </button>
    <p style="font-size:0.75rem; color:#9ca3af; text-align:center; margin-top:8px;">
      Uses 1 AI execution · Free during Early Access
    </p>
  </div>
</div>

<!-- AI RESPONSE — hidden until run completes -->
<div id="aiResponseSection" style="display:none; margin-top:24px;">
  <div style="border-top:1px solid #e5e7eb; padding-top:24px;">
    <h3 style="font-size:1rem; font-weight:700; margin-bottom:4px;">AI Response</h3>
    <p style="font-size:0.85rem; color:#6b7280; margin-bottom:12px;">Generated from your prompt above.</p>
    <div id="aiResponseOutput"
      style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px;
             padding:16px; min-height:120px; font-size:0.9rem; line-height:1.7;
             white-space:pre-wrap; word-break:break-word;">
    </div>
    <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
      <button onclick="copyAIResponse()"
        style="flex:1; padding:10px; border:1px solid #d1d5db; border-radius:9999px;
               background:white; font-size:0.85rem; cursor:pointer;">
        Copy Response
      </button>
      <button onclick="runWithAI()"
        style="flex:1; padding:10px; border:1px solid #d1d5db; border-radius:9999px;
               background:white; font-size:0.85rem; cursor:pointer;">
        Run Again
      </button>
    </div>
  </div>
</div>
```

---

## GLOBAL RULES

- Match all existing element IDs and function names exactly — do not rename anything that already exists
- Do not remove or break: Guide Me, Expert Mode, Demo Values, history, templates, refinement tools
- **Never expose `OPENAI_API_KEY` in frontend code or any browser-accessible file**
- Keep the Early Access notice: *"All features are unlocked for now. Some advanced tools may become Pro features later."*
- Mobile layout must stay clean — test all new sections at **375px width**
- Run With AI section uses the same design language (teal accent, rounded buttons, same font) but is visually distinct from the prompt section

---

## FINAL QA CHECKLIST

### Backend
- [ ] `POST /api/generate` returns a real AI-generated prompt (not a template)
- [ ] `POST /api/run` streams a real AI response
- [ ] `GET /api/stats` returns `promptCount` and `runCount`
- [ ] `GET /health` returns `{ status: 'ok' }`
- [ ] Rate limiter blocks after 20 generations/hour per IP
- [ ] Rate limiter blocks after 5 executions/hour per IP
- [ ] Daily spend guard stops calls after $3 estimated spend
- [ ] `OPENAI_API_KEY` is in Replit Secrets — not in code
- [ ] Input over 500 characters is rejected with a friendly error
- [ ] Prompt injection phrases are rejected

### Frontend
- [ ] Generate Prompt calls `/api/generate` and displays real AI output
- [ ] "Run With AI" section appears after a prompt is generated
- [ ] Clicking Run With AI streams response word by word
- [ ] AI Response section appears and fills in real time
- [ ] Usage counter appears in hero once count exceeds 100
- [ ] Generate button shows "Generating…" during load, restores after
- [ ] Run button shows "Running…" during stream, restores after
- [ ] Toast fires with next-step guidance after generation
- [ ] Toast fires on completion of AI run
- [ ] Copy Response button copies AI response to clipboard
- [ ] Page scrolls to prompt output after generation
- [ ] Page scrolls to AI response section after run starts
- [ ] Keep-alive ping fires every 4 minutes

### Existing Features (must not break)
- [ ] Use Demo Values still works and auto-generates
- [ ] Guide Me wizard still works
- [ ] Expert Mode still works
- [ ] Refinement tools (More Detailed, More Aggressive, Beginner Friendly) still work
- [ ] Prompt history still saves
- [ ] Pinned templates still work
- [ ] Dark mode still works
- [ ] Replay Tour still works from Step 1

### Mobile (375px)
- [ ] Run With AI button is full width and easy to tap
- [ ] AI Response section is readable
- [ ] No horizontal overflow on any new elements
- [ ] All new toasts are visible and not blocked by UI
