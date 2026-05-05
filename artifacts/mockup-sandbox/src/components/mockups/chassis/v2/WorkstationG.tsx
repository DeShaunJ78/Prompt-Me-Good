export function WorkstationG() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        .ws { font-family: Inter, -apple-system, sans-serif; background: #1a1410; color: #f0e8d8; min-height: 1100px; position:relative; overflow:hidden; }
        .ws::before { content:''; position:absolute; top:-300px; left:50%; transform:translateX(-50%); width: 1400px; height: 800px; background: radial-gradient(ellipse, rgba(229,124,74,0.1), transparent 70%); pointer-events:none; }
        .ws::after { content:''; position:absolute; inset:0; background-image:linear-gradient(rgba(240,232,216,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(240,232,216,0.012) 1px, transparent 1px); background-size: 60px 60px; pointer-events:none; }
        .ws-inner { position:relative; z-index:1; }

        /* Top bar */
        .ws-top { display:flex; align-items:center; justify-content:space-between; padding: 14px 24px; border-bottom: 1px solid rgba(240,232,216,0.06); }
        .ws-top-l { display:flex; align-items:center; gap:14px; }
        .ws-brand { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:600; letter-spacing:-0.01em; }
        .ws-brand-dot { width:22px; height:22px; border-radius:6px; background:linear-gradient(135deg,#e57c4a,#f4a574); }
        .ws-divider { width:1px; height:18px; background:rgba(240,232,216,0.1); }
        .ws-crumbs { font-family:'JetBrains Mono',monospace; font-size:11px; color: rgba(240,232,216,0.5); letter-spacing:0.04em; }
        .ws-crumbs span { color:#e57c4a; }
        .ws-top-c { display:flex; gap:2px; padding:3px; background:rgba(240,232,216,0.04); border-radius:8px; border:1px solid rgba(240,232,216,0.06); }
        .ws-mode { font-size:12.5px; padding: 6px 14px; border-radius:6px; color:rgba(240,232,216,0.55); font-weight:500; cursor:pointer; }
        .ws-mode.active { background:rgba(229,124,74,0.15); color:#f4a574; box-shadow: inset 0 0 0 1px rgba(229,124,74,0.3); }
        .ws-top-r { display:flex; align-items:center; gap:10px; }
        .ws-icon-btn { width:32px; height:32px; border-radius:8px; background:rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.06); display:flex; align-items:center; justify-content:center; color:rgba(240,232,216,0.6); font-size:14px; cursor:pointer; }
        .ws-expert { font-size:12.5px; padding:7px 12px; background:rgba(229,124,74,0.1); border:1px solid rgba(229,124,74,0.3); color:#f4a574; border-radius:7px; cursor:pointer; font-weight:500; display:inline-flex; gap:6px; align-items:center; }
        .ws-avatar { width:30px; height:30px; border-radius:50%; background:linear-gradient(135deg,#e57c4a,#f4a574); font-size:12px; display:flex; align-items:center; justify-content:center; color:#1a1410; font-weight:700; }

        /* Body grid */
        .ws-body { display:grid; grid-template-columns: 240px 1fr 320px; min-height: 1020px; }

        /* Left rail */
        .ws-rail { border-right: 1px solid rgba(240,232,216,0.06); padding: 20px 14px; }
        .ws-rail-h { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(240,232,216,0.4); margin: 4px 8px 10px; }
        .ws-nav-item { display:flex; align-items:center; gap:10px; padding: 8px 10px; border-radius:7px; font-size:13px; color:rgba(240,232,216,0.7); cursor:pointer; margin-bottom:2px; }
        .ws-nav-item.active { background:rgba(229,124,74,0.12); color:#f4a574; }
        .ws-nav-item .dot { width:6px; height:6px; border-radius:50%; background:rgba(240,232,216,0.3); }
        .ws-nav-item.active .dot { background:#e57c4a; box-shadow:0 0 8px #e57c4a; }
        .ws-vault { margin-top: 24px; }
        .ws-vault-item { padding: 9px 10px; font-size:12.5px; color:rgba(240,232,216,0.65); border-left: 2px solid transparent; cursor:pointer; line-height:1.35; }
        .ws-vault-item:hover, .ws-vault-item.sel { border-left-color:#e57c4a; background: rgba(229,124,74,0.05); color:#f0e8d8; }
        .ws-vault-meta { font-family:'JetBrains Mono',monospace; font-size:9.5px; color:rgba(240,232,216,0.35); letter-spacing:0.08em; text-transform:uppercase; margin-top:3px; }

        /* Main column */
        .ws-main { padding: 32px 40px; }
        .ws-task { display:flex; align-items:center; justify-content:space-between; margin-bottom: 22px; }
        .ws-task-h { font-size: 22px; font-weight: 600; letter-spacing:-0.02em; }
        .ws-task-h em { font-style: normal; color: #f4a574; }
        .ws-task-meta { display:flex; gap:8px; }
        .ws-pill { font-family:'JetBrains Mono',monospace; font-size:10.5px; padding: 4px 9px; background:rgba(240,232,216,0.05); border:1px solid rgba(240,232,216,0.08); border-radius:5px; color:rgba(240,232,216,0.7); letter-spacing:0.06em; text-transform:uppercase; }
        .ws-pill.live { color:#f4a574; border-color:rgba(229,124,74,0.4); background:rgba(229,124,74,0.08); }
        .ws-pill.live::before { content:''; display:inline-block; width:5px; height:5px; background:#e57c4a; border-radius:50%; margin-right:6px; vertical-align:1px; box-shadow:0 0 6px #e57c4a; }

        /* Input card */
        .ws-input-shell { padding: 1px; border-radius: 14px; background: linear-gradient(135deg, rgba(229,124,74,0.45), rgba(240,232,216,0.04) 50%, rgba(244,165,116,0.3)); margin-bottom: 22px; }
        .ws-input { background: #231b15; border-radius: 13px; padding: 18px 20px; }
        .ws-input-head { display:flex; justify-content:space-between; margin-bottom: 12px; }
        .ws-input-label { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color:rgba(240,232,216,0.45); }
        .ws-input-counter { font-family:'JetBrains Mono',monospace; font-size:10px; color:rgba(240,232,216,0.4); }
        .ws-input-text { font-size:14px; line-height:1.55; color:#f0e8d8; min-height: 100px; }
        .ws-input-text .ph { color: rgba(240,232,216,0.35); }
        .ws-input-bar { display:flex; justify-content:space-between; align-items:center; margin-top:14px; padding-top:14px; border-top:1px solid rgba(240,232,216,0.06); }
        .ws-input-tools { display:flex; gap:6px; }
        .ws-tool { padding: 5px 10px; font-size:11.5px; background:rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.06); border-radius:6px; color:rgba(240,232,216,0.6); cursor:pointer; display:inline-flex; gap:5px; align-items:center; }
        .ws-tool .k { font-family:'JetBrains Mono',monospace; font-size:9.5px; opacity:0.6; }
        .ws-input-actions { display:flex; gap:8px; align-items:center; }
        .ws-btn-secondary { font-size:12.5px; padding: 8px 12px; background: transparent; border:1px solid rgba(240,232,216,0.12); color: rgba(240,232,216,0.75); border-radius:7px; cursor:pointer; }
        .ws-btn-primary { font-size:13px; padding: 9px 16px; background:#e57c4a; color:#1a1410; border:none; border-radius:7px; font-weight:600; cursor:pointer; box-shadow: 0 0 24px rgba(229,124,74,0.3); display:inline-flex; gap:6px; align-items:center; }

        /* Output cards */
        .ws-out-grid { display:grid; grid-template-columns: 1fr 1fr; gap:14px; margin-bottom: 16px; }
        .ws-card { background:#211a14; border:1px solid rgba(240,232,216,0.06); border-radius:11px; padding: 16px 18px; }
        .ws-card-h { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
        .ws-card-title { font-size: 12px; font-family:'JetBrains Mono',monospace; letter-spacing:0.14em; text-transform:uppercase; color:rgba(240,232,216,0.55); }
        .ws-card-title::before { content:''; display:inline-block; width:5px; height:5px; background:#e57c4a; border-radius:50%; margin-right:8px; vertical-align:2px; }
        .ws-card-action { font-size:11px; color:rgba(240,232,216,0.5); cursor:pointer; }
        .ws-card-body { font-size:13px; line-height:1.55; color:rgba(240,232,216,0.85); }
        .ws-card-body code { font-family:'JetBrains Mono',monospace; font-size:11.5px; background:rgba(229,124,74,0.1); color:#f4a574; padding:1px 5px; border-radius:3px; }
        .ws-step { display:flex; gap:10px; padding:8px 0; border-bottom: 1px solid rgba(240,232,216,0.05); font-size:13px; line-height:1.45; }
        .ws-step:last-child { border-bottom:none; }
        .ws-step-n { font-family:'JetBrains Mono',monospace; font-size:10.5px; color:#e57c4a; min-width:18px; padding-top:2px; }

        /* Result panel */
        .ws-result { background:#211a14; border:1px solid rgba(240,232,216,0.06); border-radius:11px; padding: 18px 20px; }
        .ws-result-h { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
        .ws-result-title { font-size:13px; font-weight:600; }
        .ws-result-actions { display:flex; gap:6px; }
        .ws-result-body { font-size:13.5px; line-height:1.65; color:rgba(240,232,216,0.85); }
        .ws-result-body p { margin: 0 0 10px; }
        .ws-result-body strong { color:#f5ecd9; }

        /* Right rail */
        .ws-side { border-left: 1px solid rgba(240,232,216,0.06); padding: 24px 20px; background: rgba(0,0,0,0.15); }
        .ws-side-block { margin-bottom: 24px; }
        .ws-side-h { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:rgba(240,232,216,0.45); margin-bottom: 10px; display:flex; justify-content:space-between; }
        .ws-model { display:flex; justify-content:space-between; align-items:center; padding:10px 12px; background:rgba(240,232,216,0.03); border:1px solid rgba(240,232,216,0.06); border-radius:8px; margin-bottom:6px; cursor:pointer; }
        .ws-model.sel { border-color:rgba(229,124,74,0.4); background:rgba(229,124,74,0.08); }
        .ws-model-name { font-size:13px; font-weight:500; }
        .ws-model-meta { font-family:'JetBrains Mono',monospace; font-size:10px; color:rgba(240,232,216,0.5); margin-top:2px; }
        .ws-slider { padding:10px 0; }
        .ws-slider-h { display:flex; justify-content:space-between; font-size:12px; color:rgba(240,232,216,0.7); margin-bottom:6px; }
        .ws-slider-val { font-family:'JetBrains Mono',monospace; color:#f4a574; }
        .ws-slider-track { height:4px; background:rgba(240,232,216,0.08); border-radius:2px; position:relative; }
        .ws-slider-fill { position:absolute; left:0; top:0; bottom:0; background:linear-gradient(90deg,#e57c4a,#f4a574); border-radius:2px; }
        .ws-slider-thumb { position:absolute; top:50%; transform:translate(-50%,-50%); width:12px; height:12px; background:#f4a574; border-radius:50%; box-shadow:0 0 8px rgba(229,124,74,0.5); }
        .ws-toggle-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; font-size:12.5px; color:rgba(240,232,216,0.75); }
        .ws-toggle { width:30px; height:17px; background:rgba(240,232,216,0.1); border-radius:9px; position:relative; }
        .ws-toggle.on { background:#e57c4a; }
        .ws-toggle::after { content:''; position:absolute; top:2px; left:2px; width:13px; height:13px; background:#f0e8d8; border-radius:50%; transition:0.2s; }
        .ws-toggle.on::after { left:15px; }
      `}</style>
      <div className="ws">
        <div className="ws-inner">

          <header className="ws-top">
            <div className="ws-top-l">
              <div className="ws-brand"><div className="ws-brand-dot"/>PromptMeGood</div>
              <div className="ws-divider"/>
              <div className="ws-crumbs">workstation / <span>series-a-launch</span></div>
            </div>
            <div className="ws-top-c">
              <div className="ws-mode active">Prompt Engine</div>
              <div className="ws-mode">Photography</div>
              <div className="ws-mode">Master Link</div>
            </div>
            <div className="ws-top-r">
              <button className="ws-expert">⌘ Expert Mode</button>
              <div className="ws-icon-btn">⌘K</div>
              <div className="ws-icon-btn">?</div>
              <div className="ws-avatar">JR</div>
            </div>
          </header>

          <div className="ws-body">

            <aside className="ws-rail">
              <div className="ws-rail-h">Workspace</div>
              <div className="ws-nav-item active"><div className="dot"/>Current draft</div>
              <div className="ws-nav-item"><div className="dot"/>History</div>
              <div className="ws-nav-item"><div className="dot"/>Saved prompts</div>
              <div className="ws-nav-item"><div className="dot"/>Brand voices</div>

              <div className="ws-vault">
                <div className="ws-rail-h">Recent · Vault</div>
                <div className="ws-vault-item sel">
                  Series A launch announcement
                  <div className="ws-vault-meta">Engine · 2m ago</div>
                </div>
                <div className="ws-vault-item">
                  Onboarding email — week 1
                  <div className="ws-vault-meta">Engine · today</div>
                </div>
                <div className="ws-vault-item">
                  Espresso bar hero shot
                  <div className="ws-vault-meta">Photo · yesterday</div>
                </div>
                <div className="ws-vault-item">
                  Pricing page rewrite
                  <div className="ws-vault-meta">Engine · 3d</div>
                </div>
              </div>
            </aside>

            <main className="ws-main">
              <div className="ws-task">
                <div className="ws-task-h">Series A launch <em>announcement</em></div>
                <div className="ws-task-meta">
                  <div className="ws-pill live">Auto-saved</div>
                  <div className="ws-pill">v3</div>
                </div>
              </div>

              <div className="ws-input-shell">
                <div className="ws-input">
                  <div className="ws-input-head">
                    <div className="ws-input-label">Prompt</div>
                    <div className="ws-input-counter">218 / 4,000</div>
                  </div>
                  <div className="ws-input-text">
                    You are a founder writing a Series A announcement for a B2B AI productivity tool. Write a confident, human-voiced post (~120 words) for LinkedIn that opens with a single concrete result, names the lead investor, and ends with a hiring nudge. <span className="ph">Avoid jargon, no exclamation marks…</span>
                  </div>
                  <div className="ws-input-bar">
                    <div className="ws-input-tools">
                      <div className="ws-tool">+ Context <span className="k">⌘O</span></div>
                      <div className="ws-tool">⊞ Variables</div>
                      <div className="ws-tool">↻ Diff</div>
                    </div>
                    <div className="ws-input-actions">
                      <button className="ws-btn-secondary">Save to vault</button>
                      <button className="ws-btn-primary">Run with AI ↵</button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ws-out-grid">
                <div className="ws-card">
                  <div className="ws-card-h">
                    <div className="ws-card-title">Quality check</div>
                    <div className="ws-card-action">Re-score</div>
                  </div>
                  <div className="ws-card-body">
                    <div className="ws-step"><div className="ws-step-n">✓</div>Specific outcome named (<code>+1 result</code>)</div>
                    <div className="ws-step"><div className="ws-step-n">✓</div>Word count target set (<code>~120</code>)</div>
                    <div className="ws-step"><div className="ws-step-n">!</div>Add a number — Series A amount or team size</div>
                    <div className="ws-step"><div className="ws-step-n">!</div>Audience could be sharper than "LinkedIn"</div>
                  </div>
                </div>
                <div className="ws-card">
                  <div className="ws-card-h">
                    <div className="ws-card-title">Suggested next steps</div>
                    <div className="ws-card-action">More</div>
                  </div>
                  <div className="ws-card-body">
                    <div className="ws-step"><div className="ws-step-n">01</div>Add the round amount and lead investor by name.</div>
                    <div className="ws-step"><div className="ws-step-n">02</div>Generate 3 voice variations (founder, team, customer).</div>
                    <div className="ws-step"><div className="ws-step-n">03</div>Re-run with brand voice <code>"calm-confident"</code>.</div>
                  </div>
                </div>
              </div>

              <div className="ws-result">
                <div className="ws-result-h">
                  <div className="ws-result-title">Run · gpt-4o · 2.1s</div>
                  <div className="ws-result-actions">
                    <button className="ws-btn-secondary">Copy</button>
                    <button className="ws-btn-secondary">Regenerate</button>
                    <button className="ws-btn-secondary">Save version</button>
                  </div>
                </div>
                <div className="ws-result-body">
                  <p>Two years ago, three of us tested whether you could write a prompt the way you brief a teammate — in plain language, with the result you actually need.</p>
                  <p>Today, <strong>PromptMeGood</strong> is used by 12,400 teams to do exactly that. We just closed a <strong>$14M Series A</strong> led by <strong>Founders Fund</strong>, with continued support from Y Combinator and a few founders we admire.</p>
                  <p>The money is for one thing: making the gap between "I have an idea" and "the model gave me what I wanted" disappear. We're hiring engineers, designers, and a head of growth — if that work sounds interesting, the link is in the comments.</p>
                </div>
              </div>
            </main>

            <aside className="ws-side">
              <div className="ws-side-block">
                <div className="ws-side-h"><span>Model</span><span style={{color:'#f4a574'}}>gpt-4o</span></div>
                <div className="ws-model sel"><div><div className="ws-model-name">GPT-4o</div><div className="ws-model-meta">FAST · BALANCED</div></div><div style={{color:'#f4a574'}}>●</div></div>
                <div className="ws-model"><div><div className="ws-model-name">Claude 3.5 Sonnet</div><div className="ws-model-meta">DEEP · CAREFUL</div></div></div>
                <div className="ws-model"><div><div className="ws-model-name">Gemini 1.5 Pro</div><div className="ws-model-meta">LONG-CONTEXT</div></div></div>
              </div>

              <div className="ws-side-block">
                <div className="ws-side-h">Tuning</div>
                <div className="ws-slider">
                  <div className="ws-slider-h"><span>Temperature</span><span className="ws-slider-val">0.4</span></div>
                  <div className="ws-slider-track"><div className="ws-slider-fill" style={{width:'40%'}}/><div className="ws-slider-thumb" style={{left:'40%'}}/></div>
                </div>
                <div className="ws-slider">
                  <div className="ws-slider-h"><span>Length</span><span className="ws-slider-val">120w</span></div>
                  <div className="ws-slider-track"><div className="ws-slider-fill" style={{width:'30%'}}/><div className="ws-slider-thumb" style={{left:'30%'}}/></div>
                </div>
                <div className="ws-slider">
                  <div className="ws-slider-h"><span>Specificity</span><span className="ws-slider-val">High</span></div>
                  <div className="ws-slider-track"><div className="ws-slider-fill" style={{width:'78%'}}/><div className="ws-slider-thumb" style={{left:'78%'}}/></div>
                </div>
              </div>

              <div className="ws-side-block">
                <div className="ws-side-h">Brand voice</div>
                <div className="ws-toggle-row"><span>Calm-confident</span><div className="ws-toggle on"/></div>
                <div className="ws-toggle-row"><span>Plain language</span><div className="ws-toggle on"/></div>
                <div className="ws-toggle-row"><span>Founder voice</span><div className="ws-toggle"/></div>
                <div className="ws-toggle-row"><span>Avoid jargon</span><div className="ws-toggle on"/></div>
              </div>

              <div className="ws-side-block">
                <div className="ws-side-h">Cost · this run</div>
                <div style={{fontSize:'24px', fontWeight:700, letterSpacing:'-0.02em'}}>$0.0042</div>
                <div style={{fontFamily:"'JetBrains Mono',monospace", fontSize:'10.5px', color:'rgba(240,232,216,0.5)', marginTop:'2px', letterSpacing:'0.06em'}}>1,041 IN · 312 OUT TOK</div>
              </div>
            </aside>

          </div>
        </div>
      </div>
    </>
  );
}
export default WorkstationG;
