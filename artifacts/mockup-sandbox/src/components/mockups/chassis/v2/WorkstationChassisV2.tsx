export function WorkstationChassisV2() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .ws { font-family: Inter, -apple-system, sans-serif; background: #1a1410; color: #f0e8d8; min-height: 1180px; position: relative; overflow: hidden; }
        .ws::before { content:''; position:absolute; top:-280px; left:50%; transform:translateX(-50%); width:1500px; height:760px; background: radial-gradient(ellipse, rgba(229,124,74,0.10), transparent 70%); pointer-events:none; }
        .ws::after { content:''; position:absolute; inset:0; background-image: linear-gradient(rgba(240,232,216,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(240,232,216,0.012) 1px, transparent 1px); background-size: 60px 60px; pointer-events:none; }
        .ws-in { position: relative; z-index: 1; }

        /* Top bar */
        .tb { display:flex; align-items:center; justify-content:space-between; padding:14px 22px; border-bottom:1px solid rgba(240,232,216,0.06); }
        .tb-l { display:flex; align-items:center; gap:14px; }
        .brand { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:600; letter-spacing:-0.01em; }
        .brand-dot { width:24px; height:24px; border-radius:7px; background: linear-gradient(135deg, #e57c4a, #f4a574); box-shadow: 0 4px 14px rgba(229,124,74,0.3); }
        .vbar { width:1px; height:18px; background: rgba(240,232,216,0.1); }
        .crumb { font-family:'JetBrains Mono', monospace; font-size:11px; color: rgba(240,232,216,0.5); letter-spacing:0.04em; }
        .crumb span { color: #f4a574; }
        .tb-r { display:flex; align-items:center; gap:10px; }
        .ico { width:32px; height:32px; border-radius:8px; background: rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.06); display:flex; align-items:center; justify-content:center; color: rgba(240,232,216,0.6); font-size:14px; cursor:pointer; }
        .kbd { font-family:'JetBrains Mono', monospace; font-size:10.5px; padding:6px 10px; background: rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.07); border-radius:6px; color: rgba(240,232,216,0.55); display:inline-flex; align-items:center; gap:6px; }
        .expert { font-size:12.5px; padding:7px 13px; background: rgba(229,124,74,0.1); border:1px solid rgba(229,124,74,0.32); color: #f4a574; border-radius:7px; font-weight:500; display:inline-flex; gap:7px; align-items:center; cursor:pointer; }
        .av { width:30px; height:30px; border-radius:50%; background: linear-gradient(135deg, #e57c4a, #f4a574); font-size:12px; display:flex; align-items:center; justify-content:center; color:#1a1410; font-weight:700; }

        /* Body grid */
        .body { display:grid; grid-template-columns: 240px 1fr 320px; min-height: 1100px; }

        /* === LEFT RAIL === */
        .rail { border-right:1px solid rgba(240,232,216,0.06); padding: 18px 14px; display:flex; flex-direction:column; }
        .rail-h { font-family:'JetBrains Mono', monospace; font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color: rgba(240,232,216,0.4); margin: 14px 8px 8px; }
        .new-btn { display:flex; align-items:center; justify-content:center; gap:8px; padding:10px 12px; background: linear-gradient(135deg, rgba(229,124,74,0.18), rgba(244,165,116,0.12)); border:1px solid rgba(229,124,74,0.4); border-radius:9px; color:#f4a574; font-size:13px; font-weight:600; cursor:pointer; box-shadow: 0 2px 12px rgba(229,124,74,0.15); }
        .vault-item { padding:9px 10px; border-radius:7px; border-left:2px solid transparent; cursor:pointer; line-height:1.35; margin-bottom:2px; }
        .vault-item:hover, .vault-item.sel { background: rgba(229,124,74,0.05); border-left-color:#e57c4a; }
        .vault-item .t { font-size:13px; color:#f0e8d8; font-weight:500; }
        .vault-item .m { font-family:'JetBrains Mono',monospace; font-size:9.5px; color: rgba(240,232,216,0.4); letter-spacing:0.06em; text-transform:uppercase; margin-top:3px; }
        .tpl-grid { display:grid; grid-template-columns: 1fr 1fr; gap:6px; }
        .tpl { padding: 8px 10px; border:1px solid rgba(240,232,216,0.08); border-radius:7px; font-size:12px; color: rgba(240,232,216,0.7); text-align:center; cursor:pointer; }
        .tpl:hover { border-color: rgba(229,124,74,0.4); color:#f4a574; }
        .tools-row { padding: 9px 10px; font-size:12.5px; color: rgba(240,232,216,0.65); border-radius:7px; cursor:pointer; display:flex; align-items:center; gap:8px; }
        .tools-row:hover { background: rgba(240,232,216,0.04); color:#f0e8d8; }
        .tools-row .i { width:14px; height:14px; border-radius:3px; background: rgba(229,124,74,0.25); }
        .rail-foot { margin-top:auto; padding: 12px 6px 4px; border-top:1px solid rgba(240,232,216,0.06); }
        .appearance { display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:7px; cursor:pointer; }
        .appearance:hover { background: rgba(240,232,216,0.04); }
        .swatches { display:flex; gap:5px; }
        .sw { width:14px; height:14px; border-radius:50%; }
        .sw1 { background: #e57c4a; box-shadow: 0 0 0 2px rgba(229,124,74,0.3); }
        .sw2 { background: #4ac6e5; }
        .sw3 { background: #a574f4; }
        .sw4 { background: #f4d574; }
        .appearance .lab { font-size:12px; color: rgba(240,232,216,0.6); }

        /* === MAIN COLUMN === */
        .main { display:flex; flex-direction:column; min-height: 1100px; }
        .mode-bar { display:flex; align-items:center; justify-content:space-between; padding: 18px 32px 12px; }
        .modes { display:flex; gap:3px; padding:3px; background: rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.06); border-radius:9px; }
        .mode { font-size:12.5px; padding: 7px 16px; border-radius:7px; color: rgba(240,232,216,0.55); font-weight:500; cursor:pointer; display:inline-flex; gap:7px; align-items:center; }
        .mode.active { background: rgba(229,124,74,0.15); color: #f4a574; box-shadow: inset 0 0 0 1px rgba(229,124,74,0.3); }
        .mode .dot { width:5px; height:5px; border-radius:50%; background: currentColor; opacity:0.7; }
        .session-meta { display:flex; gap:8px; }
        .pill { font-family:'JetBrains Mono', monospace; font-size:10.5px; padding: 4px 10px; background: rgba(240,232,216,0.05); border:1px solid rgba(240,232,216,0.08); border-radius:5px; color: rgba(240,232,216,0.7); letter-spacing:0.06em; text-transform:uppercase; }
        .pill.live { color:#f4a574; border-color: rgba(229,124,74,0.4); background: rgba(229,124,74,0.08); }
        .pill.live::before { content:''; display:inline-block; width:5px; height:5px; background:#e57c4a; border-radius:50%; margin-right:6px; vertical-align:1px; box-shadow: 0 0 6px #e57c4a; }

        /* Thread */
        .thread { padding: 0 32px 12px; flex:1; display:flex; flex-direction:column; gap: 18px; }

        /* User bubble */
        .u-row { display:flex; gap:12px; align-items:flex-start; }
        .u-av { width:30px; height:30px; border-radius:50%; background: rgba(240,232,216,0.08); border:1px solid rgba(240,232,216,0.1); display:flex; align-items:center; justify-content:center; font-size:11px; color: rgba(240,232,216,0.7); flex-shrink:0; }
        .u-msg { flex:1; padding: 12px 16px; background: rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.07); border-radius: 4px 12px 12px 12px; font-size:14px; color: #f0e8d8; line-height:1.5; }

        /* Generated Prompt card */
        .gp-shell { padding:1px; border-radius:14px; background: linear-gradient(135deg, rgba(229,124,74,0.45), rgba(240,232,216,0.04) 50%, rgba(244,165,116,0.3)); }
        .gp { background: #231b15; border-radius: 13px; padding: 18px 20px; }
        .gp-h { display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px; }
        .gp-h-l { display:flex; align-items:center; gap:10px; }
        .gp-tag { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color: rgba(244,165,116,0.7); }
        .gp-title { font-size:15px; font-weight:600; }
        .gp-strength { display:inline-flex; align-items:center; gap:7px; padding:5px 11px; border-radius:14px; background: rgba(229,124,74,0.12); border:1px solid rgba(229,124,74,0.35); font-family:'JetBrains Mono', monospace; font-size:10.5px; color:#f4a574; }
        .gp-strength b { color:#f0e8d8; font-weight:600; }
        .gp-body { font-size:13.5px; line-height:1.6; color: rgba(240,232,216,0.88); }
        .gp-body em { font-style:normal; color:#f4a574; background: rgba(229,124,74,0.08); padding:1px 4px; border-radius:3px; }
        .gp-actions { display:flex; gap:8px; margin-top:14px; padding-top:14px; border-top:1px solid rgba(240,232,216,0.06); flex-wrap:wrap; }
        .btn { font-size:12.5px; padding:7px 14px; border-radius:7px; cursor:pointer; font-weight:500; border:1px solid rgba(240,232,216,0.1); background: rgba(240,232,216,0.04); color:#f0e8d8; display:inline-flex; gap:7px; align-items:center; }
        .btn:hover { background: rgba(240,232,216,0.07); }
        .btn.primary { background: linear-gradient(135deg,#e57c4a,#f4a574); border-color: transparent; color:#1a1410; font-weight:600; box-shadow: 0 4px 14px rgba(229,124,74,0.3); }
        .btn.ghost { background: transparent; }
        .btn .ic { width:13px; height:13px; border-radius:3px; background: currentColor; opacity:0.8; }

        /* AI Result card */
        .ai { background: rgba(240,232,216,0.025); border:1px solid rgba(240,232,216,0.07); border-radius: 12px; padding: 16px 18px; }
        .ai-h { display:flex; justify-content:space-between; margin-bottom: 10px; align-items:center; }
        .ai-tag { display:inline-flex; align-items:center; gap:7px; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color: rgba(240,232,216,0.55); }
        .ai-tag::before { content:''; width:6px; height:6px; background:#4ade80; border-radius:50%; box-shadow: 0 0 6px #4ade80; }
        .ai-meta { font-family:'JetBrains Mono',monospace; font-size:10px; color: rgba(240,232,216,0.4); }
        .ai-body { font-size:13.5px; line-height:1.6; color: rgba(240,232,216,0.85); }
        .ai-body p { margin: 0 0 8px; }
        .ai-actions { display:flex; gap:8px; margin-top:12px; padding-top:12px; border-top:1px solid rgba(240,232,216,0.06); }

        /* Composer */
        .composer-wrap { padding: 0 32px 28px; }
        .composer-shell { padding:1px; border-radius:14px; background: linear-gradient(135deg, rgba(229,124,74,0.35), rgba(240,232,216,0.05)); }
        .composer { background: #1f1813; border-radius: 13px; padding: 14px 16px; }
        .composer-text { font-size:14px; color: rgba(240,232,216,0.45); padding: 8px 4px; min-height: 44px; }
        .composer-bar { display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px solid rgba(240,232,216,0.05); }
        .composer-bar-l { display:flex; gap:6px; }
        .chip { font-size:11.5px; padding:5px 10px; border-radius:6px; border:1px solid rgba(240,232,216,0.08); color: rgba(240,232,216,0.65); cursor:pointer; display:inline-flex; gap:6px; align-items:center; background: rgba(240,232,216,0.02); }
        .chip:hover { color:#f4a574; border-color: rgba(229,124,74,0.3); }
        .composer-hint { font-family:'JetBrains Mono', monospace; font-size:10px; color: rgba(240,232,216,0.38); margin-top:8px; padding: 0 4px; }

        /* === RIGHT TOOL PANEL === */
        .tools { border-left:1px solid rgba(240,232,216,0.06); padding: 18px 16px; display:flex; flex-direction:column; gap: 16px; }
        .tools-h { display:flex; justify-content:space-between; align-items:center; }
        .tools-h .t { font-size:13px; font-weight:600; }
        .tools-h .sub { font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:0.14em; text-transform:uppercase; color: rgba(240,232,216,0.4); margin-top:3px; }
        .ml-toggle { display:flex; align-items:center; justify-content:space-between; padding:11px 13px; background: rgba(229,124,74,0.06); border:1px solid rgba(229,124,74,0.25); border-radius:9px; }
        .ml-toggle .ml-l .lab { font-size:12.5px; font-weight:600; color:#f0e8d8; display:flex; align-items:center; gap:6px; }
        .ml-toggle .ml-l .desc { font-size:10.5px; color: rgba(240,232,216,0.5); margin-top:2px; }
        .switch { width:36px; height:20px; background: rgba(229,124,74,0.4); border-radius:10px; position:relative; cursor:pointer; }
        .switch::after { content:''; position:absolute; top:2px; left:18px; width:16px; height:16px; background:#f4a574; border-radius:50%; box-shadow: 0 0 8px rgba(244,165,116,0.6); }

        .photo { background: rgba(240,232,216,0.025); border:1px solid rgba(240,232,216,0.06); border-radius:10px; padding: 12px 13px; }
        .photo-h { display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; }
        .photo-h .t { font-size:12.5px; font-weight:600; display:inline-flex; gap:7px; align-items:center; }
        .photo-h .surprise { font-size:11px; color:#f4a574; cursor:pointer; }
        .acc { padding: 9px 0; border-bottom:1px solid rgba(240,232,216,0.05); display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
        .acc:last-child { border-bottom:none; }
        .acc .nm { font-size:12px; color: rgba(240,232,216,0.75); }
        .acc.open .nm { color:#f4a574; }
        .acc .ct { font-family:'JetBrains Mono', monospace; font-size:9.5px; color: rgba(240,232,216,0.4); letter-spacing:0.06em; }
        .acc .car { color: rgba(240,232,216,0.4); font-size:10px; }
        .pills { display:flex; flex-wrap:wrap; gap:5px; padding: 8px 0 4px; }
        .pl { font-size:10.5px; padding: 4px 8px; border-radius:5px; background: rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.07); color: rgba(240,232,216,0.7); cursor:pointer; }
        .pl.on { background: rgba(229,124,74,0.15); color:#f4a574; border-color: rgba(229,124,74,0.4); }

        .mp { background: rgba(240,232,216,0.025); border:1px solid rgba(240,232,216,0.06); border-radius:10px; padding: 12px 13px; }
        .mp-h { font-size:12.5px; font-weight:600; margin-bottom:8px; display:flex; align-items:center; gap:7px; }
        .mp-h .badge { font-family:'JetBrains Mono',monospace; font-size:9px; padding: 2px 6px; border-radius:4px; background: rgba(229,124,74,0.18); color:#f4a574; letter-spacing:0.1em; }
        .mp-row { display:flex; align-items:center; gap:8px; padding: 6px 0; font-size:11.5px; color: rgba(240,232,216,0.7); }
        .mp-row .ck { width:13px; height:13px; border-radius:3px; border:1px solid rgba(229,124,74,0.5); background: rgba(229,124,74,0.15); }
        .mp-btn { width:100%; margin-top:10px; padding: 9px 12px; background: linear-gradient(135deg, rgba(229,124,74,0.2), rgba(244,165,116,0.12)); border:1px solid rgba(229,124,74,0.45); color:#f4a574; font-size:12px; font-weight:600; border-radius:7px; cursor:pointer; }

        .gen-img { padding: 9px 12px; background: rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.08); border-radius:7px; font-size:12px; color:#f0e8d8; cursor:pointer; display:flex; justify-content:space-between; align-items:center; }
        .gen-img:hover { border-color: rgba(229,124,74,0.4); }
        .gen-img .arrow { color:#f4a574; }

        /* Status / footer thin bar */
        .statusbar { padding: 8px 22px; border-top: 1px solid rgba(240,232,216,0.05); display:flex; justify-content:space-between; align-items:center; font-family:'JetBrains Mono',monospace; font-size:10px; color: rgba(240,232,216,0.4); letter-spacing:0.06em; }
        .statusbar .l { display:flex; gap:14px; }
        .statusbar .l span { color:#f4a574; }
      `}</style>
      <div className="ws">
        <div className="ws-in">
          {/* TOP BAR */}
          <div className="tb">
            <div className="tb-l">
              <div className="brand">
                <div className="brand-dot" />
                <span>PromptMeGood</span>
              </div>
              <div className="vbar" />
              <div className="crumb">/<span>app</span> · conversational workstation</div>
            </div>
            <div className="tb-r">
              <span className="kbd">⌘K Search</span>
              <div className="ico" title="Help">?</div>
              <span className="expert">⚙ Expert Mode</span>
              <div className="av">U</div>
            </div>
          </div>

          {/* BODY */}
          <div className="body">
            {/* === LEFT RAIL === */}
            <aside className="rail">
              <button className="new-btn">+ New Prompt</button>

              <div className="rail-h">Local Vault · 28 saved</div>
              <div className="vault-item sel">
                <div className="t">Fitness Product Ad</div>
                <div className="m">Prompt + AI Result · 2h</div>
              </div>
              <div className="vault-item">
                <div className="t">Portrait — Golden Hour</div>
                <div className="m">Photography combo · 1d</div>
              </div>
              <div className="vault-item">
                <div className="t">Cold Email — SaaS</div>
                <div className="m">From template · 3d</div>
              </div>
              <div className="vault-item">
                <div className="t">Brand Voice — Witty</div>
                <div className="m">Master Plan · 1w</div>
              </div>

              <div className="rail-h">Templates</div>
              <div className="tpl-grid">
                <div className="tpl">Business</div>
                <div className="tpl">Content</div>
                <div className="tpl">Image</div>
                <div className="tpl">Money</div>
              </div>

              <div className="rail-h">Vault Tools</div>
              <div className="tools-row"><div className="i" /> Import / Export</div>
              <div className="tools-row"><div className="i" /> Backup &amp; Restore</div>
              <div className="tools-row"><div className="i" /> Favorites &amp; Compare</div>

              <div className="rail-foot">
                <div className="appearance">
                  <div className="swatches">
                    <div className="sw sw1" />
                    <div className="sw sw2" />
                    <div className="sw sw3" />
                    <div className="sw sw4" />
                  </div>
                  <div className="lab">Theme accent</div>
                </div>
              </div>
            </aside>

            {/* === MAIN === */}
            <section className="main">
              <div className="mode-bar">
                <div className="modes">
                  <div className="mode active"><span className="dot" /> Prompt Engine</div>
                  <div className="mode">Photography Suite</div>
                  <div className="mode">Master Plan</div>
                </div>
                <div className="session-meta">
                  <span className="pill live">Session</span>
                  <span className="pill">gpt-4o</span>
                  <span className="pill">Local-first</span>
                </div>
              </div>

              <div className="thread">
                {/* User msg */}
                <div className="u-row">
                  <div className="u-av">U</div>
                  <div className="u-msg">Help me create a high-converting short-form ad for a wearable fitness product targeting busy professionals.</div>
                </div>

                {/* Generated Prompt card */}
                <div className="gp-shell">
                  <div className="gp">
                    <div className="gp-h">
                      <div className="gp-h-l">
                        <span className="brand-dot" style={{ width: 18, height: 18, borderRadius: 5 }} />
                        <div>
                          <div className="gp-tag">Generated Prompt</div>
                          <div className="gp-title">Direct-Response Ad Brief · v1</div>
                        </div>
                      </div>
                      <span className="gp-strength">Strength <b>92</b>/100</span>
                    </div>
                    <div className="gp-body">
                      Act as a senior <em>direct-response strategist</em>. Create a 30-second short-form video ad brief for a wearable fitness product. Include the hook, customer problem, transformation arc, three talking points, on-screen text cues, voiceover tone, CTA, and platform-specific cuts for <em>TikTok, Reels, and Shorts</em>. Avoid hype and fake urgency. Output as a structured brief with timestamps.
                    </div>
                    <div className="gp-actions">
                      <button className="btn primary"><span className="ic" /> Run With AI</button>
                      <button className="btn">Copy</button>
                      <button className="btn">Save to Vault</button>
                      <button className="btn">Refine · Fix My Prompt</button>
                      <button className="btn ghost" style={{ marginLeft: 'auto', color: '#f4a574' }}>Open in Expert Mode →</button>
                    </div>
                  </div>
                </div>

                {/* AI Result card */}
                <div className="ai">
                  <div className="ai-h">
                    <div className="ai-tag">AI Result · gpt-4o</div>
                    <div className="ai-meta">1.4s · 412 tokens</div>
                  </div>
                  <div className="ai-body">
                    <p><strong>Hook (0–3s):</strong> Tight close-up — sweat on a wrist, watch glowing. VO: "Three minutes. That's all it took to know I'd stopped guessing."</p>
                    <p><strong>Problem (3–8s):</strong> Quick cuts — late-night work, missed workouts, skipped meals. On-screen: "Busy ≠ Broken." …</p>
                  </div>
                  <div className="ai-actions">
                    <button className="btn">Improve Result</button>
                    <button className="btn">Save</button>
                    <button className="btn" style={{ color: '#f4a574', borderColor: 'rgba(229,124,74,0.4)' }}>✦ Make Master Plan</button>
                  </div>
                </div>
              </div>

              {/* Composer */}
              <div className="composer-wrap">
                <div className="composer-shell">
                  <div className="composer">
                    <div className="composer-text">Ask PromptMeGood what you want to create…</div>
                    <div className="composer-bar">
                      <div className="composer-bar-l">
                        <span className="chip">🎙 Voice</span>
                        <span className="chip">✦ Help Me Start</span>
                        <span className="chip">📎 Add File</span>
                        <span className="chip">⚙ Tune</span>
                      </div>
                      <button className="btn primary">Fix My Prompt →</button>
                    </div>
                  </div>
                </div>
                <div className="composer-hint">Press ⌘K for commands · ⌘↵ to send · Local-first, no login required</div>
              </div>
            </section>

            {/* === RIGHT TOOLS === */}
            <aside className="tools">
              <div className="tools-h">
                <div>
                  <div className="t">Tool Panel</div>
                  <div className="sub">Context · Prompt Engine</div>
                </div>
                <div className="ico" style={{ width: 26, height: 26, fontSize: 12 }}>⤢</div>
              </div>

              {/* Master Link */}
              <div className="ml-toggle">
                <div className="ml-l">
                  <div className="lab">⛓ Master Link</div>
                  <div className="desc">Combine Prompt + Photography</div>
                </div>
                <div className="switch" />
              </div>

              {/* Photography Suite */}
              <div className="photo">
                <div className="photo-h">
                  <div className="t">📷 Photography Suite</div>
                  <span className="surprise">⚡ Surprise Me</span>
                </div>
                <div className="acc open">
                  <span className="nm">Style</span>
                  <span className="ct">3 picked <span className="car">▾</span></span>
                </div>
                <div className="pills">
                  <span className="pl on">Editorial</span>
                  <span className="pl on">Cinematic</span>
                  <span className="pl on">Film grain</span>
                  <span className="pl">Polaroid</span>
                  <span className="pl">Studio</span>
                </div>
                <div className="acc"><span className="nm">Camera &amp; Lens</span><span className="ct">35mm <span className="car">▸</span></span></div>
                <div className="acc"><span className="nm">Lighting &amp; Mood</span><span className="ct">Golden hour <span className="car">▸</span></span></div>
                <div className="acc"><span className="nm">Composition</span><span className="ct">— <span className="car">▸</span></span></div>
                <div className="acc"><span className="nm">Color Palette</span><span className="ct">Warm <span className="car">▸</span></span></div>
              </div>

              <div className="gen-img">Send to Image Generator <span className="arrow">→</span></div>

              {/* Master Plan */}
              <div className="mp">
                <div className="mp-h">✦ Master Actionable Plan <span className="badge">PRO</span></div>
                <div className="mp-row"><div className="ck" /> The Narrative</div>
                <div className="mp-row"><div className="ck" /> Technical Brief</div>
                <div className="mp-row"><div className="ck" /> AI Execution</div>
                <button className="mp-btn">Generate Master Plan →</button>
              </div>
            </aside>
          </div>

          {/* STATUS BAR */}
          <div className="statusbar">
            <div className="l">
              <span>● Saved locally</span>
              <span>28 in Vault</span>
              <span>4 templates</span>
            </div>
            <div>v2 chassis · no popups · no forced login</div>
          </div>
        </div>
      </div>
    </>
  );
}
