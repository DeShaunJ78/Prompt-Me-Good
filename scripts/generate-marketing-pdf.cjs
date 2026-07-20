const { chromium } = require('/home/runner/workspace/node_modules/.pnpm/@playwright+test@1.59.1/node_modules/playwright');
const fs = require('fs');

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #1a1a2e; background: #fff; }
  .cover { background: linear-gradient(135deg, #0d2b26 0%, #0f3d30 60%, #1a5c44 100%); color: #fff; padding: 64px 56px 56px; }
  .cover-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #3ee0a0; font-weight: 700; margin-bottom: 16px; }
  .cover h1 { font-size: 30px; font-weight: 800; line-height: 1.15; margin-bottom: 12px; }
  .cover .sub { font-size: 14px; color: #b8f0d8; max-width: 560px; line-height: 1.5; }
  .cover-meta { margin-top: 28px; display: flex; gap: 20px; flex-wrap: wrap; }
  .cover-stat { background: rgba(62,224,160,0.12); border: 1px solid rgba(62,224,160,0.3); border-radius: 8px; padding: 12px 18px; }
  .cover-stat .val { font-size: 18px; font-weight: 800; color: #3ee0a0; }
  .cover-stat .lbl { font-size: 10px; color: #9fc4b8; text-transform: uppercase; letter-spacing: 1px; }
  .url-banner { background: #f0faf5; border-left: 4px solid #3ee0a0; padding: 14px 20px; margin: 24px 40px 0; border-radius: 0 8px 8px 0; }
  .url-banner .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #0d6e4a; margin-bottom: 3px; }
  .url-banner .url { font-size: 13px; font-weight: 700; color: #0d6e4a; }
  .body { padding: 24px 40px 40px; }
  h2 { font-size: 16px; font-weight: 800; color: #0d2b26; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e8f7f0; }
  h2 .num { background: #0d6e4a; color: #fff; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; margin-right: 6px; }
  h3 { font-size: 13px; font-weight: 700; color: #0d4a31; margin: 12px 0 5px; }
  p { margin-bottom: 8px; color: #2a2a3e; }
  ul { padding-left: 18px; margin: 6px 0 10px; }
  li { margin-bottom: 4px; color: #2a2a3e; }
  li strong { color: #0d2b26; }
  .callout { background: #fffbe6; border: 1px solid #f0d060; border-radius: 8px; padding: 11px 15px; margin: 10px 0; }
  .callout strong { color: #7a5c00; display: block; margin-bottom: 3px; }
  .callout p { color: #5a4400; margin: 0; font-size: 12px; }
  .tip { background: #f0faf5; border: 1px solid #b0e8cc; border-radius: 8px; padding: 9px 13px; margin: 7px 0; font-size: 12px; color: #0d4a31; }
  .timeline { margin: 12px 0; }
  .week { display: flex; gap: 14px; margin-bottom: 10px; align-items: flex-start; }
  .week-badge { background: #0d6e4a; color: #fff; border-radius: 8px; padding: 6px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; white-space: nowrap; min-width: 80px; text-align: center; line-height: 1.4; flex-shrink: 0; }
  .week-content strong { font-size: 12px; color: #0d2b26; display: block; margin-bottom: 2px; }
  .week-content span { font-size: 12px; color: #3a3a5e; }
  .offer-box { background: linear-gradient(135deg, #0d2b26, #1a4a35); color: #fff; border-radius: 12px; padding: 18px 22px; margin: 14px 0; }
  .offer-box h3 { color: #3ee0a0; font-size: 13px; margin-bottom: 10px; }
  .offer-row { display: flex; gap: 12px; }
  .offer-tier { flex: 1; background: rgba(255,255,255,0.07); border: 1px solid rgba(62,224,160,0.2); border-radius: 8px; padding: 11px 13px; }
  .offer-tier .price { font-size: 17px; font-weight: 800; color: #3ee0a0; }
  .offer-tier .name { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9fc4b8; margin-bottom: 3px; }
  .offer-tier .desc { font-size: 11px; color: #b8f0d8; margin-top: 3px; }
  .copy-block { background: #f4f4f8; border-left: 3px solid #3ee0a0; border-radius: 0 8px 8px 0; padding: 11px 15px; margin: 9px 0; font-size: 12px; color: #1a1a2e; }
  .copy-block strong { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #0d6e4a; margin-bottom: 4px; font-style: normal; }
  .channel-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
  .channel-table th { background: #0d2b26; color: #3ee0a0; padding: 7px 9px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .channel-table td { padding: 6px 9px; border-bottom: 1px solid #e8f0ea; vertical-align: top; }
  .channel-table tr:nth-child(even) td { background: #f8fffe; }
  .badge { display: inline-block; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .badge-high { background: #d4f0e4; color: #0d6e4a; }
  .badge-med { background: #fff0c8; color: #7a5c00; }
  .badge-low { background: #f0e0ff; color: #5a0080; }
  .step-grid { display: flex; flex-wrap: wrap; gap: 12px; margin: 10px 0; }
  .step-card { width: calc(50% - 6px); background: #f8fffe; border: 1px solid #d0ede0; border-radius: 10px; padding: 12px 14px; }
  .step-card .step-head { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #b03030; margin-bottom: 3px; }
  .step-card h4 { font-size: 12px; font-weight: 700; color: #0d2b26; margin-bottom: 5px; }
  .step-card p { font-size: 11px; color: #3a3a5e; margin: 0; }
  .checklist li { list-style: none; padding-left: 0; margin-bottom: 5px; }
  .checklist li::before { content: "☐  "; color: #0d6e4a; font-size: 13px; }
  .footer { margin-top: 36px; padding-top: 14px; border-top: 1px solid #e0e8e4; font-size: 10px; color: #999; text-align: center; }
  .page-break { page-break-before: always; padding-top: 24px; }
</style>
</head>
<body>

<div class="cover">
  <div class="cover-label">PromptMeGood · Marketing Playbook · July 2026</div>
  <h1>Capture PromptPerfect Refugees<br>Before September 1st</h1>
  <div class="sub">A 6-week, step-by-step action plan to convert PromptPerfect's shutting-down user base into PromptMeGood customers — free tier and paid — before their data vanishes on October 1st.</div>
  <div class="cover-meta">
    <div class="cover-stat"><div class="val">~6 wks</div><div class="lbl">Window left</div></div>
    <div class="cover-stat"><div class="val">Sept 1</div><div class="lbl">PP goes offline</div></div>
    <div class="cover-stat"><div class="val">Oct 1</div><div class="lbl">PP data deleted</div></div>
    <div class="cover-stat"><div class="val">500</div><div class="lbl">Founding slots</div></div>
  </div>
</div>

<div class="url-banner">
  <div class="label">Your Migration Landing Page — Send Everyone Here</div>
  <div class="url">https://www.promptmegood.com/promptperfect.html</div>
</div>

<div class="body">

<h2>STEP 0 &nbsp;·&nbsp; Know Your Offer Cold — Say It In One Breath</h2>
<p>Before you post anywhere, internalize this. Every message you write opens one of these three doors:</p>

<div class="offer-box">
  <h3>The Three Doors You're Handing People</h3>
  <div class="offer-row">
    <div class="offer-tier">
      <div class="name">Free Forever</div>
      <div class="price">$0</div>
      <div class="desc">No account, no card. Daily caps but real features. Prompt Builder + Photography Suite. Start immediately — zero friction.</div>
    </div>
    <div class="offer-tier">
      <div class="name">Founding Member ⭐</div>
      <div class="price">$79 one-time</div>
      <div class="desc">First 500 only. Price locked for life. 15 AI runs/day, Image Workshop, Expert Command Center. Never rises.</div>
    </div>
    <div class="offer-tier">
      <div class="name">Pro Monthly</div>
      <div class="price">$14/mo</div>
      <div class="desc">25 AI runs/day, cancel anytime. Pro Studio $29/mo. Annual options save ~20%. Standard recurring access.</div>
    </div>
  </div>
</div>

<div class="callout">
  <strong>⚡ The Founding Member urgency stack — use all three in your copy every time</strong>
  <p>1. First 500 buyers only — gone when the slot fills. &nbsp;|&nbsp; 2. One-time price, never a subscription. &nbsp;|&nbsp; 3. Independent product — no VC, no pivot risk, no surprise shutdown (unlike PP).</p>
</div>

<h2>STEP 1 &nbsp;·&nbsp; Your One Core Message — Use Everywhere</h2>
<p>Keep this tight. Adapt the framing, not the substance.</p>

<div class="copy-block">
  <strong>Full version — for Reddit posts, blog posts, LinkedIn</strong>
  PromptPerfect is shutting down September 1st and deleting all user data October 1st. PromptMeGood has a free migration path — no account needed to start. Founding Member access is $79 one-time (first 500 only, price locked for life). Built by one person, not a VC-funded startup that pivots. Landing page: https://www.promptmegood.com/promptperfect.html
</div>

<div class="copy-block">
  <strong>Short version — for replies, DMs, tweets</strong>
  PromptPerfect shutting down? I moved to PromptMeGood — free to start, one-time $79 lifetime deal for power features. No account required. promptmegood.com/promptperfect
</div>

<div class="copy-block">
  <strong>Stability angle — for skeptics burned by shutdowns before</strong>
  It's one person building this, not a VC-funded startup. No Series A = no "pivot to enterprise" six months from now. The $79 Founding Member price is locked — it doesn't go up. That's the pitch.
</div>


<h2>STEP 2 &nbsp;·&nbsp; Where To Show Up — Prioritized by ROI</h2>

<table class="channel-table">
  <tr><th>Channel</th><th>Priority</th><th>Why It Works</th><th>Time/wk</th></tr>
  <tr>
    <td><strong>Reddit — Targeted Subreddits</strong></td>
    <td><span class="badge badge-high">Highest</span></td>
    <td>PP users are actively venting and asking "what now?" right now. One good post = hundreds of clicks for weeks.</td>
    <td>3–4 hrs</td>
  </tr>
  <tr>
    <td><strong>YouTube Comments</strong></td>
    <td><span class="badge badge-high">High</span></td>
    <td>PromptPerfect tutorial videos have warm audiences in research mode, actively Googling alternatives this month.</td>
    <td>1–2 hrs</td>
  </tr>
  <tr>
    <td><strong>Twitter/X — AI community</strong></td>
    <td><span class="badge badge-high">High</span></td>
    <td>Prompt engineering crowd is very active. One viral thread = thousands of impressions for free.</td>
    <td>2 hrs</td>
  </tr>
  <tr>
    <td><strong>Indie Hackers + Hacker News</strong></td>
    <td><span class="badge badge-med">Medium</span></td>
    <td>Builders and early adopters. Best channel for Founding Member sales. "Show HN" gives developer credibility.</td>
    <td>1 hr</td>
  </tr>
  <tr>
    <td><strong>Facebook AI Groups</strong></td>
    <td><span class="badge badge-med">Medium</span></td>
    <td>Non-technical users who discovered PP through YouTube. Good for free-tier volume conversion.</td>
    <td>1 hr</td>
  </tr>
  <tr>
    <td><strong>LinkedIn</strong></td>
    <td><span class="badge badge-med">Medium</span></td>
    <td>Business/professional users who relied on PP for work. Higher willingness to pay for Founding.</td>
    <td>30 min</td>
  </tr>
  <tr>
    <td><strong>Product Hunt</strong></td>
    <td><span class="badge badge-low">Timed</span></td>
    <td>Only launch if you can get 50+ upvotes in hour one. Plan for a Monday–Tuesday morning with supporters ready.</td>
    <td>Half day</td>
  </tr>
</table>


<div class="page-break"></div>

<h2>STEP 3 &nbsp;·&nbsp; Reddit — Your Highest-Impact Channel</h2>

<h3>Subreddits to target (in priority order)</h3>
<ul>
  <li><strong>r/ChatGPT</strong> — 5M+ members. Post: "PromptPerfect alternatives?" or a migration story. reddit.com/r/ChatGPT</li>
  <li><strong>r/PromptEngineering</strong> — core audience, very receptive to tool comparisons. reddit.com/r/PromptEngineering</li>
  <li><strong>r/artificial</strong> — general AI news; PP shutdown is genuinely newsworthy here</li>
  <li><strong>r/AIAssistants</strong> — product-comparison mindset, perfect positioning for PMG</li>
  <li><strong>r/OpenAI</strong> — mention PMG in existing threads about prompting tools</li>
  <li><strong>r/productivity</strong> — frame PMG as a productivity tool, not just an AI toy</li>
  <li><strong>r/MachineLearning</strong> — technical credibility posts perform well here</li>
</ul>

<div class="callout">
  <strong>🔑 Reddit Rule #1: Story-sell, don't link-drop</strong>
  <p>Lead with the shutdown news (genuinely useful information), share your migration experience, and let the URL appear naturally at the end. Authenticity converts 10× better than ad copy. Obvious promotion gets removed by mods instantly.</p>
</div>

<div class="copy-block">
  <strong>Post Title — pick one (test both across different subs)</strong>
  "PromptPerfect is shutting down Sept 1 — what are you all migrating to?" &nbsp;|&nbsp; "I tested 5 PromptPerfect alternatives so you don't have to" &nbsp;|&nbsp; "PSA: PromptPerfect deletes your data Oct 1 — here's how to export and where to go"
</div>

<div class="copy-block">
  <strong>Post Body — adapt, don't paste verbatim</strong>
  Got the PromptPerfect email. Sept 1 shutdown, Oct 1 data deletion. Spent a week testing alternatives and landed on PromptMeGood (link in comments). It has a free tier with no account required — daily caps but solid for regular use — and a Photography Suite for image prompts which is huge for Midjourney/DALL·E users. There's also a one-time $79 Founding Member tier, no subscription, price locked, built by one person so no VC pivot risk. Happy to compare features if anyone wants specifics. What are others moving to?
</div>

<div class="tip"><strong>Comment strategy:</strong> After posting, spend 20 min replying to every comment — Reddit's algorithm rewards first-hour engagement. Reply to OTHER posts mentioning PromptPerfect too. A helpful reply in someone else's thread converts their readers to your page.</div>


<h2>STEP 4 &nbsp;·&nbsp; YouTube Comments — Warm Traffic, Zero Ad Spend</h2>

<h3>How to find the videos</h3>
<ul>
  <li>Search YouTube: <strong>"PromptPerfect tutorial"</strong>, <strong>"PromptPerfect review"</strong>, <strong>"PromptPerfect alternatives"</strong></li>
  <li>Sort by View Count — prioritize videos with 10k+ views and active comment sections</li>
  <li>Check: recent comments rank higher in threads, giving you more visibility</li>
</ul>

<div class="copy-block">
  <strong>Comment Template — rewrite each time so it reads naturally</strong>
  Since PromptPerfect is shutting down Sept 1 (they sent the email this month), I've been using PromptMeGood as a replacement — promptmegood.com/promptperfect. Free to start with no account, has a Photography Suite for image prompts which I hadn't seen elsewhere, and a one-time lifetime plan for $79 which is worth it if you use this stuff regularly. Putting it here for anyone coming back to this video looking for options.
</div>

<div class="tip"><strong>Don't do all comments in one day.</strong> Spread them across 2–3 weeks. YouTube flags sudden bursts from accounts as spam. 3–5 quality comments per day is safer and more effective than 50 in a single session.</div>


<h2>STEP 5 &nbsp;·&nbsp; Twitter/X — Write a Thread, Then Reply Daily</h2>

<div class="copy-block">
  <strong>Thread Structure (6–8 tweets) — post Monday morning Week 1</strong>
  Tweet 1 (Hook): "PromptPerfect is shutting down Sept 1. Your prompts get deleted Oct 1. Here's what I found testing 4 alternatives 🧵"<br>
  Tweet 2: What PP users are losing — prompt history, saved workflows, image prompt library<br>
  Tweet 3: PromptMeGood overview — what it does, why the free tier is genuinely usable<br>
  Tweet 4: The Photography Suite — this differentiates PMG from generic prompt tools<br>
  Tweet 5: The Founding Member offer — why one-time pricing matters vs. subscriptions<br>
  Tweet 6: Direct link + CTA — "Start free, no account: promptmegood.com/promptperfect"<br>
  Tweet 7 (optional): "Built by one person, not a funded startup. Here's why that matters for long-term reliability"
</div>

<p><strong>After posting the thread:</strong> Search "PromptPerfect" on X every morning. Reply to anyone venting about the shutdown, asking for alternatives, or discussing prompt tools. Keep replies helpful — never paste your URL as the opening word.</p>


<div class="page-break"></div>

<h2>STEP 6 &nbsp;·&nbsp; Hacker News + Indie Hackers</h2>

<h3>Hacker News (news.ycombinator.com)</h3>
<ul>
  <li>Post title: <strong>"Show HN: PromptMeGood — prompt builder for PromptPerfect refugees"</strong></li>
  <li>Post between <strong>9–11am ET on a Tuesday or Wednesday</strong> — highest HN traffic window</li>
  <li>The first hour is everything. Have 3–5 people ready to upvote and leave early comments immediately after you post</li>
  <li>Reply to every HN comment within the first 2 hours — active threads rank higher</li>
  <li>HN culture: write as a founder explaining what you built and why. No superlatives. No "amazing" or "revolutionary." State what it does plainly</li>
</ul>

<h3>Indie Hackers (indiehackers.com)</h3>
<ul>
  <li>Post a milestones update: "How I'm targeting PromptPerfect's shutdown as an acquisition channel"</li>
  <li>The IH community responds extremely well to honest, transparent founder stories</li>
  <li>Join the "AI Tools" and "SaaS" groups and contribute a few comments before you post your own link</li>
</ul>


<h2>STEP 7 &nbsp;·&nbsp; LinkedIn — Post Text-Only, Link in First Comment</h2>

<div class="copy-block">
  <strong>LinkedIn post — paste this, then immediately comment with the URL</strong>
  PromptPerfect, the AI prompt tool used by thousands of content creators and marketing teams, is shutting down September 1st. Their users lose all their data October 1st. This happens more than people realize in the AI tools space — funded startups pivot to enterprise or get acqui-hired, and users lose everything with little notice. I built PromptMeGood specifically to avoid that dynamic: one-time pricing option, no VC, no pivot risk. The $79 Founding Member price is locked for life. If you use prompt tools for work and want something that won't disappear, the free tier requires no account. Link in comments.
</div>

<div class="tip"><strong>LinkedIn algorithm note:</strong> LinkedIn suppresses posts with external links in the body. Post the text above, then immediately add the first comment with: https://www.promptmegood.com/promptperfect.html — this gives you organic reach before the link limits it.</div>


<h2>STEP 8 &nbsp;·&nbsp; Your 6-Week Action Calendar</h2>
<p>One focused hour per day. The first two weeks matter most — don't save your energy for later.</p>

<div class="timeline">
  <div class="week">
    <div class="week-badge">Week 1<br>Jul 21–27</div>
    <div class="week-content">
      <strong>Plant the flags everywhere</strong>
      <span>Post to r/ChatGPT (highest reach). Post the X/Twitter thread Monday morning. Post LinkedIn (text only, URL in first comment). Leave first 5 YouTube comments across different PP tutorial videos. Set up Google Alerts: "PromptPerfect shutdown", "PromptPerfect alternative".</span>
    </div>
  </div>
  <div class="week">
    <div class="week-badge">Week 2<br>Jul 28–Aug 3</div>
    <div class="week-content">
      <strong>r/PromptEngineering + Show HN</strong>
      <span>Post a second Reddit thread in r/PromptEngineering (different angle — feature comparison). Reply to all Week 1 comments. Post Show HN on Tuesday 9–10am ET. Search "PromptPerfect" on X daily and reply to 3–5 conversations. Leave 5 more YouTube comments.</span>
    </div>
  </div>
  <div class="week">
    <div class="week-badge">Week 3<br>Aug 4–10</div>
    <div class="week-content">
      <strong>Facebook Groups + Indie Hackers</strong>
      <span>Join and post in: "ChatGPT Users", "AI Tools &amp; Automation", "Midjourney AI Art" Facebook groups. Post the milestone story on Indie Hackers. Continue YouTube comments (5–7 more videos). Post to r/artificial and r/AIAssistants. Send personal notes to anyone in your network who uses AI tools.</span>
    </div>
  </div>
  <div class="week">
    <div class="week-badge">Week 4<br>Aug 11–17</div>
    <div class="week-content">
      <strong>Double down on what worked</strong>
      <span>Check which channels drove the most signups (Supabase dashboard, Stripe payments). Repeat the winning format in new communities. Post a second X thread with a fresh angle ("here's what I had to rebuild from scratch after PromptPerfect announced"). Post to r/productivity.</span>
    </div>
  </div>
  <div class="week">
    <div class="week-badge">Week 5<br>Aug 18–24</div>
    <div class="week-content">
      <strong>Final push — urgency ramp</strong>
      <span>10 days until shutdown. Every post and comment must mention the Sept 1 deadline explicitly. Post "last chance" reminders in every community you've already been active in. Email anyone who signed up free but hasn't purchased yet about the Founding Member offer.</span>
    </div>
  </div>
  <div class="week">
    <div class="week-badge">Week 6<br>Aug 25–Sept 1</div>
    <div class="week-content">
      <strong>Deadline day — capture the scramble</strong>
      <span>Post "PromptPerfect is now offline — migration link" the day PP goes dark. This will get organic shares as people scramble. Monitor all channels for "what do I do now" comments. After Sept 1, shift message to: "PromptPerfect is gone — your prompts have a home here."</span>
    </div>
  </div>
</div>


<div class="page-break"></div>

<h2>STEP 9 &nbsp;·&nbsp; Copy Templates — Save These, Edit Before Every Post</h2>

<div class="copy-block">
  <strong>Facebook Group post (ChatGPT Users, AI Tools, Midjourney groups)</strong>
  Quick heads up for anyone using PromptPerfect: they sent an email this month confirming they're shutting down September 1st and deleting all user data October 1st. I've been migrating to PromptMeGood (promptmegood.com/promptperfect) — it's free to try with no account needed, has a really solid Photography Suite for image prompts which works well for Midjourney users, and there's a one-time lifetime option for $79 if you want unlimited-ish access. Thought people here would want to know before the deadline.
</div>

<div class="copy-block">
  <strong>Personal DM — for people you know who work with AI</strong>
  Hey — random but did you see PromptPerfect is shutting down Sept 1? I've been testing alternatives and landed on PromptMeGood, which has a free tier and a one-time $79 deal. Figured I'd send you the link before the deadline: promptmegood.com/promptperfect
</div>

<div class="copy-block">
  <strong>Email to your own list</strong>
  Subject: PromptPerfect is gone Sept 1 — thought you'd want to know<br><br>
  Quick note: PromptPerfect sent shutdown emails this month. Service goes offline September 1, data deleted October 1. If you use them or know someone who does, I've been running PromptMeGood as an alternative — free to start, no account needed, with a one-time Founding Member option ($79, first 500 only) that locks in lifetime access. Migration page: https://www.promptmegood.com/promptperfect.html
</div>


<h2>STEP 10 &nbsp;·&nbsp; Before-You-Post Checklist — Do These Today</h2>

<ul class="checklist">
  <li>Visit promptmegood.com/promptperfect.html as a first-time user — does the import flow make sense?</li>
  <li>Test the "Start Free" button — confirm it opens /app and works without an account</li>
  <li>Test the Founding Member button — confirm it lands on /pricing.html and the checkout works</li>
  <li>Create a Reddit account if you don't have a recent one — accounts need karma before posts stick</li>
  <li>Set up Google Alerts: "PromptPerfect", "PromptPerfect shutdown", "PromptPerfect alternative"</li>
  <li>Search YouTube for "PromptPerfect" and bookmark the top 10 videos with active comments</li>
  <li>Draft your Reddit post in a Google Doc first (so you're not writing under pressure)</li>
  <li>Draft your Twitter thread in Typefully (free) — lets you schedule and see thread preview</li>
  <li>Join 3–5 relevant Facebook groups today (some have 24-hr approval delays)</li>
  <li>Tell 5 people you know personally who work with AI — word of mouth is still your fastest path</li>
  <li>Add ?ref=reddit, ?ref=hn, ?ref=twitter to your links so you can see which channel converts</li>
</ul>


<h2>STEP 11 &nbsp;·&nbsp; Six Mistakes That Kill Early Traction</h2>

<div class="step-grid">
  <div class="step-card">
    <div class="step-head">❌ Avoid This</div>
    <h4>Spamming the same link across 20 subreddits in one day</h4>
    <p>Reddit's filter will shadowban your account. You'll think posts are live but nobody sees them. One post per community, one week apart minimum.</p>
  </div>
  <div class="step-card">
    <div class="step-head">❌ Avoid This</div>
    <h4>Using superlatives in copy ("best", "amazing", "revolutionary")</h4>
    <p>Readers distrust marketing language instantly. Say what it does specifically. "15 AI runs/day on GPT-4.1" beats "unlimited power" every time.</p>
  </div>
  <div class="step-card">
    <div class="step-head">❌ Avoid This</div>
    <h4>Waiting to post until everything feels perfect</h4>
    <p>The 6-week window is finite. A good post today beats a perfect post in two weeks when half the PP audience has already moved on.</p>
  </div>
  <div class="step-card">
    <div class="step-head">❌ Avoid This</div>
    <h4>Ignoring comments on your posts after posting</h4>
    <p>Reddit and HN reward threads where the poster is actively engaged. Even short replies bump your post in the algorithm. Check twice daily in Week 1.</p>
  </div>
  <div class="step-card">
    <div class="step-head">❌ Avoid This</div>
    <h4>Leading with the paid offer before they've tried free</h4>
    <p>The free tier is your best acquisition tool. Lead with "no account required, try it right now." Paid conversion happens naturally after people use the product.</p>
  </div>
  <div class="step-card">
    <div class="step-head">❌ Avoid This</div>
    <h4>Launching on Product Hunt without 50+ supporters lined up</h4>
    <p>Product Hunt requires 50+ upvotes in the first 2 hours or you fall off the front page. Only launch PH if you have a community ready to support immediately.</p>
  </div>
</div>


<h2>STEP 12 &nbsp;·&nbsp; How To Know If It's Working</h2>

<table class="channel-table">
  <tr><th>Metric</th><th>Where to check</th><th>What good looks like (Week 2+)</th></tr>
  <tr><td><strong>New free users/day</strong></td><td>Supabase dashboard → Auth → Users</td><td>5+ per day from organic posts</td></tr>
  <tr><td><strong>Founding Member purchases</strong></td><td>Stripe dashboard → Payments</td><td>1–2 per week from Reddit/HN</td></tr>
  <tr><td><strong>Landing page traffic</strong></td><td>Clarity / analytics if set up</td><td>100+ unique visitors/day by Week 3</td></tr>
  <tr><td><strong>Reddit post upvotes</strong></td><td>Your Reddit profile → Posts</td><td>50+ upvotes = solid. 200+ = front page of sub</td></tr>
  <tr><td><strong>HN points in first hour</strong></td><td>Watch your HN post live</td><td>20+ in hour one = front page placement</td></tr>
</table>

<div class="tip"><strong>Simple tracking:</strong> Add <code>?ref=reddit</code>, <code>?ref=hn</code>, <code>?ref=twitter</code> to every link you share. After 2 weeks you'll know exactly which channel drives real signups. Double down on the winner, drop the losers.</div>

<div class="footer">
  PromptMeGood Marketing Playbook &nbsp;·&nbsp; Generated July 2026 &nbsp;·&nbsp; https://www.promptmegood.com/promptperfect.html
</div>

</div>
</body>
</html>`;

const fs_module = require('fs');
fs_module.writeFileSync('/tmp/plan.html', HTML, 'utf8');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  const page = await browser.newPage();
  await page.setContent(HTML, { waitUntil: 'networkidle' });
  await page.pdf({
    path: '/home/runner/workspace/marketing-playbook-promptperfect.pdf',
    format: 'A4',
    margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
    printBackground: true,
  });
  await browser.close();
  console.log('PDF generated successfully');
})().catch(e => { console.error(e); process.exit(1); });
