export function HeroWarmDarkHybrid() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .wh { font-family: Inter, -apple-system, sans-serif; background: #1a1410; color: #f0e8d8; min-height: 900px; position:relative; overflow:hidden; }
        .wh::before { content:''; position:absolute; top:-180px; left:50%; transform:translateX(-50%); width: 1100px; height: 700px; background: radial-gradient(ellipse, rgba(229,124,74,0.18), transparent 70%); pointer-events:none; }
        .wh::after { content:''; position:absolute; inset:0; background-image:linear-gradient(rgba(240,232,216,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(240,232,216,0.012) 1px, transparent 1px); background-size: 60px 60px; pointer-events:none; }
        .wh-inner { position:relative; z-index:1; }
        .wh-nav { display:flex; align-items:center; justify-content:space-between; padding: 18px 32px; }
        .wh-brand { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:600; letter-spacing:-0.01em; }
        .wh-brand-dot { width:24px; height:24px; border-radius:6px; background:linear-gradient(135deg,#e57c4a,#f4a574); }
        .wh-nav-links { display:flex; gap:28px; font-size:13.5px; color: rgba(240,232,216,0.6); }
        .wh-nav-cta { font-size:13px; padding:8px 14px; background:#e57c4a; color:#1a1410; border-radius:6px; border:none; cursor:pointer; font-weight:600; }
        .wh-hero { max-width: 820px; margin: 0 auto; padding: 100px 32px 60px; text-align:center; }
        .wh-eyebrow { display:inline-flex; align-items:center; gap:8px; padding: 5px 12px; background: rgba(229,124,74,0.12); border:1px solid rgba(229,124,74,0.3); border-radius: 999px; font-size:12px; color:#f4a574; margin-bottom: 28px; font-weight:500; }
        .wh-eyebrow::before { content:''; width:6px; height:6px; background:#e57c4a; border-radius:50%; box-shadow:0 0 10px #e57c4a; }
        .wh-h1 { font-size: 60px; line-height: 1.03; letter-spacing: -0.035em; font-weight: 600; margin: 0 0 24px; background: linear-gradient(180deg, #f5ecd9 0%, #a89682 100%); -webkit-background-clip:text; background-clip:text; color: transparent; }
        .wh-sub { font-size: 17px; line-height: 1.5; color: rgba(240,232,216,0.6); max-width: 580px; margin: 0 auto 44px; }
        .wh-input-shell { position:relative; padding: 1px; border-radius: 22px; background: linear-gradient(135deg, rgba(229,124,74,0.55), rgba(240,232,216,0.05) 40%, rgba(240,232,216,0.05) 60%, rgba(244,165,116,0.4)); }
        .wh-input { background: #231b15; border-radius: 21px; padding: 22px 24px 16px; text-align:left; }
        .wh-input-text { font-size: 16px; color: rgba(240,232,216,0.5); min-height: 56px; line-height: 1.5; }
        .wh-input-cursor { display:inline-block; width:2px; height:18px; background:#e57c4a; vertical-align:-3px; animation: blink 1s infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        .wh-input-bar { display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:14px; border-top:1px solid rgba(240,232,216,0.06); }
        .wh-tools { display:flex; gap:6px; }
        .wh-tool { width:32px; height:32px; border-radius:8px; background:rgba(240,232,216,0.04); display:flex; align-items:center; justify-content:center; color:rgba(240,232,216,0.55); font-size:14px; }
        .wh-send { background:#e57c4a; color:#1a1410; border:none; width:36px; height:36px; border-radius:10px; font-size:16px; font-weight:700; cursor:pointer; box-shadow: 0 0 24px rgba(229,124,74,0.4); }
        .wh-chips { display:flex; gap:8px; justify-content:center; margin-top:20px; flex-wrap:wrap; }
        .wh-chip { font-size:12.5px; padding: 8px 14px; background:rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.08); border-radius:8px; color:rgba(240,232,216,0.75); }
        .wh-foot { display:flex; justify-content:center; gap:24px; margin-top: 40px; font-size:12px; color:rgba(240,232,216,0.4); }
        .wh-foot kbd { padding:2px 6px; background:rgba(240,232,216,0.06); border:1px solid rgba(240,232,216,0.08); border-radius:4px; font-family:inherit; color:rgba(240,232,216,0.6); font-size:11px; }
        .wh-trust { max-width:920px; margin:80px auto 0; padding: 24px 32px; border-top:1px solid rgba(240,232,216,0.06); display:flex; justify-content:space-around; align-items:center; opacity:0.45; font-size:14px; font-weight:600; letter-spacing:0.12em; color:rgba(240,232,216,0.6); }
      `}</style>
      <div className="wh">
        <div className="wh-inner">
          <nav className="wh-nav">
            <div className="wh-brand"><div className="wh-brand-dot"/>PromptMeGood</div>
            <div className="wh-nav-links"><span>Workstation</span><span>Photography</span><span>Marketplace</span><span>Pricing</span></div>
            <button className="wh-nav-cta">Get started</button>
          </nav>
          <section className="wh-hero">
            <div className="wh-eyebrow">Earn the Workstation</div>
            <h1 className="wh-h1">Talk to AI like<br/>you mean it.</h1>
            <p className="wh-sub">Type your goal. We draft the prompt, the plan, and pick the right model. The Workstation opens once your first prompt earns the result.</p>
            <div className="wh-input-shell">
              <div className="wh-input">
                <div className="wh-input-text">Draft a launch announcement for our Series A round<span className="wh-input-cursor"/></div>
                <div className="wh-input-bar">
                  <div className="wh-tools"><div className="wh-tool">+</div><div className="wh-tool">⊞</div><div className="wh-tool">⌘</div></div>
                  <button className="wh-send">↑</button>
                </div>
              </div>
            </div>
            <div className="wh-chips">
              <span className="wh-chip">📝 Series A announcement</span>
              <span className="wh-chip">📋 3-week onboarding plan</span>
              <span className="wh-chip">📷 Espresso bar hero shot</span>
            </div>
            <div className="wh-foot"><span>Press <kbd>↵</kbd> to send</span><span><kbd>⌘</kbd>+<kbd>K</kbd> for commands</span><span>No signup required</span></div>
          </section>
          <div className="wh-trust"><span>ACME</span><span>NORTHWIND</span><span>GLOBEX</span><span>INITECH</span><span>HOOLI</span></div>
        </div>
      </div>
    </>
  );
}
export default HeroWarmDarkHybrid;
