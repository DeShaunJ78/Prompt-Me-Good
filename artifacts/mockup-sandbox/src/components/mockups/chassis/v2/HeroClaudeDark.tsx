export function HeroClaudeDark() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .cdk { font-family: Inter, system-ui, sans-serif; background: #1a1410; color: #f0e8d8; min-height: 900px; }
        .cdk-nav { display:flex; align-items:center; justify-content:space-between; padding: 22px 40px; border-bottom: 1px solid rgba(240,232,216,0.06); }
        .cdk-brand { font-family: Fraunces, serif; font-size: 22px; font-weight: 500; letter-spacing: -0.01em; color: #f0e8d8; }
        .cdk-brand span { color: #e57c4a; }
        .cdk-nav-links { display:flex; gap:28px; font-size:14px; color: rgba(240,232,216,0.6); }
        .cdk-nav-cta { font-size:14px; padding:9px 16px; background:#e57c4a; color:#1a1410; border-radius:8px; border:none; cursor:pointer; font-weight:500; }
        .cdk-hero { max-width: 760px; margin: 0 auto; padding: 96px 40px 60px; text-align:center; }
        .cdk-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #e57c4a; margin-bottom: 24px; }
        .cdk-h1 { font-family: Fraunces, serif; font-weight: 400; font-size: 64px; line-height: 1.05; letter-spacing: -0.025em; margin: 0 0 24px; color: #f5ecd9; }
        .cdk-h1 em { font-style: italic; color: #e57c4a; font-weight: 500; }
        .cdk-sub { font-size: 17px; line-height: 1.55; color: rgba(240,232,216,0.6); max-width: 560px; margin: 0 auto 48px; }
        .cdk-input-wrap { background:#231b15; border:1px solid rgba(240,232,216,0.1); border-radius:14px; padding: 6px; box-shadow: 0 24px 60px -28px rgba(229,124,74,0.25); text-align:left; }
        .cdk-input { padding: 18px 18px 12px; }
        .cdk-input-label { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:rgba(240,232,216,0.4); margin-bottom:10px; }
        .cdk-input-text { font-family: Fraunces, serif; font-size:20px; line-height:1.4; color: rgba(240,232,216,0.5); min-height: 70px; }
        .cdk-input-bar { display:flex; justify-content:space-between; align-items:center; padding: 10px 12px; background: #2c2218; border-radius: 10px; }
        .cdk-chips { display:flex; gap:6px; flex-wrap:wrap; }
        .cdk-chip { font-size:12px; padding: 6px 11px; background:#1a1410; border:1px solid rgba(240,232,216,0.08); border-radius:7px; color: rgba(240,232,216,0.7); }
        .cdk-send { background:#e57c4a; color:#1a1410; border:none; padding:9px 18px; border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; }
        .cdk-meta { display:flex; justify-content:center; gap:20px; margin-top: 28px; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.08em; color:rgba(240,232,216,0.45); text-transform:uppercase; }
        .cdk-meta-dot { width:5px; height:5px; background:#e57c4a; border-radius:50%; display:inline-block; margin-right:8px; vertical-align:middle; }
        .cdk-after { max-width: 920px; margin: 60px auto 0; padding: 40px; border-top:1px solid rgba(240,232,216,0.08); display:grid; grid-template-columns:repeat(3,1fr); gap:32px; }
        .cdk-after h4 { font-family:Fraunces, serif; font-size:16px; font-weight:500; margin:0 0 6px; color:#f5ecd9; }
        .cdk-after p { font-size:13px; line-height:1.5; color:rgba(240,232,216,0.55); margin:0; }
        .cdk-after-num { font-family:'JetBrains Mono',monospace; font-size:11px; color:#e57c4a; margin-bottom:12px; letter-spacing:0.1em; }
      `}</style>
      <div className="cdk">
        <nav className="cdk-nav">
          <div className="cdk-brand">PromptMeGood<span>.</span></div>
          <div className="cdk-nav-links"><span>Workstation</span><span>Photography</span><span>Marketplace</span><span>Pricing</span></div>
          <button className="cdk-nav-cta">Start free</button>
        </nav>
        <section className="cdk-hero">
          <div className="cdk-eyebrow">— Earn the Workstation —</div>
          <h1 className="cdk-h1">Stop guessing.<br/>Write prompts that <em>earn</em> the result.</h1>
          <p className="cdk-sub">Tell us what you're trying to do, in plain language. We'll write the prompt that lands the result — and unlock your workstation when you're ready.</p>
          <div className="cdk-input-wrap">
            <div className="cdk-input">
              <div className="cdk-input-label">What are you trying to accomplish?</div>
              <div className="cdk-input-text">Draft a launch announcement for our Series A round, written in a confident but human voice…</div>
            </div>
            <div className="cdk-input-bar">
              <div className="cdk-chips">
                <span className="cdk-chip">Series A announcement</span>
                <span className="cdk-chip">3-week onboarding plan</span>
                <span className="cdk-chip">Espresso bar hero shot</span>
              </div>
              <button className="cdk-send">Generate blueprint →</button>
            </div>
          </div>
          <div className="cdk-meta"><span><span className="cdk-meta-dot"/>No signup</span><span><span className="cdk-meta-dot"/>One prompt to start</span><span><span className="cdk-meta-dot"/>Workstation unlocks after</span></div>
        </section>
        <div className="cdk-after">
          <div><div className="cdk-after-num">01</div><h4>Tell us your goal</h4><p>Plain language. No prompt vocabulary required.</p></div>
          <div><div className="cdk-after-num">02</div><h4>Get a starter blueprint</h4><p>The prompt, a 3-step plan, and the right mode for the job.</p></div>
          <div><div className="cdk-after-num">03</div><h4>Open your Workstation</h4><p>Refine, iterate, and run — with the model that fits.</p></div>
        </div>
      </div>
    </>
  );
}
export default HeroClaudeDark;
