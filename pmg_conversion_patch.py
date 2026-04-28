from pathlib import Path
import shutil, datetime, re

ROOT = Path("artifacts/promptmegood")
INDEX = ROOT / "index.html"
PRICING = ROOT / "pricing.html"
GUIDE = ROOT / "guide.html"

if not INDEX.exists():
    raise SystemExit("Missing artifacts/promptmegood/index.html")

stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
backup = Path(".pmg-checkpoints") / f"conversion-above-fold-{stamp}"
backup.mkdir(parents=True, exist_ok=True)

for f in [INDEX, PRICING, GUIDE]:
    if f.exists():
        shutil.copy2(f, backup / f.name)

html = INDEX.read_text(encoding="utf-8")

# -----------------------------
# 1. Hero Copy Upgrade
# -----------------------------
html = html.replace(
    "AI That Finally Does What You Ask",
    "Still Fixing Prompts?"
)

html = html.replace(
    "Stop rewording the same prompt over and over. PromptMeGood builds the perfect AI prompt from your idea — in seconds.",
    "Get AI To Actually Understand What You Mean — In One Click."
)

html = html.replace(
    "Fix My Prompt",
    "Fix My Prompt — Free",
    1
)

# -----------------------------
# 2. Above-Fold Desktop Builder Teaser
# Keeps Real #builder Anchor Untouched
# -----------------------------
builder_top = """
<section id="builder-top" class="pmg-builder-top" aria-label="Fix My Prompt Preview">
  <div class="pmg-builder-top-card">
    <div class="pmg-builder-top-copy">
      <p class="pmg-builder-top-eyebrow">Try It Now</p>
      <h2>Tell AI What You Mean</h2>
      <p>Type one sentence. PromptMeGood turns it into a clearer prompt you can run instantly or copy anywhere.</p>
    </div>

    <div class="pmg-builder-top-form">
      <label for="pmg-top-goal">What Do You Want AI To Help With?</label>
      <textarea id="pmg-top-goal" rows="4" placeholder="Example: Help Me Write A Better Email To A Client"></textarea>

      <div class="pmg-builder-top-actions">
        <button type="button" class="btn btn-primary" id="pmg-top-generate">Fix My Prompt — Free</button>
        <button type="button" class="btn btn-secondary" id="pmg-top-help">Help Me Start</button>
      </div>

      <div class="pmg-builder-top-proof" aria-label="Trust Signals">
        <span>No Signup</span>
        <span>Works Instantly</span>
        <span>Free To Use</span>
        <span>Used In 10+ Countries</span>
      </div>
    </div>
  </div>
</section>
"""

if 'id="builder-top"' not in html:
    hero_match = re.search(r'(<section class="hero" id="top"[\s\S]*?</section>)', html)
    if hero_match:
        html = html[:hero_match.end()] + "\n" + builder_top + html[hero_match.end():]
    else:
        raise SystemExit("Could Not Locate Hero Section")

# -----------------------------
# 3. Hide Fake What Next Block
# -----------------------------
html = re.sub(
    r'<aside class="what-next pmg-post-gen" id="what-next"[\s\S]*?</aside>',
    '<aside class="what-next pmg-post-gen pmg-hidden-what-next" id="what-next" hidden aria-hidden="true"></aside>',
    html,
    count=1
)

# -----------------------------
# 4. Title Case / Copy Fixes
# -----------------------------
fixes = {
    "Write something": "Write Something",
    "Create an image": "Create An Image",
    "Run It": "Run With AI",
    "Guide Me": "Help Me Start",
    "Guardrails": "Rules Or Limits",
    "Customize Settings": "More Control",
    "Prompt Engine": "Get AI To Understand You",
    "Your ready-to-use prompt": "Your Fixed Prompt",
    "Your generated prompt will appear here. Run it with AI right here, or copy it to use anywhere.": "Your Fixed Prompt Will Appear Here",
    "This week's focus": "This Week's Focus",
    "Use as goal →": "Use As Goal →",
    "Generate demo prompt": "Generate Demo Prompt",
    "Role assignment": "Role Assignment",
    "Clear constraints": "Clear Constraints",
    "Useful output format": "Useful Output Format",
    "Pinned note": "Pinned Note",
    "Improve with AI": "Improve With AI",
    "Your image will appear here": "Your Image Will Appear Here",
    "⬇ Download": "⬇ Download Image",
    "Aggressive": "Bold & Direct",
    "messy idea": "idea",
    "Beta User": "",
    "0+ prompts generated": "",
    "PromptMeGood v1": "",
}
for old, new in fixes.items():
    html = html.replace(old, new)

# -----------------------------
# 5. CSS Encapsulation
# -----------------------------
css = """
<style id="pmg-conversion-above-fold-css">
  html {
    scroll-padding-top: 24px;
  }

  #builder,
  #result-panel,
  #resultBox,
  #aiResponseSection,
  #imageResultSection {
    scroll-margin-top: 24px;
  }

  .pmg-builder-top {
    display: none;
  }

  @media (min-width: 920px) {
    .pmg-builder-top {
      display: block;
      width: min(calc(100% - 32px), 1100px);
      margin: 24px auto 32px;
    }

    .pmg-builder-top-card {
      display: grid;
      grid-template-columns: minmax(0, 40%) minmax(0, 60%);
      gap: 32px;
      align-items: center;
      padding: 24px;
      border: 1px solid var(--color-border);
      border-radius: 24px;
      background: var(--color-surface);
      box-shadow: 0 24px 70px color-mix(in srgb, var(--color-primary) 12%, transparent);
    }

    .pmg-builder-top-copy h2 {
      margin: 0 0 10px;
      font-size: clamp(2rem, 3vw, 3rem);
      letter-spacing: -0.04em;
      line-height: 1;
    }

    .pmg-builder-top-copy p {
      margin: 0;
      color: var(--color-muted);
      line-height: 1.55;
    }

    .pmg-builder-top-eyebrow {
      margin-bottom: 8px !important;
      font-weight: 800;
      color: var(--color-primary) !important;
    }

    .pmg-builder-top-form {
      display: grid;
      gap: 12px;
    }

    .pmg-builder-top-form label {
      font-weight: 800;
    }

    #pmg-top-goal {
      width: 100%;
      min-height: 112px;
      resize: vertical;
      border-radius: 18px;
      border: 1px solid var(--color-border);
      background: var(--color-bg);
      color: var(--color-text);
      padding: 16px;
      font: inherit;
      line-height: 1.5;
    }

    #pmg-top-goal:focus {
      outline: 2px solid color-mix(in srgb, var(--color-primary) 45%, transparent);
      border-color: var(--color-primary);
    }

    .pmg-builder-top-actions {
      display: grid;
      grid-template-columns: 1.2fr .8fr;
      gap: 10px;
    }

    .pmg-builder-top-actions .btn {
      min-height: 52px;
      font-weight: 850;
    }

    .pmg-builder-top-proof {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 2px;
    }

    .pmg-builder-top-proof span {
      padding: 7px 10px;
      border-radius: 999px;
      border: 1px solid var(--color-border);
      background: color-mix(in srgb, var(--color-primary) 6%, transparent);
      color: var(--color-muted);
      font-size: .86rem;
      font-weight: 700;
    }
  }

  @media (max-width: 919px) {
    .pmg-builder-top {
      display: none !important;
    }
  }

  .pmg-hidden-what-next,
  #what-next[hidden] {
    display: none !important;
  }

  @media (min-width: 920px) {
    .app-shell {
      max-width: 1100px !important;
      margin-inline: auto !important;
      display: grid !important;
      grid-template-columns: minmax(0, 45%) minmax(0, 55%) !important;
      gap: 32px !important;
      align-items: start !important;
    }

    #result-panel {
      position: sticky !important;
      top: 92px !important;
      align-self: start !important;
    }

    body.pmg-has-result #result-panel {
      box-shadow: 0 22px 60px color-mix(in srgb, var(--color-primary) 16%, transparent);
      border-color: color-mix(in srgb, var(--color-primary) 24%, var(--color-border));
    }
  }

  @media (max-width: 919px) {
    .app-shell {
      width: min(calc(100% - 16px), 1100px) !important;
      margin-inline: auto !important;
    }

    button,
    .btn,
    input,
    select,
    textarea,
    [role="button"] {
      min-height: 44px;
    }

    .top-actions .search,
    .site-search,
    #site-search,
    .search-bar,
    #global-search-input,
    #global-search-results {
      display: none !important;
    }

    body:not(.pmg-has-result) #tour-step-generate {
      position: sticky !important;
      bottom: 10px !important;
      z-index: 30 !important;
      padding: 10px !important;
      border-radius: 18px !important;
      background: color-mix(in srgb, var(--color-surface) 92%, transparent) !important;
      backdrop-filter: blur(14px);
      box-shadow: 0 12px 34px rgba(0,0,0,.16);
    }
  }

  #prompt-form {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
  }

  .field-primary {
    order: 1 !important;
  }

  #tour-step-generate {
    order: 2 !important;
    margin-top: 0 !important;
  }

  #guided-cta-row {
    order: 3 !important;
  }

  #upload-field {
    order: 4 !important;
    border: 1.5px dashed color-mix(in srgb, var(--color-primary) 35%, var(--color-border)) !important;
    background: color-mix(in srgb, var(--color-primary) 5%, transparent) !important;
    overflow: hidden !important;
  }

  #settingsPanel {
    order: 5 !important;
  }

  #weekly-goal-pin,
  #post-uc-guidance,
  #keyboard-hints,
  #auto-optimize-row {
    display: none !important;
  }

  #generateBtn,
  #image-generate-btn {
    width: 100% !important;
    min-height: 56px !important;
    font-size: 1.05rem !important;
    font-weight: 850 !important;
    box-shadow: 0 14px 30px color-mix(in srgb, var(--color-primary) 28%, transparent) !important;
  }

  #resultBox {
    min-height: 220px !important;
    padding: 22px !important;
    border-radius: 20px !important;
    line-height: 1.65 !important;
    border: 1px solid color-mix(in srgb, var(--color-primary) 18%, var(--color-border)) !important;
  }

  .pmg-primary-result-actions {
    display: grid !important;
    grid-template-columns: 1.15fr 1fr 1fr;
    gap: 10px;
    margin-top: 12px;
  }

  @media (max-width: 760px) {
    .pmg-primary-result-actions {
      grid-template-columns: 1fr !important;
    }
  }
</style>
"""

if 'id="pmg-conversion-above-fold-css"' not in html:
    html = html.replace("</head>", css + "\n</head>", 1)

# -----------------------------
# 6. JS Encapsulation
# -----------------------------
js = """
<script id="pmg-conversion-above-fold-js">
document.addEventListener("DOMContentLoaded", function () {
  const topGoal = document.getElementById("pmg-top-goal");
  const realGoal = document.getElementById("goal");
  const topGenerate = document.getElementById("pmg-top-generate");
  const realGenerate = document.getElementById("generateBtn");
  const topHelp = document.getElementById("pmg-top-help");
  const realHelp = document.getElementById("guided-start") || document.querySelector("[data-guided-start]");

  function markResult() {
    document.body.classList.add("pmg-has-result");
    try { localStorage.setItem("pmg_has_generated", "1"); } catch (e) {}
  }

  if (topGenerate) {
    topGenerate.addEventListener("click", function () {
      if (topGoal && realGoal) {
        realGoal.value = topGoal.value;
        realGoal.dispatchEvent(new Event("input", { bubbles: true }));
        realGoal.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (realGenerate) {
        realGenerate.click();
        markResult();
      } else {
        document.getElementById("builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (topHelp) {
    topHelp.addEventListener("click", function () {
      if (realHelp) realHelp.click();
      else document.getElementById("builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const whatNext = document.getElementById("what-next");
  if (whatNext) {
    whatNext.hidden = true;
    whatNext.setAttribute("aria-hidden", "true");
  }

  const finalActions = document.getElementById("tour-final-actions");
  const runBtn = document.getElementById("runBtn");
  const copyBtn = document.getElementById("copy-btn");
  const improveBlock = document.getElementById("improve-block");

  if (finalActions && runBtn && copyBtn && improveBlock && !document.querySelector(".pmg-primary-result-actions")) {
    const row = document.createElement("div");
    row.className = "pmg-primary-result-actions";

    const run = document.createElement("button");
    run.type = "button";
    run.className = "btn btn-primary";
    run.textContent = "Run With AI";
    run.addEventListener("click", function () { runBtn.click(); });

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "btn btn-secondary";
    copy.textContent = "Copy Prompt";
    copy.addEventListener("click", function () {
      copyBtn.click();
      const original = copy.textContent;
      copy.textContent = "Copied ✓";
      setTimeout(function () { copy.textContent = original; }, 1400);
    });

    const refine = document.createElement("button");
    refine.type = "button";
    refine.className = "btn btn-secondary";
    refine.textContent = "Refine Prompt";
    refine.addEventListener("click", function () {
      improveBlock.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    row.append(run, copy, refine);
    finalActions.prepend(row);
  }

  ["generateBtn", "image-generate-btn"].forEach(function (id) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", markResult);
  });

  try {
    if (localStorage.getItem("pmg_has_generated") === "1") {
      document.body.classList.add("pmg-has-result");
    }
  } catch (e) {}
});
</script>
"""

if 'id="pmg-conversion-above-fold-js"' not in html:
    html = html.replace("</body>", js + "\n</body>", 1)

INDEX.write_text(html, encoding="utf-8")

# Pricing/Guide light copy safety pass
for file in [PRICING, GUIDE]:
    if file.exists():
        txt = file.read_text(encoding="utf-8")
        txt = txt.replace(
            "PromptMeGood is free during our founding member period. Full pricing launches soon.",
            "PromptMeGood Is Free During Our Founding Member Period. Full Pricing Launches Soon."
        )
        txt = txt.replace("Guide Me", "Help Me Start")
        txt = txt.replace("Run It", "Run With AI")
        txt = txt.replace("Aggressive", "Bold & Direct")
        txt = txt.replace("messy idea", "idea")
        file.write_text(txt, encoding="utf-8")

print("PromptMeGood Conversion Patch Applied.")
print(f"Checkpoint Created: {backup}")
print("Updated:")
print("- artifacts/promptmegood/index.html")
if PRICING.exists(): print("- artifacts/promptmegood/pricing.html")
if GUIDE.exists(): print("- artifacts/promptmegood/guide.html")
print("")
print("Rollback:")
print(f"cp {backup}/index.html artifacts/promptmegood/index.html")
