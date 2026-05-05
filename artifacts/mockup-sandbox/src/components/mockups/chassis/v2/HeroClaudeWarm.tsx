export function HeroClaudeWarm() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .cw { font-family: Inter, system-ui, sans-serif; background: #f6f1e8; color: #1a1612; min-height: 900px; }
        .cw-nav { display:flex; align-items:center; justify-content:space-between; padding: 22px 40px; border-bottom: 1px solid rgba(26,22,18,0.06); }
        .cw-brand { font-family: Fraunces, serif; font-size: 22px; font-weight: 500; letter-spacing: -0.01em; }
        .cw-brand span { color: #c4622d; }
        .cw-nav-links { display:flex; gap:28px; font-size:14px; color: rgba(26,22,18,0.65); }
        .cw-nav-cta { font-size:14px; padding:9px 16px; background:#1a1612; color:#f6f1e8; border-radius:8px; border:none; cursor:pointer; }
        .cw-hero { max-width: 760px; margin: 0 auto; padding: 96px 40px 60px; text-align:center; }
        .cw-eyebrow { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #c4622d; margin-bottom: 24px; }
        .cw-h1 { font-family: Fraunces, serif; font-weight: 400; font-size: 64px; line-height: 1.05; letter-spacing: -0.025em; margin: 0 0 24px; color: #1a1612; }
        .cw-h1 em { font-style: italic; color: #c4622d; font-weight: 500; }
        .cw-sub { font-size: 17px; line-height: 1.55; color: rgba(26,22,18,0.65); max-width: 560px; margin: 0 auto 48px; }
        .cw-input-wrap { background:#fff; border:1px solid rgba(26,22,18,0.1); border-radius:14px; padding: 6px; box-shadow: 0 1px 0 rgba(26,22,18,0.04), 0 24px 48px -28px rgba(196,98,45,0.15); text-align:left; }
        .cw-input { padding: 18px 18px 12px; }
        .cw-input-label { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:rgba(26,22,18,0.4); margin-bottom:10px; }
        .cw-input-text { font-family: Fraunces, serif; font-size:20px; line-height:1.4; color: rgba(26,22,18,0.4); min-height: 70px; }
        .cw-input-bar { display:flex; justify-content:space-between; align-items:center; padding: 10px 12px; background: #faf6ee; border-radius: 10px; }
        .cw-chips { display:flex; gap:6px; flex-wrap:wrap; }
        .cw-chip { font-size:12px; padding: 6px 11px; background:#fff; border:1px solid rgba(26,22,18,0.08); border-radius:7px; color: rgba(26,22,18,0.7); }
        .cw-send { background:#1a1612; color:#f6f1e8; border:none; padding:9px 18px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; display:inline-flex; gap:6px; align-items:center; }
        .cw-meta { display:flex; justify-content:center; gap:20px; margin-top: 28px; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.08em; color:rgba(26,22,18,0.45); text-transform:uppercase; }
        .cw-meta-dot { width:5px; height:5px; background:#c4622d; border-radius:50%; display:inline-block; margin-right:8px; vertical-align:middle; }
        .cw-after { max-width: 920px; margin: 60px auto 0; padding: 40px; border-top:1px solid rgba(26,22,18,0.08); display:grid; grid-template-columns:repeat(3,1fr); gap:32px; }
        .cw-after h4 { font-family:Fraunces, serif; font-size:16px; font-weight:500; margin:0 0 6px; }
        .cw-after p { font-size:13px; line-height:1.5; color:rgba(26,22,18,0.6); margin:0; }
        .cw-after-num { font-family:'JetBrains Mono',monospace; font-size:11px; color:#c4622d; margin-bottom:12px; letter-spacing:0.1em; }
      `}</style>
      <div className="cw">
        <nav className="cw-nav">
          <div className="cw-brand">PromptMeGood<span>.</span></div>
          <div className="cw-nav-links"><span>Workstation</span><span>Photography</span><span>Marketplace</span><span>Pricing</span></div>
          <button className="cw-nav-cta">Start free</button>
        </nav>
        <section className="cw-hero">
          <div className="cw-eyebrow">— Earn the Workstation —</div>
          <h1 className="cw-h1">Stop guessing.<br/>Write prompts that <em>earn</em> the result.</h1>
          <p className="cw-sub">Tell us what you're trying to do, in plain language. We'll write the prompt that lands the result — and unlock your workstation when you're ready.</p>
          <div className="cw-input-wrap">
            <div className="cw-input">
              <div className="cw-input-label">What are you trying to accomplish?</div>
              <div className="cw-input-text">Draft a launch announcement for our Series A round, written in a confident but human voice…</div>
            </div>
            <div className="cw-input-bar">
              <div className="cw-chips">
                <span className="cw-chip">Series A announcement</span>
                <span className="cw-chip">3-week onboarding plan</span>
                <span className="cw-chip">Espresso bar hero shot</span>
              </div>
              <button className="cw-send">Generate blueprint →</button>
            </div>
          </div>
          <div className="cw-meta"><span><span className="cw-meta-dot"/>No signup</span><span><span className="cw-meta-dot"/>One prompt to start</span><span><span className="cw-meta-dot"/>Workstation unlocks after</span></div>
        </section>
        <div className="cw-after">
          <div><div className="cw-after-num">01</div><h4>Tell us your goal</h4><p>Plain language. No prompt vocabulary required.</p></div>
          <div><div className="cw-after-num">02</div><h4>Get a starter blueprint</h4><p>The prompt, a 3-step plan, and the right mode for the job.</p></div>
          <div><div className="cw-after-num">03</div><h4>Open your Workstation</h4><p>Refine, iterate, and run — with the model that fits.</p></div>
        </div>
      </div>
    </>
  );
}
export default HeroClaudeWarm;
