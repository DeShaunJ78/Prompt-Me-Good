export function HeroChatGPTDark() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Söhne&display=swap');
        .cd { font-family: 'Söhne', Inter, -apple-system, sans-serif; background: #0d0d0d; color: #ececec; min-height: 900px; position:relative; overflow:hidden; }
        .cd::before { content:''; position:absolute; top:-200px; left:50%; transform:translateX(-50%); width: 1100px; height: 700px; background: radial-gradient(ellipse, rgba(16,163,127,0.18), transparent 70%); pointer-events:none; }
        .cd::after { content:''; position:absolute; top:0; left:0; right:0; height:100%; background-image:linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px); background-size: 60px 60px; pointer-events:none; }
        .cd-inner { position:relative; z-index:1; }
        .cd-nav { display:flex; align-items:center; justify-content:space-between; padding: 18px 32px; }
        .cd-brand { display:flex; align-items:center; gap:10px; font-size:15px; font-weight:600; letter-spacing:-0.01em; }
        .cd-brand-dot { width:24px; height:24px; border-radius:6px; background:linear-gradient(135deg,#10a37f,#1de9b6); }
        .cd-nav-links { display:flex; gap:28px; font-size:13.5px; color: #a0a0a0; }
        .cd-nav-cta { font-size:13px; padding:8px 14px; background:#10a37f; color:#fff; border-radius:6px; border:none; cursor:pointer; font-weight:500; }
        .cd-hero { max-width: 820px; margin: 0 auto; padding: 100px 32px 60px; text-align:center; }
        .cd-eyebrow { display:inline-flex; align-items:center; gap:8px; padding: 5px 12px; background: rgba(16,163,127,0.12); border:1px solid rgba(16,163,127,0.3); border-radius: 999px; font-size:12px; color:#1de9b6; margin-bottom: 28px; font-weight:500; }
        .cd-eyebrow::before { content:''; width:6px; height:6px; background:#10a37f; border-radius:50%; box-shadow:0 0 10px #10a37f; }
        .cd-h1 { font-size: 60px; line-height: 1.03; letter-spacing: -0.035em; font-weight: 600; margin: 0 0 24px; background: linear-gradient(180deg, #ffffff 0%, #a0a0a0 100%); -webkit-background-clip:text; background-clip:text; color: transparent; }
        .cd-sub { font-size: 17px; line-height: 1.5; color: #909090; max-width: 580px; margin: 0 auto 44px; }
        .cd-input-shell { position:relative; padding: 1px; border-radius: 22px; background: linear-gradient(135deg, rgba(16,163,127,0.55), rgba(255,255,255,0.05) 40%, rgba(255,255,255,0.05) 60%, rgba(29,233,182,0.4)); }
        .cd-input { background: #1a1a1a; border-radius: 21px; padding: 22px 24px 16px; text-align:left; }
        .cd-input-text { font-size: 16px; color: #6e6e6e; min-height: 56px; line-height: 1.5; }
        .cd-input-cursor { display:inline-block; width:2px; height:18px; background:#10a37f; vertical-align:-3px; animation: blink 1s infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        .cd-input-bar { display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:14px; border-top:1px solid rgba(255,255,255,0.06); }
        .cd-tools { display:flex; gap:6px; }
        .cd-tool { width:32px; height:32px; border-radius:8px; background:rgba(255,255,255,0.04); display:flex; align-items:center; justify-content:center; color:#909090; font-size:14px; }
        .cd-send { background:#10a37f; color:#fff; border:none; width:36px; height:36px; border-radius:10px; font-size:16px; cursor:pointer; box-shadow: 0 0 24px rgba(16,163,127,0.4); }
        .cd-chips { display:flex; gap:8px; justify-content:center; margin-top:20px; flex-wrap:wrap; }
        .cd-chip { font-size:12.5px; padding: 8px 14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:8px; color:#c0c0c0; }
        .cd-foot { display:flex; justify-content:center; gap:24px; margin-top: 40px; font-size:12px; color:#606060; }
        .cd-foot kbd { padding:2px 6px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:4px; font-family:inherit; color:#909090; font-size:11px; }
        .cd-trust { max-width:920px; margin:80px auto 0; padding: 24px 32px; border-top:1px solid rgba(255,255,255,0.06); display:flex; justify-content:space-around; align-items:center; opacity:0.45; font-size:14px; font-weight:600; letter-spacing:0.12em; color:#909090; }
      `}</style>
      <div className="cd">
        <div className="cd-inner">
          <nav className="cd-nav">
            <div className="cd-brand"><div className="cd-brand-dot"/>PromptMeGood</div>
            <div className="cd-nav-links"><span>Workstation</span><span>Photography</span><span>Marketplace</span><span>Pricing</span></div>
            <button className="cd-nav-cta">Get started</button>
          </nav>
          <section className="cd-hero">
            <div className="cd-eyebrow">Earn the Workstation</div>
            <h1 className="cd-h1">Talk to AI like<br/>you mean it.</h1>
            <p className="cd-sub">Type your goal. We draft the prompt, the plan, and pick the right model. The Workstation opens once your first prompt earns the result.</p>
            <div className="cd-input-shell">
              <div className="cd-input">
                <div className="cd-input-text">Draft a launch announcement for our Series A round<span className="cd-input-cursor"/></div>
                <div className="cd-input-bar">
                  <div className="cd-tools"><div className="cd-tool">+</div><div className="cd-tool">⊞</div><div className="cd-tool">⌘</div></div>
                  <button className="cd-send">↑</button>
                </div>
              </div>
            </div>
            <div className="cd-chips">
              <span className="cd-chip">📝 Series A announcement</span>
              <span className="cd-chip">📋 3-week onboarding plan</span>
              <span className="cd-chip">📷 Espresso bar hero shot</span>
            </div>
            <div className="cd-foot"><span>Press <kbd>↵</kbd> to send</span><span><kbd>⌘</kbd>+<kbd>K</kbd> for commands</span><span>No signup required</span></div>
          </section>
          <div className="cd-trust"><span>ACME</span><span>NORTHWIND</span><span>GLOBEX</span><span>INITECH</span><span>HOOLI</span></div>
        </div>
      </div>
    </>
  );
}
export default HeroChatGPTDark;
