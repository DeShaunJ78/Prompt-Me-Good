export function HeroLinearGlass() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        .lg { font-family: Inter, system-ui, sans-serif; background: #fafafa; color: #0a0a0a; min-height: 900px; position:relative; overflow:hidden; }
        .lg::before { content:''; position:absolute; inset:0; background: 
          radial-gradient(circle at 20% 0%, rgba(168,85,247,0.18), transparent 45%),
          radial-gradient(circle at 80% 10%, rgba(236,72,153,0.15), transparent 50%),
          radial-gradient(circle at 50% 30%, rgba(59,130,246,0.12), transparent 55%);
          pointer-events:none; z-index:0; }
        .lg-inner { position:relative; z-index:1; }
        .lg-nav { display:flex; align-items:center; justify-content:space-between; padding: 18px 36px; backdrop-filter: blur(12px); background: rgba(250,250,250,0.6); border-bottom: 1px solid rgba(0,0,0,0.04); }
        .lg-brand { font-size:16px; font-weight:700; letter-spacing:-0.02em; display:flex; align-items:center; gap:10px; }
        .lg-brand-mark { width:26px; height:26px; border-radius:8px; background: conic-gradient(from 220deg, #a855f7, #ec4899, #3b82f6, #a855f7); }
        .lg-nav-links { display:flex; gap:32px; font-size:13.5px; color:#525252; font-weight:500; }
        .lg-nav-actions { display:flex; gap:10px; align-items:center; }
        .lg-signin { font-size:13.5px; color:#525252; font-weight:500; }
        .lg-cta { font-size:13.5px; padding:8px 16px; background:#0a0a0a; color:#fff; border-radius:8px; border:none; font-weight:500; cursor:pointer; }
        .lg-hero { max-width: 880px; margin: 0 auto; padding: 100px 36px 60px; text-align:center; }
        .lg-eyebrow { display:inline-block; padding:6px 14px; background:rgba(255,255,255,0.6); backdrop-filter: blur(8px); border:1px solid rgba(0,0,0,0.06); border-radius:999px; font-size:12px; font-weight:600; color:#0a0a0a; margin-bottom: 28px; letter-spacing:-0.005em; }
        .lg-eyebrow span { background: linear-gradient(90deg, #a855f7, #ec4899); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .lg-h1 { font-size: 72px; line-height: 1.0; letter-spacing: -0.045em; font-weight: 700; margin: 0 0 24px; color:#0a0a0a; }
        .lg-h1 span { background: linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f97316 100%); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .lg-sub { font-size: 18px; line-height: 1.5; color: #525252; max-width: 560px; margin: 0 auto 44px; font-weight: 400; }
        .lg-glass { position:relative; padding: 2px; border-radius:20px; background: linear-gradient(135deg, rgba(168,85,247,0.5), rgba(236,72,153,0.3) 50%, rgba(59,130,246,0.5)); box-shadow: 0 30px 80px -30px rgba(168,85,247,0.35), 0 0 0 1px rgba(255,255,255,0.5) inset; }
        .lg-input { background: rgba(255,255,255,0.85); backdrop-filter: blur(20px); border-radius: 18px; padding: 22px 24px 14px; text-align:left; }
        .lg-input-meta { display:flex; justify-content:space-between; margin-bottom: 14px; }
        .lg-input-tag { font-size:11px; font-weight:600; color:#a855f7; letter-spacing:0.04em; text-transform:uppercase; }
        .lg-input-shortcut { font-size:11px; color:#737373; }
        .lg-input-text { font-size: 19px; color:#737373; min-height: 56px; line-height:1.45; font-weight:400; }
        .lg-input-bar { display:flex; justify-content:space-between; align-items:center; padding-top: 14px; border-top:1px solid rgba(0,0,0,0.06); }
        .lg-mode-pills { display:flex; gap:4px; padding:3px; background:rgba(0,0,0,0.04); border-radius:8px; }
        .lg-mode { font-size:12px; padding:6px 12px; border-radius:6px; color:#737373; font-weight:500; }
        .lg-mode.active { background:#fff; color:#0a0a0a; box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
        .lg-send { background: linear-gradient(135deg, #a855f7, #ec4899); color:#fff; border:none; padding:9px 18px; border-radius:9px; font-size:13px; font-weight:600; cursor:pointer; box-shadow: 0 4px 12px rgba(168,85,247,0.35); }
        .lg-chips { display:flex; gap:8px; justify-content:center; margin-top: 24px; flex-wrap:wrap; }
        .lg-chip { font-size:13px; padding: 8px 14px; background:rgba(255,255,255,0.7); backdrop-filter: blur(8px); border:1px solid rgba(0,0,0,0.06); border-radius:9px; color:#262626; font-weight:500; }
        .lg-stats { display:flex; justify-content:center; gap:48px; margin-top: 56px; }
        .lg-stat-num { font-size:28px; font-weight:700; letter-spacing:-0.03em; background: linear-gradient(135deg, #a855f7, #ec4899); -webkit-background-clip:text; background-clip:text; color:transparent; }
        .lg-stat-label { font-size:12px; color:#737373; margin-top:4px; }
      `}</style>
      <div className="lg">
        <div className="lg-inner">
          <nav className="lg-nav">
            <div className="lg-brand"><div className="lg-brand-mark"/>PromptMeGood</div>
            <div className="lg-nav-links"><span>Workstation</span><span>Photography</span><span>Marketplace</span><span>Pricing</span></div>
            <div className="lg-nav-actions"><span className="lg-signin">Sign in</span><button className="lg-cta">Try free →</button></div>
          </nav>
          <section className="lg-hero">
            <div className="lg-eyebrow">✨ <span>Earn the Workstation</span> — beta</div>
            <h1 className="lg-h1">Prompts that <span>actually</span><br/>get the result.</h1>
            <p className="lg-sub">Skip the prompt-engineering rabbit hole. Tell us your goal — we craft the prompt, plan the steps, and pick the right model.</p>
            <div className="lg-glass">
              <div className="lg-input">
                <div className="lg-input-meta">
                  <span className="lg-input-tag">⌘ prompt-engine · v3</span>
                  <span className="lg-input-shortcut">⌘ + K</span>
                </div>
                <div className="lg-input-text">Draft a launch announcement for our Series A — confident, no jargon, ~120 words…</div>
                <div className="lg-input-bar">
                  <div className="lg-mode-pills">
                    <span className="lg-mode active">Engine</span>
                    <span className="lg-mode">Photo</span>
                    <span className="lg-mode">Master Link</span>
                  </div>
                  <button className="lg-send">Generate →</button>
                </div>
              </div>
            </div>
            <div className="lg-chips">
              <span className="lg-chip">Series A announcement</span>
              <span className="lg-chip">3-week onboarding plan</span>
              <span className="lg-chip">Espresso bar hero shot</span>
            </div>
            <div className="lg-stats">
              <div><div className="lg-stat-num">3.2×</div><div className="lg-stat-label">Better outputs</div></div>
              <div><div className="lg-stat-num">12s</div><div className="lg-stat-label">First blueprint</div></div>
              <div><div className="lg-stat-num">No</div><div className="lg-stat-label">Signup needed</div></div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
export default HeroLinearGlass;
