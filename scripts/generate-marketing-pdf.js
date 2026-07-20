const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #1a1a2e; background: #fff; }
  .cover { background: linear-gradient(135deg, #0d2b26 0%, #0f3d30 60%, #1a5c44 100%); color: #fff; padding: 64px 56px 56px; min-height: 240px; }
  .cover-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #3ee0a0; font-weight: 700; margin-bottom: 16px; }
  .cover h1 { font-size: 32px; font-weight: 800; line-height: 1.15; margin-bottom: 12px; }
  .cover .sub { font-size: 15px; color: #b8f0d8; max-width: 580px; line-height: 1.5; }
  .cover-meta { margin-top: 28px; display: flex; gap: 32px; flex-wrap: wrap; }
  .cover-stat { background: rgba(62,224,160,0.12); border: 1px solid rgba(62,224,160,0.3); border-radius: 8px; padding: 12px 18px; }
  .cover-stat .val { font-size: 18px; font-weight: 800; color: #3ee0a0; }
  .cover-stat .lbl { font-size: 10px; color: #9fc4b8; text-transform: uppercase; letter-spacing: 1px; }
  .url-banner { background: #f0faf5; border-left: 4px solid #3ee0a0; padding: 14px 20px; margin: 24px 40px 0; border-radius: 0 8px 8px 0; display: flex; align-items: center; gap: 12px; }
  .url-banner .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #0d6e4a; }
  .url-banner .url { font-size: 13px; font-weight: 700; color: #0d6e4a; word-break: break-all; }
  .body { padding: 28px 40px 40px; }
  h2 { font-size: 17px; font-weight: 800; color: #0d2b26; margin: 32px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #e8f7f0; display: flex; align-items: center; gap: 8px; }
  h2 .num { background: #0d6e4a; color: #fff; border-radius: 50%; width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0; }
  h3 { font-size: 13px; font-weight: 700; color: #0d4a31; margin: 14px 0 6px; }
  p { margin-bottom: 8px; color: #2a2a3e; }
  .step-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 12px 0; }
  .step-card { background: #f8fffe; border: 1px solid #d0ede0; border-radius: 10px; padding: 14px 16px; }
  .step-card .step-head { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #0d6e4a; margin-bottom: 4px; }
  .step-card h4 { font-size: 13px; font-weight: 700; color: #0d2b26; margin-bottom: 6px; }
  .step-card p { font-size: 12px; color: #3a3a5e; margin: 0; }
  ul { padding-left: 18px; margin: 6px 0 10px; }
  li { margin-bottom: 5px; color: #2a2a3e; }
  li strong { color: #0d2b26; }
  .callout { background: #fffbe6; border: 1px solid #f0d060; border-radius: 8px; padding: 12px 16px; margin: 12px 0; }
  .callout strong { color: #7a5c00; }
  .callout p { color: #5a4400; margin: 4px 0 0; font-size: 12px; }
  .tip { background: #f0faf5; border: 1px solid #b0e8cc; border-radius: 8px; padding: 10px 14px; margin: 8px 0; font-size: 12px; color: #0d4a31; }
  .tip strong { color: #0d2b26; }
  .timeline { margin: 14px 0; }
  .week { display: flex; gap: 14px; margin-bottom: 12px; align-items: flex-start; }
  .week-badge { background: #0d6e4a; color: #fff; border-radius: 8px; padding: 6px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; flex-shrink: 0; min-width: 72px; text-align: center; }
  .week-content { flex: 1; }
  .week-content strong { font-size: 12px; color: #0d2b26; display: block; margin-bottom: 2px; }
  .week-content span { font-size: 12px; color: #3a3a5e; }
  .offer-box { background: linear-gradient(135deg, #0d2b26, #1a4a35); color: #fff; border-radius: 12px; padding: 20px 24px; margin: 16px 0; }
  .offer-box h3 { color: #3ee0a0; font-size: 14px; margin-bottom: 12px; }
  .offer-row { display: flex; gap: 14px; }
  .offer-tier { flex: 1; background: rgba(255,255,255,0.07); border: 1px solid rgba(62,224,160,0.2); border-radius: 8px; padding: 12px 14px; }
  .offer-tier .price { font-size: 18px; font-weight: 800; color: #3ee0a0; }
  .offer-tier .name { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9fc4b8; margin-bottom: 4px; }
  .offer-tier .desc { font-size: 11px; color: #b8f0d8; margin-top: 4px; }
  .copy-block { background: #f4f4f8; border-left: 3px solid #3ee0a0; border-radius: 0 8px 8px 0; padding: 12px 16px; margin: 10px 0; font-size: 12px; font-style: italic; color: #1a1a2e; }
  .copy-block strong { font-style: normal; display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #0d6e4a; margin-bottom: 4px; }
  .channel-table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11.5px; }
  .channel-table th { background: #0d2b26; color: #3ee0a0; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .channel-table td { padding: 7px 10px; border-bottom: 1px solid #e8f0ea; }
  .channel-table tr:nth-child(even) td { background: #f8fffe; }
  .badge { display: inline-block; border-radius: 4px; padding: 1px 7px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge-high { background: #d4f0e4; color: #0d6e4a; }
  .badge-med { background: #fff0c8; color: #7a5c00; }
  .badge-low { background: #f0e0ff; color: #5a0080; }
  .page-break { page-break-before: always; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e0e8e4; font-size: 10px; color: #888; text-align: center; }
  .red { color: #c0392b; font-weight: 700; }
  .green { color: #0d6e4a; font-weight: 700; }
  .inline-url { color: #0d6e4a; font-weight: 600; text-decoration: none; word-break: break-all; }
  .checklist li { list-style: none; padding-left: 0; }
  .checklist li::before { content: "☐ "; color: #3ee0a0; font-size: 14px; }
</style>
</head>
<body>

<!-- COVER -->
<div class="cover">
  <div class="cover-label">PromptMeGood · Marketing Playbook</div>
  <h1>Capture PromptPerfect Refugees<br>Before September 1st</h1>
  <div class="sub">A 6-week, step-by-step action plan to convert PromptPerfect's shutting-down user base into PromptMeGood customers — free tier and paid — before their data vanishes on October 1st.</div>
  <div class="cover-meta">
    <div class="cover-stat"><div class="val">~6 wks</div><div class="lbl">Window left</div></div>
    <div class="cover-stat"><div class="val">Sept 1</div><div class="lbl">PP goes offline</div></div>
    <div class="cover-stat"><div class="val">Oct 1</div><div class="lbl">PP data deleted</div></div>
    <div class="cover-stat"><div class="val">500</div><div class="lbl">Founding slots</div></div>
  </div>
</div>

<!-- URL BANNER -->
<div class="url-banner">
  <div>
    <div class="label">Your Migration Landing Page</div>
    <div class="url">https://www.promptmegood.com/promptperfect.html</div>
  </div>
</div>

<!-- BODY -->
<div class="body">

<!-- SECTION 1: THE OFFER -->
<h2><span class="num">0</span> Know Your Offer Cold — Say It In One Breath</h2>
<p>Before you post anywhere, internalize this. Every message you write maps to one of these three doors:</p>

<div class="offer-box">
  <h3>The Three Doors You're Handing People</h3>
  <div class="offer-row">
    <div class="offer-tier">
      <div class="name">Free Forever</div>
      <div class="price">$0</div>
      <div class="desc">No account, no card. Daily caps but real features. Prompt Builder + Photography Suite. Start immediately.</div>
    </div>
    <div class="offer-tier">
      <div class="name">Founding Member ⭐</div>
      <div class="price">$79</div>
      <div class="desc">One-time. First 500 only. Price locked for life. 15 AI runs/day, Image Workshop, Expert Command Center.</div>
    </div>
    <div class="offer-tier">
      <div class="name">Pro Monthly</div>
      <div class="price">$14/mo</div>
      <div class="desc">25 AI runs/day. Cancel anytime. Pro Studio at $29/mo for heavy users. Annual options save ~20%.</div>
    </div>
  </div>
</div>

<div class="callout">
  <strong>⚡ The Founding Member urgency stack (use all three in your copy)</strong>
  <p>1. First 500 buyers only — no more after that slot is gone. &nbsp;|&nbsp; 2. One-time price, never rises — not a subscription. &nbsp;|&nbsp; 3. Independent product — no VC, no pivot risk, no surprise shutdown.</p>
</div>


<!-- SECTION 2: THE MESSAGE -->
<h2><span class="num">1</span> Your One Core Message (Use Everywhere)</h2>
<p>Keep this tight. Adapt the framing, not the substance.</p>

<div class="copy-block">
  <strong>Headline (for posts, tweets, comments)</strong>
  PromptPerfect is shutting down Sept 1. Your prompts vanish Oct 1. PromptMeGood has a free import tool — no account needed to start. Founding Member access is $79 one-time (first 500). Built by one person, not a VC-funded startup that pivots.
</div>

<div class="copy-block">
  <strong>Short version (for replies / DMs / short-form)</strong>
  PromptPerfect shutting down? I've been using PromptMeGood — free to start, one-time $79 lifetime deal if you want the power features. Import your prompts day one. promptmegood.com/promptperfect
</div>

<div class="copy-block">
  <strong>Stability angle (for skeptics who've been burned before)</strong>
  It's one person building this, not a VC-funded startup. No Series A means no "pivot to enterprise" six months from now. The $79 Founding Member price is locked — it doesn't go up when (if) a growth round happens. That's the pitch.
</div>


<!-- SECTION 3: CHANNEL TABLE -->
<h2><span class="num">2</span> Where To Show Up — Prioritized by ROI</h2>

<table class="channel-table">
  <tr>
    <th>Channel</th>
    <th>Priority</th>
    <th>Why</th>
    <th>Time/wk</th>
  </tr>
  <tr>
    <td><strong>Reddit — Targeted Subreddits</strong></td>
    <td><span class="badge badge-high">Highest</span></td>
    <td>PP users actively venting / asking "what now?" Real name posts drive organic comments and upvotes.</td>
    <td>3–4 hrs</td>
  </tr>
  <tr>
    <td><strong>Twitter/X — AI community</strong></td>
    <td><span class="badge badge-high">High</span></td>
    <td>Prompt engineering crowd is highly active. One viral thread = thousands of impressions for free.</td>
    <td>2 hrs</td>
  </tr>
  <tr>
    <td><strong>YouTube comments</strong></td>
    <td><span class="badge badge-high">High</span></td>
    <td>PromptPerfect tutorial videos have warm audiences actively searching for alternatives right now.</td>
    <td>1–2 hrs</td>
  </tr>
  <tr>
    <td><strong>Indie Hackers + HN</strong></td>
    <td><span class="badge badge-med">Medium</span></td>
    <td>Builders and early adopters. Great for Founding Member sales. "Show HN" for dev credibility.</td>
    <td>1 hr</td>
  </tr>
  <tr>
    <td><strong>Facebook AI Groups</strong></td>
    <td><span class="badge badge-med">Medium</span></td>
    <td>Non-technical users who discovered PP through YouTube. Good free-tier conversion.</td>
    <td>1 hr</td>
  </tr>
  <tr>
    <td><strong>LinkedIn</strong></td>
    <td><span class="badge badge-med">Medium</span></td>
    <td>Business/professional users who use PP for work. Higher willingness to pay for Founding.</td>
    <td>30 min</td>
  </tr>
  <tr>
    <td><strong>Product Hunt</strong></td>
    <td><span class="badge badge-low">Timed</span></td>
    <td>Only if you can get 50+ upvotes in the first 2 hours. Plan it for a Mon–Tue morning launch.</td>
    <td>Half day</td>
  </tr>
</table>


<!-- PAGE 2 -->
<div class="page-break"></div>

<!-- SECTION 4: REDDIT STEP BY STEP -->
<h2><span class="num">3</span> Reddit — Your Highest-Impact Channel</h2>
<p>These subreddits have the most PromptPerfect overlap. Post once per community, then be generous in comments for the rest of the 6 weeks. Spamming = banned. Helping = traffic.</p>

<h3>Subreddits to target (in order)</h3>
<ul>
  <li><strong>r/ChatGPT</strong> — 5M+ members. Post: "PromptPerfect alternatives thread" or migration story. URL: reddit.com/r/ChatGPT</li>
  <li><strong>r/PromptEngineering</strong> — core audience, very receptive. URL: reddit.com/r/PromptEngineering</li>
  <li><strong>r/artificial</strong> — general AI news, PP shutdown is genuinely newsworthy here</li>
  <li><strong>r/MachineLearning</strong> — technical crowd, good for credibility posts</li>
  <li><strong>r/AIAssistants</strong> — product-comparison mindset, perfect for PMG</li>
  <li><strong>r/OpenAI</strong> — mention in relevant threads about prompting tools</li>
  <li><strong>r/productivity</strong> — position PMG as a productivity tool, not just an AI toy</li>
</ul>

<div class="callout">
  <strong>🔑 Reddit Rule #1: Don't link-drop, story-sell</strong>
  <p>Reddit bans obvious promotion. Lead with the shutdown news (genuinely useful), your migration experience, and let the URL come naturally at the end or in comments when people ask. Authenticity converts 10x better than ad copy here.</p>
</div>

<h3>Post Template — Works for r/ChatGPT and r/PromptEngineering</h3>
<div class="copy-block">
  <strong>Title (pick one)</strong>
  "PromptPerfect is shutting down Sept 1 — what are you all migrating to?" &nbsp;|&nbsp; "I tested 5 PromptPerfect alternatives so you don't have to" &nbsp;|&nbsp; "PSA: PromptPerfect deletes your data Oct 1 — here's how to export and where to go"
</div>
<div class="copy-block">
  <strong>Body (adapt freely)</strong>
  Got the PromptPerfect email. Sept 1 shutdown, Oct 1 data deletion. Spent a week testing alternatives and landed on PromptMeGood [link]. Here's what I found: it has a free tier with no account required (daily caps but solid for regular use), a Photography Suite for image prompts (huge for Midjourney/Dalle users), and a one-time $79 Founding Member tier that actually makes sense — no subscription, price locked, built by one person. Import works on day one. Happy to compare features if anyone wants specifics. What are others moving to?
</div>

<div class="tip"><strong>Comment strategy:</strong> After posting, spend 20 min replying to every comment. Reddit's algorithm rewards engagement in the first hour. Reply to OTHER posts in these subs that mention PromptPerfect — even a helpful reply in someone else's thread converts readers.</div>


<!-- SECTION 5: X/TWITTER -->
<h2><span class="num">4</span> Twitter/X — Build a Thread, Then Reply</h2>

<h3>Step 1: Write a thread (do this Week 1)</h3>
<div class="copy-block">
  <strong>Thread structure (6–8 tweets)</strong>
  Tweet 1: Hook — "PromptPerfect is shutting down Sept 1. Your prompts get deleted Oct 1. Here's what I found testing 4 alternatives. 🧵"<br><br>
  Tweet 2: The problem — what PP users are losing (prompt history, saved workflows, image prompts)<br><br>
  Tweet 3: PromptMeGood overview — what it does, why the free tier is actually usable<br><br>
  Tweet 4: The Photography Suite specifically — this differentiates from generic prompt tools<br><br>
  Tweet 5: The Founding Member offer and why one-time pricing matters vs. subscriptions<br><br>
  Tweet 6: Direct link + CTA — "Start free, no account: promptmegood.com/promptperfect"<br><br>
  Tweet 7 (optional): "Built by one person, not a funded startup. Here's why that matters for long-term reliability [brief story]"
</div>

<h3>Step 2: Reply to conversations about PP</h3>
<p>Search <strong>"PromptPerfect"</strong> on X daily. Reply to anyone venting about the shutdown, asking for alternatives, or posting about prompt tools. Keep replies genuinely helpful — don't paste your URL as the first word.</p>

<h3>Accounts to follow and engage with</h3>
<ul>
  <li>AI tool reviewers (search "prompt engineering" and engage with top accounts)</li>
  <li>Anyone posting about the PromptPerfect shutdown</li>
  <li>Newsletter writers covering AI tools — a single mention in a newsletter = hundreds of qualified clicks</li>
</ul>


<!-- PAGE 3 -->
<div class="page-break"></div>


<!-- SECTION 6: YOUTUBE -->
<h2><span class="num">5</span> YouTube Comments — Warm Traffic, Zero Ad Spend</h2>
<p>YouTube is sitting on thousands of people who already know what PromptPerfect is and are Googling right now. Comment on existing videos while viewers are in research mode.</p>

<h3>How to find the videos</h3>
<ul>
  <li>Search YouTube: <strong>"PromptPerfect tutorial"</strong>, <strong>"PromptPerfect review"</strong>, <strong>"PromptPerfect alternatives"</strong></li>
  <li>Sort by "View count" — prioritize videos with 10k+ views, comment sections still active</li>
  <li>Check the date — recent comments rank higher in the thread</li>
</ul>

<h3>Comment template (adapt so it doesn't look copy-pasted)</h3>
<div class="copy-block">
  <strong>Genuine comment — don't paste this verbatim, rewrite each time</strong>
  Since PromptPerfect is shutting down Sept 1 (they sent the email this month), I've been using PromptMeGood as a replacement — promptmegood.com/promptperfect. Free to start with no account, has a Photography Suite for image prompts which I hadn't seen elsewhere, and they have a one-time lifetime plan for $79 which is worth it if you use this stuff daily. Just putting it here for anyone coming back to this video looking for options.
</div>

<div class="tip"><strong>Don't do this all in one day.</strong> Spread comments over 2–3 weeks. YouTube's algorithm flags sudden bursts from new accounts as spam. 3–5 quality comments per day is better than 50 in one sitting.</div>


<!-- SECTION 7: INDIE HACKERS + HN -->
<h2><span class="num">6</span> Indie Hackers & Hacker News</h2>

<h3>Indie Hackers (indiehackers.com)</h3>
<ul>
  <li>Post a "milestones" update: "How I'm targeting PromptPerfect's shutdown as a customer acquisition channel"</li>
  <li>Be honest about what you're doing — IH community responds extremely well to transparent founder stories</li>
  <li>Join the "AI Tools" and "SaaS" groups and contribute before you post your own link</li>
</ul>

<h3>Hacker News (news.ycombinator.com)</h3>
<ul>
  <li><strong>"Show HN: PromptMeGood — a prompt builder for PromptPerfect refugees"</strong> — this framing is timely and factual</li>
  <li>Post between 9–11am ET on a weekday (highest traffic window)</li>
  <li>The first hour is everything on HN. Have a few people ready to upvote and comment immediately after you post</li>
  <li>Reply to every HN comment within the first 2 hours — the algorithm rewards active threads</li>
</ul>

<div class="callout">
  <strong>⚠️ HN culture note</strong>
  <p>HN readers hate sales copy. Write your "Show HN" text as a technical founder explaining what you built and why. No superlatives ("amazing", "revolutionary"). State what it does plainly. The comments are the pitch — answer questions well and you'll get traffic for weeks.</p>
</div>


<!-- SECTION 8: LINKEDIN -->
<h2><span class="num">7</span> LinkedIn — Business/Professional Angle</h2>

<div class="copy-block">
  <strong>Post angle for LinkedIn</strong>
  "PromptPerfect, the AI prompt tool used by thousands of marketing teams and content creators, is shutting down September 1st. This happens more often than people realize in the AI tools space — funded startups pivot to enterprise or get acqui-hired, and their users lose everything. I built PromptMeGood specifically to avoid that dynamic: one-time pricing, no VC, no pivot risk. The $79 Founding Member price is locked for life. If you use prompt tools for work and want something that won't disappear on you, the free tier requires no account. Link in comments." [then drop the link in first comment]
</div>

<div class="tip"><strong>LinkedIn algorithm tip:</strong> Put the URL in the <em>first comment</em>, not the post body. LinkedIn deliberately suppresses posts with external links in the main text. Post the text, then immediately comment with your URL.</div>


<!-- PAGE 4 -->
<div class="page-break"></div>


<!-- SECTION 9: WEEK BY WEEK PLAN -->
<h2><span class="num">8</span> Your 6-Week Action Calendar</h2>
<p>One hour a day. Non-negotiable for the first two weeks, then 30 min/day maintenance.</p>

<div class="timeline">

  <div class="week">
    <div class="week-badge">Week 1<br>July 21–27</div>
    <div class="week-content">
      <strong>Plant the flags everywhere</strong>
      <span>Write and schedule the Reddit post (r/ChatGPT first). Write the X/Twitter thread and post Monday morning. Write the LinkedIn post. Leave first round of 5 YouTube comments. Set up Google Alerts for "PromptPerfect shutdown" and "PromptPerfect alternative".</span>
    </div>
  </div>

  <div class="week">
    <div class="week-badge">Week 2<br>July 28 – Aug 3</div>
    <div class="week-content">
      <strong>Post to r/PromptEngineering + reply to everything</strong>
      <span>Post the second Reddit thread in r/PromptEngineering (different angle — comparison post). Reply to every comment from Week 1. Search "PromptPerfect" on X daily and reply to 3–5 conversations. Post Show HN on Tuesday or Wednesday 9–10am ET.</span>
    </div>
  </div>

  <div class="week">
    <div class="week-badge">Week 3<br>Aug 4–10</div>
    <div class="week-content">
      <strong>Facebook Groups + Indie Hackers</strong>
      <span>Join and post in Facebook groups: "ChatGPT Users", "AI Tools &amp; Automation", "Midjourney AI Art". Post the milestone story on Indie Hackers. Continue YouTube comments (5–7 more videos). Send a personal update to anyone who signed up for your waitlist or emailed you before.</span>
    </div>
  </div>

  <div class="week">
    <div class="week-badge">Week 4<br>Aug 11–17</div>
    <div class="week-content">
      <strong>Double down on what worked in weeks 1–3</strong>
      <span>Check which posts/channels drove the most signups (check your /api/me/profile new user creation dates). Repeat that format in new communities. Start a second X thread with a different angle ("here's what PromptPerfect had that I had to rebuild from scratch"). Post r/artificial and r/productivity.</span>
    </div>
  </div>

  <div class="week">
    <div class="week-badge">Week 5<br>Aug 18–24</div>
    <div class="week-content">
      <strong>Final push + urgency ramp</strong>
      <span>10 days until shutdown. Make every post and comment mention the September 1 deadline explicitly. Post a "last chance" reminder in every community you've already posted in (allowed as a follow-up, not a new self-promo post). Email anyone who signed up free but hasn't purchased about the Founding offer.</span>
    </div>
  </div>

  <div class="week">
    <div class="week-badge">Week 6<br>Aug 25 – Sept 1</div>
    <div class="week-content">
      <strong>Deadline day and post-launch capture</strong>
      <span>Post "PromptPerfect is now offline — here's the import link" on the day PP goes down. This will get organic shares as people scramble. Monitor every channel for "what do I do now" comments and reply with the import URL. After Sept 1, shift message to "PromptPerfect is gone, your data lives here."</span>
    </div>
  </div>

</div>


<!-- SECTION 10: COPY TO HAVE READY -->
<h2><span class="num">9</span> Copy Templates — Save These, Edit Before Posting</h2>

<h3>Facebook Group post</h3>
<div class="copy-block">
  <strong>Use in: AI Tools, ChatGPT Users, Midjourney groups</strong>
  Quick heads up for anyone using PromptPerfect: they sent an email this month saying they're shutting down on September 1st and deleting all user data October 1st. I've been migrating to PromptMeGood (promptmegood.com/promptperfect) — it's free to try with no account needed, has a really good Photography Suite for image prompts which is useful for Midjourney, and there's a one-time lifetime option for $79 if you want unlimited-ish access. Thought people here might want to know before the deadline.
</div>

<h3>DM template (for people you know who use PP)</h3>
<div class="copy-block">
  <strong>Personal outreach — keep it short and helpful, not salesy</strong>
  Hey — random but did you see PromptPerfect is shutting down Sept 1? I've been testing alternatives and landed on one called PromptMeGood that has a free tier and a one-time $79 deal — figured I'd send you the link before the deadline. promptmegood.com/promptperfect
</div>

<h3>Email to your own list (if you have one)</h3>
<div class="copy-block">
  <strong>Subject: PromptPerfect is gone Sept 1 — thought you'd want to know</strong>
  Quick note: PromptPerfect sent shutdown emails this month. Their service goes offline September 1, and they're deleting all user data October 1. If you use them or know someone who does, I've been running PromptMeGood as an alternative — free to start (no account), with a one-time Founding Member option ($79, first 500 only) that locks in lifetime access. Migration page: promptmegood.com/promptperfect
</div>


<!-- PAGE 5 -->
<div class="page-break"></div>


<!-- SECTION 11: PRE-LAUNCH CHECKLIST -->
<h2><span class="num">10</span> Before-You-Post Checklist — Do These Today</h2>

<ul class="checklist">
  <li>Open promptmegood.com/promptperfect.html and read it as a first-time visitor — does the import flow make sense?</li>
  <li>Test the "Start Free" button — confirm it opens /app and works without an account</li>
  <li>Test the "See Plans" / Founding Member button — confirm it lands on /pricing.html#founding-checkout-card and the purchase works</li>
  <li>Create your Reddit account if you don't have one — accounts need a few days of karma before posts stick</li>
  <li>Set up Google Alerts: <em>"PromptPerfect"</em>, <em>"PromptPerfect shutdown"</em>, <em>"PromptPerfect alternative"</em></li>
  <li>Search YouTube for "PromptPerfect" and bookmark the top 10 videos with active comments</li>
  <li>Draft the Reddit post in a Google Doc (so you're not writing under pressure)</li>
  <li>Draft the Twitter thread in a thread-writing tool (Typefully is free)</li>
  <li>Join 3–5 relevant Facebook groups today (they sometimes have 24-hr approval delays)</li>
  <li>Tell 5 people you know personally who work with AI tools — word of mouth is still your fastest path</li>
  <li>Bookmark this page: news.ycombinator.com/submit — for your Show HN post (Week 2)</li>
</ul>


<!-- SECTION 12: WHAT NOT TO DO -->
<h2><span class="num">11</span> Common Mistakes That Kill Early Traction</h2>

<div class="step-grid">
  <div class="step-card">
    <div class="step-head">❌ Don't do this</div>
    <h4>Spamming the same link across 20 subreddits in one day</h4>
    <p>Reddit's spam filter will shadowban your account. You'll think your posts are live but nobody sees them. Post once per community, wait a week before posting again.</p>
  </div>
  <div class="step-card">
    <div class="step-head">❌ Don't do this</div>
    <h4>Writing "This is the best prompt tool ever"</h4>
    <p>Superlatives make readers distrust you instantly. Say what it does specifically. "15 AI runs a day on GPT-4.1" is more convincing than "unlimited power."</p>
  </div>
  <div class="step-card">
    <div class="step-head">❌ Don't do this</div>
    <h4>Waiting to post until everything feels perfect</h4>
    <p>The 6-week window is finite. A good post today beats a perfect post in two weeks when half the PP audience has already moved on.</p>
  </div>
  <div class="step-card">
    <div class="step-head">❌ Don't do this</div>
    <h4>Ignoring the comments on your posts</h4>
    <p>Reddit and HN reward threads where the poster is actively engaged. Even a simple "good point" reply bumps your post in the algorithm. Check twice daily for week 1.</p>
  </div>
  <div class="step-card">
    <div class="step-head">❌ Don't do this</div>
    <h4>Pitching paid before they try free</h4>
    <p>The free tier is your best acquisition tool. Lead with "no account required, try it right now." Paid conversion happens naturally after people experience the tool.</p>
  </div>
  <div class="step-card">
    <div class="step-head">❌ Don't do this</div>
    <h4>Posting on Product Hunt without prep</h4>
    <p>Product Hunt requires 50+ upvotes in the first 2 hours or you fall off the front page. Only launch if you have a community ready to support it immediately.</p>
  </div>
</div>


<!-- SECTION 13: METRICS TO WATCH -->
<h2><span class="num">12</span> How To Know If It's Working</h2>

<table class="channel-table">
  <tr>
    <th>Metric</th>
    <th>Where to check</th>
    <th>What good looks like (week 2+)</th>
  </tr>
  <tr>
    <td>New free-tier users per day</td>
    <td>Supabase dashboard → users table</td>
    <td>5+ per day from organic posts</td>
  </tr>
  <tr>
    <td>Founding Member purchases</td>
    <td>Stripe dashboard → Payments</td>
    <td>1–2 per week from Reddit/HN</td>
  </tr>
  <tr>
    <td>promptperfect.html traffic</td>
    <td>Microsoft Clarity (if wired up) or Vercel/Replit analytics</td>
    <td>100+ unique visitors/day by Week 3</td>
  </tr>
  <tr>
    <td>Reddit post upvotes</td>
    <td>Your Reddit profile → posts</td>
    <td>50+ upvotes = good. 200+ = front page of sub</td>
  </tr>
  <tr>
    <td>HN points in first hour</td>
    <td>news.ycombinator.com (watch your post)</td>
    <td>20+ in first hour = you'll make the front page</td>
  </tr>
</table>

<div class="tip"><strong>Simple tracking hack:</strong> Add <code>?ref=reddit</code>, <code>?ref=hn</code>, <code>?ref=twitter</code> to every link you post. Check which source is driving real signups. Double down on the winner every week.</div>


<!-- FOOTER -->
<div class="footer">
  PromptMeGood Marketing Playbook · Generated July 2026 · promptmegood.com/promptperfect.html · For internal use only
</div>

</div>
</body>
</html>`;

fs.writeFileSync('/tmp/marketing-plan.html', HTML, 'utf8');
console.log('HTML written');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(HTML, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.pdf({
    path: '/home/runner/workspace/marketing-playbook-promptperfect.pdf',
    format: 'A4',
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    printBackground: true,
  });
  await browser.close();
  console.log('PDF written');
})();
