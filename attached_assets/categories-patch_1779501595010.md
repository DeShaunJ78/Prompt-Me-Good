PATCH — SPEC 1 TEMPLATE BROWSER: EXPANDED CATEGORIES
─────────────────────────────────────────────────────
Replace the CATEGORIES array in pmg-template-browser.js
with the one below. Everything else in Spec 1 is unchanged.

Also update the .pmg-tb-categories container in the CSS:
change width from 180px to 200px and ensure overflow-y
auto with max-height so the full list scrolls cleanly.
On mobile, the category row wraps as before.
─────────────────────────────────────────────────────

CATEGORIES array (50 entries, in this exact order):

const CATEGORIES = [

  // ── MOST SEARCHED ──────────────────────────────
  "Coding & Development",
  "Writing & Copywriting",
  "SEO & Content Strategy",
  "Social Media",
  "YouTube & Video Scripts",
  "Email Marketing",
  "Research & Summarization",
  "Data Analysis",
  "Productivity & Planning",
  "Habit Building",

  // ── BUSINESS & MONEY ───────────────────────────
  "Marketing & Sales",
  "Business & Strategy",
  "Startup & Entrepreneurship",
  "E-commerce & Dropshipping",
  "Finance & Investing",
  "Cold Outreach",
  "Customer Service",
  "Consulting",
  "Product Management",
  "Press Releases & PR",

  // ── CAREER ─────────────────────────────────────
  "Resume & CV",
  "Cover Letters",
  "Job Interviews",
  "HR & Recruiting",
  "LinkedIn & Personal Brand",

  // ── CREATIVE ───────────────────────────────────
  "Storytelling & Fiction",
  "Poetry & Creative Writing",
  "Scripts & Screenwriting",
  "Podcast",
  "TikTok & Short Form",
  "Photography & Image",
  "Filmmaking & Video",
  "Design & Branding",
  "Music & Audio",

  // ── EDUCATION & RESEARCH ───────────────────────
  "Academic & Essays",
  "Grant Writing",
  "Learning & Study Plans",
  "Teaching & Lesson Plans",

  // ── PROFESSIONAL SERVICES ──────────────────────
  "Legal & Contracts",
  "Real Estate",
  "Healthcare & Medical",
  "Nonprofit & Fundraising",
  "Coaching & Mentoring",

  // ── LIFE & PERSONAL ────────────────────────────
  "Health & Wellness",
  "Fitness & Nutrition",
  "Mental Health & Mindfulness",
  "Cooking & Recipes",
  "Travel Planning",
  "Parenting & Family",
  "Gift Ideas & Shopping",
  "Faith & Community",
  "Personal Development",
  "Relationships & Dating",

];

─────────────────────────────────────────────────────
UI NOTE FOR THE AGENT:

Group the categories visually in the sidebar using the
section comments above as divider labels. Render each
group with a small uppercase label above it:

  <div class="pmg-tb-group-label">Most Searched</div>
  <button class="pmg-tb-cat-btn">Coding & Development</button>
  ...

  <div class="pmg-tb-group-label">Business & Money</div>
  <button class="pmg-tb-cat-btn">Marketing & Sales</button>
  ...

This gives the sidebar structure without clutter.
The group label is not clickable — purely visual.

CSS for .pmg-tb-group-label:
  Font-size 10px. Letter-spacing 0.12em. Text-transform uppercase.
  Color var(--color-text-faint). Padding 14px 12px 4px.
  Font-weight 700. Pointer-events none. User-select none.
  First instance: padding-top 6px.
─────────────────────────────────────────────────────
