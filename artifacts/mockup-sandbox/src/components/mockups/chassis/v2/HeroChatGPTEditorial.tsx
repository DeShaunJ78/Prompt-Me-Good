export function HeroChatGPTEditorial() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .ce { font-family: Inter, -apple-system, sans-serif; background: #0d0d0d; color: #ececec; min-height: 900px; position:relative; overflow:hidden; }
        .ce::before { content:''; position:absolute; top:-200px; left:50%; transform:translateX(-50%); width: 1100px; height: 700px; background: radial-gradient(ellipse, rgba(16,163,127,0.16), transparent 70%); pointer-events:none; }
        .ce-inner { position:relative; z-index:1; }
        .ce-nav { display:flex; align-items:center; justify-content:space-between; padding: 18px 32px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .ce-brand { font-family: Fraunces, serif; font-size:22px; font-weight:500; letter-spacing:-0.01em; }
        .ce-brand span { color: #10a37f; }
        .ce-nav-links { display:flex; gap:28px; font-size:13.5px; color: #a0a0a0; }
        .ce-nav-cta { font-size:13px; padding:8px 14px; background:#10a37f; color:#fff; border-radius:6px; border:none; cursor:pointer; font-weight:500; }
        .ce-hero { max-width: 820px; margin: 0 auto; padding: 100px 32px 60px; text-align:center; }
        .ce-eyebrow { font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.18em; text-transform:uppercase; color:#10a37f; margin-bottom:28px; }
        .ce-h1 { font-family: Fraunces, serif; font-weight: 400; font-size: 68px; line-height: 1.04; letter-spacing: -0.03em; margin: 0 0 24px; color:#f5f5f5; }
        .ce-h1 em { font-style: italic; color: #10a37f; font-weight: 500; }
        .ce-sub { font-size: 17px; line-height: 1.5; color: #909090; max-width: 580px; margin: 0 auto 44px; }
        .ce-input-shell { position:relative; padding: 1px; border-radius: 18px; background: linear-gradient(135deg, rgba(16,163,127,0.45), rgba(255,255,255,0.04) 50%, rgba(16,163,127,0.3)); }
        .ce-input { background: #161616; border-radius: 17px; padding: 22px 24px 16px; text-align:left; }
        .ce-input-label { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:12px; }
        .ce-input-text { font-family: Fraunces, serif; font-size: 20px; color: #888; min-height: 60px; line-height: 1.4; }
        .ce-input-bar { display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.06); }
        .ce-tools { display:flex; gap:6px; }
        .ce-tool { width:32px; height:32px; border-radius:8px; background:rgba(255,255,255,0.04); display:flex; align-items:center; justify-content:center; color:#909090; font-size:14px; }
        .ce-send { background:#10a37f; color:#fff; border:none; padding:9px 18px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; }
        .ce-chips { display:flex; gap:8px; justify-content:center; margin-top:20px; flex-wrap:wrap; }
        .ce-chip { font-family: Fraunces, serif; font-size:14px; padding: 8px 16px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:#c0c0c0; font-style:italic; }
        .ce-foot { display:flex; justify-content:center; gap:24px; margin-top: 40px; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:0.08em; color:#606060; text-transform:uppercase; }
        .ce-foot-dot { width:5px; height:5px; background:#10a37f; border-radius:50%; display:inline-block; margin-right:8px; vertical-align:middle; }
      `}</style>
      <div className="ce">
        <div className="ce-inner">
          <nav className="ce-nav">
            <div className="ce-brand">PromptMeGood<span>.</span></div>
            <div className="ce-nav-links"><span>Workstation</span><span>Photography</span><span>Marketplace</span><span>Pricing</span></div>
            <button className="ce-nav-cta">Get started</button>
          </nav>
          <section className="ce-hero">
            <div className="ce-eyebrow">— Earn the Workstation —</div>
            <h1 className="ce-h1">Stop guessing.<br/>Write prompts that <em>earn</em> the result.</h1>
            <p className="ce-sub">Type your goal in plain language. We draft the prompt, plan the steps, and pick the right model — the Workstation opens once your first prompt earns the result.</p>
            <div className="ce-input-shell">
              <div className="ce-input">
                <div className="ce-input-label">What are you trying to accomplish?</div>
                <div className="ce-input-text">Draft a launch announcement for our Series A round, written in a confident but human voice…</div>
                <div className="ce-input-bar">
                  <div className="ce-tools"><div className="ce-tool">+</div><div className="ce-tool">⊞</div><div className="ce-tool">⌘</div></div>
                  <button className="ce-send">Generate blueprint →</button>
                </div>
              </div>
            </div>
            <div className="ce-chips">
              <span className="ce-chip">Series A announcement</span>
              <span className="ce-chip">3-week onboarding plan</span>
              <span className="ce-chip">Espresso bar hero shot</span>
            </div>
            <div className="ce-foot"><span><span className="ce-foot-dot"/>No signup</span><span><span className="ce-foot-dot"/>One prompt to start</span><span><span className="ce-foot-dot"/>Workstation unlocks after</span></div>
          </section>
        </div>
      </div>
    </>
  );
}
export default HeroChatGPTEditorial;
