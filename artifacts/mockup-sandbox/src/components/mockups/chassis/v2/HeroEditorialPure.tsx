export function HeroEditorialPure() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400&display=swap');
        .ep { font-family: Inter, system-ui, sans-serif; background: #f6f1e8; color: #1a1612; min-height: 900px; }
        .ep-nav { display:flex; align-items:center; justify-content:space-between; padding: 24px 56px; }
        .ep-brand { font-family: Fraunces, serif; font-size: 20px; font-weight: 400; letter-spacing: -0.005em; font-style: italic; }
        .ep-nav-links { display:flex; gap:32px; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color: rgba(26,22,18,0.55); }
        .ep-nav-cta { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; padding:10px 16px; background:transparent; color:#1a1612; border:1px solid #1a1612; border-radius:0; cursor:pointer; }
        .ep-hero { max-width: 880px; margin: 0 auto; padding: 120px 56px 80px; text-align:center; }
        .ep-eyebrow { font-family: Fraunces, serif; font-size: 13px; font-style: italic; color: #c4622d; margin-bottom: 36px; letter-spacing: 0.02em; }
        .ep-eyebrow::before, .ep-eyebrow::after { content:'·'; margin: 0 14px; color: rgba(26,22,18,0.3); }
        .ep-h1 { font-family: Fraunces, serif; font-weight: 300; font-size: 96px; line-height: 0.98; letter-spacing: -0.04em; margin: 0 0 32px; color: #1a1612; }
        .ep-h1 em { font-style: italic; font-weight: 400; color: #c4622d; }
        .ep-sub { font-family: Fraunces, serif; font-size: 22px; line-height: 1.45; color: rgba(26,22,18,0.65); max-width: 580px; margin: 0 auto 64px; font-weight: 300; }
        .ep-input { max-width: 620px; margin: 0 auto; border: 1px solid rgba(26,22,18,0.18); padding: 28px 28px 18px; text-align:left; background:#fffcf6; }
        .ep-input-label { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.18em; text-transform:uppercase; color:rgba(26,22,18,0.45); margin-bottom:14px; display:flex; justify-content:space-between; }
        .ep-input-label span:last-child { color: #c4622d; }
        .ep-input-text { font-family: Fraunces, serif; font-size: 22px; line-height: 1.4; color: rgba(26,22,18,0.45); font-style: italic; min-height: 80px; font-weight: 300; }
        .ep-input-bar { display:flex; justify-content:flex-end; align-items:center; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(26,22,18,0.1); }
        .ep-send { background:#1a1612; color:#f6f1e8; border:none; padding:10px 18px; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; cursor:pointer; border-radius:0; }
        .ep-chips { display:flex; gap:0; justify-content:center; margin-top: 28px; max-width: 620px; margin-left:auto; margin-right:auto; border-top: 1px solid rgba(26,22,18,0.12); }
        .ep-chip { flex:1; font-family: Fraunces, serif; font-style: italic; font-size:14px; padding: 14px 12px; color: rgba(26,22,18,0.65); text-align:center; border-right: 1px solid rgba(26,22,18,0.12); cursor:pointer; }
        .ep-chip:last-child { border-right: none; }
        .ep-chip:first-child { color: #c4622d; }
        .ep-rule { max-width: 100px; height: 1px; background: rgba(26,22,18,0.2); margin: 80px auto 32px; }
        .ep-foot { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.16em; text-transform:uppercase; color: rgba(26,22,18,0.5); text-align:center; }
        .ep-foot span { margin: 0 14px; }
      `}</style>
      <div className="ep">
        <nav className="ep-nav">
          <div className="ep-brand">PromptMeGood</div>
          <div className="ep-nav-links"><span>Workstation</span><span>Photography</span><span>Marketplace</span><span>Pricing</span></div>
          <button className="ep-nav-cta">Start free</button>
        </nav>
        <section className="ep-hero">
          <div className="ep-eyebrow">Earn the Workstation</div>
          <h1 className="ep-h1">Stop guessing.<br/>Write prompts that <em>earn it</em>.</h1>
          <p className="ep-sub">Tell us what you're trying to do — in plain language. We'll write the prompt that lands the result.</p>
          <div className="ep-input">
            <div className="ep-input-label"><span>What are you trying to accomplish?</span><span>● prompt-engine · v3</span></div>
            <div className="ep-input-text">Draft a launch announcement for our Series A round, written in a confident but human voice…</div>
            <div className="ep-input-bar">
              <button className="ep-send">Generate Blueprint →</button>
            </div>
          </div>
          <div className="ep-chips">
            <div className="ep-chip">Series A announcement</div>
            <div className="ep-chip">3-week onboarding plan</div>
            <div className="ep-chip">Espresso hero shot</div>
          </div>
          <div className="ep-rule"/>
          <div className="ep-foot"><span>No signup</span>·<span>One prompt to start</span>·<span>Workstation unlocks after</span></div>
        </section>
      </div>
    </>
  );
}
export default HeroEditorialPure;
