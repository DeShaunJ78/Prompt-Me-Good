export function MasterPlanWorkspace() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .mpw { font-family: Inter, -apple-system, sans-serif; background: #1a1410; color: #f0e8d8; min-height: 1200px; position: relative; overflow: hidden; }
        .mpw::before { content:''; position:absolute; top:-280px; left:50%; transform:translateX(-50%); width:1500px; height:760px; background: radial-gradient(ellipse, rgba(229,124,74,0.10), transparent 70%); pointer-events:none; }
        .mpw::after { content:''; position:absolute; inset:0; background-image: linear-gradient(rgba(240,232,216,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(240,232,216,0.012) 1px, transparent 1px); background-size: 60px 60px; pointer-events:none; }
        .mpw-in { position: relative; z-index: 1; }

        /* Top bar */
        .tb { display:flex; align-items:center; justify-content:space-between; padding:14px 26px; border-bottom:1px solid rgba(240,232,216,0.06); }
        .tb-l { display:flex; align-items:center; gap:14px; }
        .brand { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:600; }
        .brand-dot { width:24px; height:24px; border-radius:7px; background: linear-gradient(135deg, #e57c4a, #f4a574); box-shadow: 0 4px 14px rgba(229,124,74,0.3); }
        .vbar { width:1px; height:18px; background: rgba(240,232,216,0.1); }
        .crumb { font-family:'JetBrains Mono', monospace; font-size:11px; color: rgba(240,232,216,0.5); letter-spacing:0.04em; }
        .crumb b { color:#f4a574; font-weight:500; }
        .power-badge { font-family:'JetBrains Mono',monospace; font-size:10px; padding:4px 10px; background: linear-gradient(135deg, rgba(229,124,74,0.25), rgba(244,165,116,0.15)); border:1px solid rgba(229,124,74,0.5); color:#f4a574; border-radius:5px; letter-spacing:0.14em; text-transform:uppercase; font-weight:600; }
        .tb-r { display:flex; align-items:center; gap:10px; }
        .ico { width:32px; height:32px; border-radius:8px; background: rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.06); display:flex; align-items:center; justify-content:center; color: rgba(240,232,216,0.6); font-size:14px; cursor:pointer; }
        .tpl-pick-top { display:inline-flex; align-items:center; gap:10px; padding: 6px 12px; background: rgba(229,124,74,0.06); border:1px solid rgba(229,124,74,0.25); border-radius:8px; cursor:pointer; }
        .tpl-pick-top .lab { font-family:'JetBrains Mono',monospace; font-size:9.5px; color: rgba(244,165,116,0.7); letter-spacing:0.12em; text-transform:uppercase; }
        .tpl-pick-top .nm { font-size:13px; font-weight:600; color:#f0e8d8; }
        .av { width:30px; height:30px; border-radius:50%; background: linear-gradient(135deg, #e57c4a, #f4a574); font-size:12px; display:flex; align-items:center; justify-content:center; color:#1a1410; font-weight:700; }

        /* Main 3-pane body */
        .app-body { display:grid; grid-template-columns: 60px 1fr 1fr 1.05fr; min-height: 1140px; }

        /* Mini icon rail */
        .mini-rail { border-right:1px solid rgba(240,232,216,0.06); padding: 18px 0; display:flex; flex-direction:column; align-items:center; gap: 8px; }
        .mr-icon { width:38px; height:38px; border-radius:9px; display:flex; align-items:center; justify-content:center; font-size:16px; color: rgba(240,232,216,0.5); cursor:pointer; }
        .mr-icon.active { background: rgba(229,124,74,0.15); color:#f4a574; box-shadow: inset 0 0 0 1px rgba(229,124,74,0.35); }
        .mr-icon:hover:not(.active) { background: rgba(240,232,216,0.04); color:#f0e8d8; }
        .mr-lab { font-size:9px; font-family:'JetBrains Mono',monospace; color: rgba(240,232,216,0.4); letter-spacing:0.08em; text-transform:uppercase; margin-top:-4px; margin-bottom:4px; }

        /* Pane shell */
        .pane { padding: 20px 22px 24px; border-right:1px solid rgba(240,232,216,0.05); display:flex; flex-direction:column; gap: 16px; position:relative; }
        .pane:last-child { border-right:none; }
        .pane-h { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .pane-num { font-family:'JetBrains Mono',monospace; font-size:11px; color:#f4a574; letter-spacing:0.14em; }
        .pane-t { font-size:16px; font-weight:600; margin-top:2px; }
        .pane-sub { font-size:12px; color: rgba(240,232,216,0.55); margin-top:3px; }

        /* Form fields shared */
        .fld { display:flex; flex-direction:column; gap:6px; }
        .fld-lab { font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:0.14em; text-transform:uppercase; color: rgba(240,232,216,0.5); }
        .fld-input { padding: 10px 12px; background: rgba(240,232,216,0.03); border:1px solid rgba(240,232,216,0.08); border-radius:8px; font-size:13px; color: #f0e8d8; line-height:1.5; min-height: 38px; }
        .fld-input.tall { min-height: 130px; }
        .fld-input.tall.placeholder { color: rgba(240,232,216,0.5); }
        .fld-meta { font-family:'JetBrains Mono',monospace; font-size:9.5px; color: rgba(240,232,216,0.4); align-self:flex-end; }

        /* Pill row */
        .enhance { display:flex; flex-wrap:wrap; gap:6px; }
        .epill { font-size:11.5px; padding:5px 11px; border-radius:14px; background: rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.08); color: rgba(240,232,216,0.7); cursor:pointer; display:inline-flex; gap:6px; align-items:center; }
        .epill.on { background: rgba(229,124,74,0.15); color:#f4a574; border-color: rgba(229,124,74,0.4); }

        /* Settings rows (Pane 2) */
        .settings-h { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color: rgba(240,232,216,0.5); display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
        .settings-h .reset { color:#f4a574; cursor:pointer; font-size:10px; }
        .settings-grp { background: rgba(240,232,216,0.025); border:1px solid rgba(240,232,216,0.06); border-radius:10px; padding: 12px 14px; }
        .row { display:flex; align-items:center; justify-content:space-between; padding: 9px 0; border-bottom: 1px solid rgba(240,232,216,0.05); }
        .row:last-child { border-bottom:none; }
        .row .l { display:flex; align-items:center; gap:10px; font-size:12.5px; color: rgba(240,232,216,0.85); }
        .row .ic { width:18px; height:18px; border-radius:5px; background: rgba(229,124,74,0.18); border: 1px solid rgba(229,124,74,0.3); display:flex; align-items:center; justify-content:center; font-size:10px; color:#f4a574; }
        .row .v { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:#f0e8d8; font-weight:500; padding:4px 10px; border-radius:6px; background: rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.07); cursor:pointer; }
        .row .v .car { color: rgba(240,232,216,0.5); font-size:9px; }

        /* Master Link gutter (between pane 1 and 2) */
        .ml-bridge { position:absolute; top:50%; right:-26px; transform:translateY(-50%); z-index:2; display:flex; flex-direction:column; align-items:center; gap:6px; }
        .ml-bridge .ring { width:52px; height:52px; border-radius:50%; background: radial-gradient(circle, rgba(229,124,74,0.35), rgba(229,124,74,0.08) 70%); border: 1.5px solid rgba(229,124,74,0.5); display:flex; align-items:center; justify-content:center; font-size:22px; color:#f4a574; box-shadow: 0 0 24px rgba(229,124,74,0.4), inset 0 0 12px rgba(229,124,74,0.25); }
        .ml-bridge .lab { font-family:'JetBrains Mono',monospace; font-size:8.5px; letter-spacing:0.18em; color:#f4a574; text-transform:uppercase; white-space:nowrap; opacity: 0.8; }

        /* Master Link active strip (bottom of pane 2) */
        .ml-strip { display:flex; align-items:center; justify-content:center; gap:10px; padding: 12px 14px; background: linear-gradient(135deg, rgba(229,124,74,0.12), rgba(244,165,116,0.05)); border: 1px solid rgba(229,124,74,0.35); border-radius:10px; margin-top: auto; }
        .ml-strip .ico-glow { color:#f4a574; font-size:14px; }
        .ml-strip .txt { font-family:'JetBrains Mono',monospace; font-size:10.5px; letter-spacing:0.14em; color:#f4a574; text-transform:uppercase; font-weight:600; }
        .ml-strip .desc { font-size:11px; color: rgba(240,232,216,0.65); margin-top:2px; }

        /* Right pane: Master Brief */
        .brief { background: rgba(240,232,216,0.025); border:1px solid rgba(240,232,216,0.07); border-radius: 14px; padding: 18px 20px; display:flex; flex-direction:column; gap:14px; }
        .brief-title { font-size:18px; font-weight:700; text-align:center; padding-bottom: 12px; border-bottom: 1px solid rgba(240,232,216,0.07); letter-spacing:-0.01em; }
        .brief-sec { display:flex; flex-direction:column; gap:6px; }
        .brief-sec .h { display:flex; align-items:center; gap:8px; font-family:'JetBrains Mono',monospace; font-size:10.5px; letter-spacing:0.14em; text-transform:uppercase; color:#f4a574; font-weight:600; }
        .brief-sec .h .ico-sm { width:14px; height:14px; }
        .brief-sec .body { font-size:12.5px; line-height:1.55; color: rgba(240,232,216,0.85); }
        .brief-table { display:grid; grid-template-columns: 1fr 1fr; gap: 4px 14px; font-size:12px; }
        .brief-table .k { color: rgba(240,232,216,0.6); }
        .brief-table .v { color: #f0e8d8; font-weight:500; }
        .pro-tip { background: rgba(229,124,74,0.06); border: 1px dashed rgba(229,124,74,0.35); border-radius: 9px; padding: 10px 13px; display:flex; gap:10px; align-items:flex-start; }
        .pro-tip .star { color:#f4a574; font-size:13px; }
        .pro-tip .l { font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:0.14em; text-transform:uppercase; color:#f4a574; font-weight:600; }
        .pro-tip .b { font-size:11.5px; color: rgba(240,232,216,0.78); margin-top:3px; line-height:1.5; }

        /* Pane action bar */
        .act-bar { display:flex; gap:8px; flex-wrap:wrap; padding-top:12px; border-top: 1px solid rgba(240,232,216,0.06); }
        .btn { font-size:12.5px; padding:9px 14px; border-radius:8px; cursor:pointer; font-weight:500; border:1px solid rgba(240,232,216,0.1); background: rgba(240,232,216,0.04); color:#f0e8d8; display:inline-flex; gap:7px; align-items:center; }
        .btn:hover { background: rgba(240,232,216,0.07); }
        .btn.primary { background: linear-gradient(135deg,#e57c4a,#f4a574); border-color: transparent; color:#1a1410; font-weight:600; box-shadow: 0 4px 14px rgba(229,124,74,0.3); }
        .btn.outline { background: transparent; border-color: rgba(229,124,74,0.4); color:#f4a574; }
        .send-row { display:flex; flex-wrap:wrap; gap:5px; padding-top:10px; }
        .send-pill { font-size:11px; padding:5px 10px; border-radius:6px; background: rgba(240,232,216,0.03); border:1px solid rgba(240,232,216,0.08); color: rgba(240,232,216,0.7); cursor:pointer; }
        .send-pill:hover { color:#f4a574; border-color: rgba(229,124,74,0.4); }
        .send-lab { font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:0.14em; text-transform:uppercase; color: rgba(240,232,216,0.4); display:flex; align-items:center; }

        /* Status footer */
        .statusbar { padding: 9px 26px; border-top: 1px solid rgba(240,232,216,0.05); display:flex; justify-content:space-between; align-items:center; font-family:'JetBrains Mono',monospace; font-size:10px; color: rgba(240,232,216,0.4); letter-spacing:0.06em; }
        .statusbar .l { display:flex; gap:14px; }
        .statusbar .l span b { color:#f4a574; font-weight:500; }
      `}</style>
      <div className="mpw">
        <div className="mpw-in">
          {/* TOP BAR */}
          <div className="tb">
            <div className="tb-l">
              <div className="brand">
                <div className="brand-dot" />
                <span>PromptMeGood</span>
              </div>
              <div className="vbar" />
              <div className="crumb">/<b>app</b>/<b>master-plan</b></div>
              <span className="power-badge">⚡ Power Mode</span>
            </div>
            <div className="tb-r">
              <div className="tpl-pick-top">
                <div>
                  <div className="lab">Template</div>
                  <div className="nm">Portrait Photography</div>
                </div>
                <span style={{ color: '#f4a574', fontSize: 11 }}>▾</span>
              </div>
              <div className="ico" title="Theme">☀</div>
              <div className="ico" title="Notifications">🔔</div>
              <div className="av">U</div>
            </div>
          </div>

          {/* BODY */}
          <div className="app-body">
            {/* Mini icon rail (Vault, Inspiration, etc.) */}
            <aside className="mini-rail">
              <div className="mr-icon active" title="Master Plan">▦</div>
              <div className="mr-lab">Plan</div>
              <div className="mr-icon" title="Inspiration">💡</div>
              <div className="mr-icon" title="Vault">📚</div>
              <div className="mr-icon" title="Presets">⚙</div>
              <div className="mr-icon" title="History">🕓</div>
              <div style={{ flex: 1 }} />
              <div className="mr-icon" title="Collapse">‹</div>
            </aside>

            {/* PANE 01: Prompt Engine (Soul) */}
            <section className="pane">
              <div className="pane-h">
                <div>
                  <div className="pane-num">01 — THE SOUL</div>
                  <div className="pane-t">Prompt Engine</div>
                  <div className="pane-sub">Craft the vision. Be specific.</div>
                </div>
              </div>

              <div className="fld">
                <div className="fld-lab">Composer · Subject &amp; Goal</div>
                <div className="fld-input tall">
                  A confident woman in her 30s, editorial portrait, soft natural window light, neutral beige backdrop, wearing a cream blazer, looking slightly off-camera, calm and empowered expression.
                </div>
                <div className="fld-meta">186 / 600</div>
              </div>

              <div className="fld">
                <div className="fld-lab">Enhance with</div>
                <div className="enhance">
                  <span className="epill on">😊 Emotion</span>
                  <span className="epill on">📖 Story</span>
                  <span className="epill on">🪨 Texture</span>
                  <span className="epill on">🌫 Atmosphere</span>
                  <span className="epill">🎯 Tension</span>
                  <span className="epill">+ Custom</span>
                </div>
              </div>

              <div className="fld">
                <div className="fld-lab">Audience</div>
                <div className="fld-input">Personal branding clients · creative professionals</div>
              </div>

              <div className="fld">
                <div className="fld-lab">Tone &amp; Voice</div>
                <div className="fld-input">Inspiring, confident, modern, approachable</div>
              </div>

              <div className="fld">
                <div className="fld-lab">Negative Prompt — avoid</div>
                <div className="fld-input">blurry, low quality, overexposed, harsh shadows, distorted face, extra limbs, watermark, text</div>
                <div className="fld-meta">88 / 300</div>
              </div>

              <div className="act-bar">
                <button className="btn">↺ Reset</button>
                <button className="btn primary" style={{ marginLeft: 'auto' }}>✦ Refine Prompt</button>
              </div>

              {/* Bridge to Pane 02 */}
              <div className="ml-bridge">
                <div className="ring">⛓</div>
              </div>
            </section>

            {/* PANE 02: Photography Suite (Body) */}
            <section className="pane">
              <div className="pane-h">
                <div>
                  <div className="pane-num">02 — THE BODY</div>
                  <div className="pane-t">Photography Suite</div>
                  <div className="pane-sub">Set the parameters. Control the craft.</div>
                </div>
              </div>

              <div>
                <div className="settings-h"><span>Camera Settings</span><span className="reset">Reset all</span></div>
                <div className="settings-grp">
                  <div className="row">
                    <div className="l"><span className="ic">⊙</span> Aperture</div>
                    <div className="v">f/2.8 <span className="car">▾</span></div>
                  </div>
                  <div className="row">
                    <div className="l"><span className="ic">⏱</span> Shutter Speed</div>
                    <div className="v">1/125 <span className="car">▾</span></div>
                  </div>
                  <div className="row">
                    <div className="l"><span className="ic">◐</span> ISO</div>
                    <div className="v">100 <span className="car">▾</span></div>
                  </div>
                  <div className="row">
                    <div className="l"><span className="ic">▭</span> Focal Length</div>
                    <div className="v">85mm <span className="car">▾</span></div>
                  </div>
                  <div className="row">
                    <div className="l"><span className="ic">☼</span> White Balance</div>
                    <div className="v">5600K <span className="car">▾</span></div>
                  </div>
                  <div className="row">
                    <div className="l"><span className="ic">⊕</span> Focus</div>
                    <div className="v">Single Point <span className="car">▾</span></div>
                  </div>
                  <div className="row">
                    <div className="l"><span className="ic">▢</span> Format</div>
                    <div className="v">RAW <span className="car">▾</span></div>
                  </div>
                  <div className="row">
                    <div className="l"><span className="ic">🎞</span> Film Stock</div>
                    <div className="v">Kodak Portra 400 <span className="car">▾</span></div>
                  </div>
                </div>
              </div>

              <div>
                <div className="settings-h"><span>Light &amp; Scene</span></div>
                <div className="settings-grp">
                  <div className="row">
                    <div className="l"><span className="ic">☀</span> Lighting</div>
                    <div className="v">Window Light <span className="car">▾</span></div>
                  </div>
                  <div className="row">
                    <div className="l"><span className="ic">🕓</span> Time of Day</div>
                    <div className="v">Morning <span className="car">▾</span></div>
                  </div>
                  <div className="row">
                    <div className="l"><span className="ic">♥</span> Mood</div>
                    <div className="v">Calm &amp; Empowered <span className="car">▾</span></div>
                  </div>
                  <div className="row">
                    <div className="l"><span className="ic">▦</span> Background</div>
                    <div className="v">Neutral Beige <span className="car">▾</span></div>
                  </div>
                </div>
              </div>

              <div className="ml-strip">
                <div>
                  <div className="txt">⛓ Master Link Active</div>
                  <div className="desc">Your vision is connected. Every detail matters.</div>
                </div>
              </div>
            </section>

            {/* PANE 03: Master Actionable Plan */}
            <section className="pane">
              <div className="pane-h">
                <div>
                  <div className="pane-num">03 — THE OUTPUT</div>
                  <div className="pane-t">Master Actionable Plan</div>
                  <div className="pane-sub">Your complete, executable creative brief.</div>
                </div>
                <button className="btn outline">⬇ Export</button>
              </div>

              <div className="brief">
                <div className="brief-title">Portrait Photography Brief</div>

                <div className="brief-sec">
                  <div className="h">✦ The Narrative</div>
                  <div className="body">A confident woman in her 30s, editorial portrait, soft natural window light, neutral beige backdrop, wearing a cream blazer, looking slightly off-camera, calm and empowered expression. Aimed at personal branding clients who value confidence, clarity, and authenticity.</div>
                </div>

                <div className="brief-sec">
                  <div className="h">⚙ Technical Brief</div>
                  <div className="brief-table">
                    <span className="k">Aperture</span><span className="v">f/2.8</span>
                    <span className="k">Shutter Speed</span><span className="v">1/125s</span>
                    <span className="k">ISO</span><span className="v">100</span>
                    <span className="k">Focal Length</span><span className="v">85mm</span>
                    <span className="k">White Balance</span><span className="v">5600K</span>
                    <span className="k">Film Stock</span><span className="v">Kodak Portra 400</span>
                    <span className="k">Lighting</span><span className="v">Window light, morning</span>
                    <span className="k">Mood</span><span className="v">Calm &amp; empowered</span>
                    <span className="k">Background</span><span className="v">Neutral beige</span>
                  </div>
                </div>

                <div className="brief-sec">
                  <div className="h">▷ AI Execution</div>
                  <div className="body" style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, background: 'rgba(240,232,216,0.03)', padding: '10px 12px', borderRadius: 7, lineHeight: 1.55 }}>
                    Editorial portrait of a confident woman in her 30s, cream blazer, neutral beige backdrop, soft window light morning mood, calm empowered expression, 85mm lens, f/2.8 shallow depth of field, 1/125s, ISO 100, Kodak Portra 400 film grade, Single Point focus, RAW capture aesthetic <span style={{ color: '#f4a574' }}>--ar 4:5 --v 6.0 --style raw</span>
                  </div>
                </div>

                <div className="pro-tip">
                  <span className="star">✦</span>
                  <div>
                    <div className="l">Pro Tip</div>
                    <div className="b">Shoot tethered for precision. Review focus on eyes at 100%. Leave space at top for subtle crop.</div>
                  </div>
                </div>
              </div>

              {/* Action bar */}
              <div className="act-bar">
                <button className="btn primary">📋 Copy Brief</button>
                <button className="btn">💾 Save to Vault</button>
                <button className="btn">↩ Commit to Conversation</button>
                <button className="btn">▷ Run with AI</button>
              </div>
              <div className="send-row">
                <span className="send-lab">Send to:</span>
                <span className="send-pill">ChatGPT</span>
                <span className="send-pill">Claude</span>
                <span className="send-pill">Midjourney</span>
                <span className="send-pill">Sora</span>
                <span className="send-pill">Runway</span>
                <span className="send-pill">DALL·E</span>
                <span className="send-pill">Gemini</span>
              </div>
            </section>
          </div>

          {/* STATUS BAR */}
          <div className="statusbar">
            <div className="l">
              <span>● <b>Master Link engaged</b></span>
              <span>Soul + Body unified</span>
              <span>28 in Vault</span>
            </div>
            <div>Power Mode · ⌘↵ Generate · Esc to return to chat</div>
          </div>
        </div>
      </div>
    </>
  );
}
