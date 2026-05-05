export function WorkstationChassisV3() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .ws { font-family: Inter, -apple-system, sans-serif; background: #1a1410; color: #f0e8d8; min-height: 1500px; position: relative; overflow: hidden; }
        .ws::before { content:''; position:absolute; top:-280px; left:50%; transform:translateX(-50%); width:1500px; height:760px; background: radial-gradient(ellipse, rgba(229,124,74,0.10), transparent 70%); pointer-events:none; }
        .ws::after { content:''; position:absolute; inset:0; background-image: linear-gradient(rgba(240,232,216,0.012) 1px, transparent 1px), linear-gradient(90deg, rgba(240,232,216,0.012) 1px, transparent 1px); background-size: 60px 60px; pointer-events:none; }
        .ws-in { position: relative; z-index: 1; }

        /* TOP BAR */
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

        /* GRID — center column slimmer to make room for the chain gutter */
        .app-body { display:grid; grid-template-columns: 230px 1fr 36px 320px; min-height: 1420px; position:relative; }

        /* LEFT RAIL */
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
        .swatches { display:flex; gap:5px; }
        .sw { width:14px; height:14px; border-radius:50%; }
        .sw1 { background: #e57c4a; box-shadow: 0 0 0 2px rgba(229,124,74,0.3); }
        .sw2 { background: #4ac6e5; }
        .sw3 { background: #a574f4; }
        .sw4 { background: #f4d574; }

        /* MAIN COLUMN */
        .main { display:flex; flex-direction:column; min-height: 1420px; }
        .mode-bar { display:flex; align-items:center; justify-content:space-between; padding: 18px 28px 12px; gap: 14px; }
        .tpl-picker { display:inline-flex; align-items:center; gap:10px; padding: 8px 14px; background: rgba(229,124,74,0.08); border:1px solid rgba(229,124,74,0.32); border-radius:9px; cursor:pointer; min-width: 340px; }
        .tpl-picker .tp-lab { font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:0.14em; text-transform:uppercase; color: rgba(244,165,116,0.7); }
        .tpl-picker .tp-name { font-size:13.5px; font-weight:600; color:#f0e8d8; margin-top:1px; }
        .tpl-picker .tp-meta { font-family:'JetBrains Mono',monospace; font-size:10px; color: rgba(240,232,216,0.5); margin-left:auto; }
        .tpl-picker .car { color:#f4a574; font-size:11px; margin-left:6px; }
        .session-meta { display:flex; gap:8px; }
        .pill { font-family:'JetBrains Mono', monospace; font-size:10.5px; padding: 4px 10px; background: rgba(240,232,216,0.05); border:1px solid rgba(240,232,216,0.08); border-radius:5px; color: rgba(240,232,216,0.7); letter-spacing:0.06em; text-transform:uppercase; }
        .pill.live { color:#f4a574; border-color: rgba(229,124,74,0.4); background: rgba(229,124,74,0.08); }
        .pill.live::before { content:''; display:inline-block; width:5px; height:5px; background:#e57c4a; border-radius:50%; margin-right:6px; vertical-align:1px; box-shadow: 0 0 6px #e57c4a; }
        .pill.linked { color:#f4a574; border-color: rgba(229,124,74,0.55); background: rgba(229,124,74,0.14); }

        .thread { padding: 0 28px 12px; flex:1; display:flex; flex-direction:column; gap: 18px; }

        /* user bubble */
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
        .btn.linked { background: linear-gradient(135deg, rgba(229,124,74,0.25), rgba(244,165,116,0.18)); border:1px solid rgba(229,124,74,0.55); color:#f4a574; font-weight:600; }

        /* Synergy chip on prompt card */
        .syn-chip { display:inline-flex; align-items:center; gap:7px; margin-top:10px; padding:6px 11px; background: rgba(229,124,74,0.1); border:1px solid rgba(229,124,74,0.35); border-radius:6px; font-size:11.5px; color:#f4a574; font-family:'JetBrains Mono',monospace; letter-spacing:0.04em; }
        .syn-chip .dot { width:6px; height:6px; border-radius:50%; background:#e57c4a; box-shadow: 0 0 8px #e57c4a; }

        /* Send-to row — branded but muted */
        .sendto { margin-top: 12px; padding-top:12px; border-top:1px dashed rgba(240,232,216,0.07); }
        .sendto-grp { display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:6px; }
        .sendto-lab { font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:0.14em; text-transform:uppercase; color: rgba(240,232,216,0.45); margin-right:6px; }
        .sendto-lab.active { color:#f4a574; }
        .sb { display:inline-flex; align-items:center; gap:7px; font-size:11.5px; padding:6px 11px; background: rgba(240,232,216,0.03); border:1px solid rgba(240,232,216,0.09); border-left-width:2px; border-radius:6px; color: rgba(240,232,216,0.8); cursor:pointer; }
        .sb:hover { background: rgba(229,124,74,0.06); border-color: rgba(229,124,74,0.4); }
        .sb .bd { width:7px; height:7px; border-radius:50%; }
        .sb-chatgpt { border-left-color:#10a37f; } .sb-chatgpt .bd { background:#10a37f; }
        .sb-claude { border-left-color:#cc785c; } .sb-claude .bd { background:#cc785c; }
        .sb-gemini { border-left-color:#4285f4; } .sb-gemini .bd { background:#4285f4; }
        .sb-perplexity { border-left-color:#1f9b8e; } .sb-perplexity .bd { background:#1f9b8e; }
        .sb-mj { border-left-color:#7a7aff; } .sb-mj .bd { background:#7a7aff; }
        .sb-dalle { border-left-color:#10a37f; } .sb-dalle .bd { background:#10a37f; }
        .sb-sd { border-left-color:#ffcc00; } .sb-sd .bd { background:#ffcc00; }
        .sb-sora { border-left-color:#ffffff; } .sb-sora .bd { background:#ffffff; }
        .sb-runway { border-left-color:#00ff88; } .sb-runway .bd { background:#00ff88; }
        .sendto-grp.dim .sb { opacity: 0.5; }

        /* === MASTER PLAN CARD with Visual Companion carousel === */
        .mp-card-shell { padding:1.5px; border-radius:16px; background: linear-gradient(135deg, #e57c4a, rgba(244,165,116,0.4) 40%, rgba(229,124,74,0.7)); }
        .mp-card { background: linear-gradient(180deg, #2a1f17, #231b15); border-radius:14.5px; padding: 22px; }
        .mp-card-h { display:flex; align-items:center; justify-content:space-between; margin-bottom: 18px; padding-bottom:14px; border-bottom:1px solid rgba(229,124,74,0.18); }
        .mp-card-h-l { display:flex; align-items:center; gap:12px; }
        .mp-icon { width:38px; height:38px; border-radius:10px; background: linear-gradient(135deg, rgba(229,124,74,0.3), rgba(244,165,116,0.18)); border:1px solid rgba(229,124,74,0.5); display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow: 0 0 18px rgba(229,124,74,0.35); }
        .mp-card-h .tag { font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:0.18em; text-transform:uppercase; color: rgba(244,165,116,0.85); }
        .mp-card-h .ttl { font-size:18px; font-weight:700; letter-spacing:-0.01em; margin-top:2px; }
        .mp-meta { display:flex; gap:6px; }

        .mp-sec { margin-bottom:18px; }
        .mp-sec-h { display:flex; align-items:center; gap:9px; margin-bottom:8px; }
        .mp-sec-num { font-family:'JetBrains Mono',monospace; font-size:10px; padding:3px 7px; border-radius:4px; background: rgba(229,124,74,0.18); color:#f4a574; letter-spacing:0.1em; }
        .mp-sec-t { font-size:13.5px; font-weight:600; color:#f0e8d8; }
        .mp-sec-body { font-size:13px; line-height:1.6; color: rgba(240,232,216,0.85); padding-left:4px; }

        /* Sources subsection */
        .sources { display:flex; flex-wrap:wrap; gap:6px; margin-top:8px; }
        .src { font-size:10.5px; padding:4px 9px; background: rgba(31,155,142,0.12); border:1px solid rgba(31,155,142,0.4); border-radius:5px; color:#5fd4c4; font-family:'JetBrains Mono',monospace; }

        /* Visual Companion carousel */
        .vc { display:flex; gap:11px; overflow-x:auto; padding: 4px 2px 8px; }
        .vc-card { flex: 0 0 200px; background: #1a1410; border:1px solid rgba(229,124,74,0.25); border-radius:10px; overflow:hidden; }
        .vc-thumb { height:108px; position:relative; display:flex; align-items:flex-end; padding:8px 10px; }
        .vc-thumb .scn { font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:0.14em; text-transform:uppercase; color:#f0e8d8; background: rgba(0,0,0,0.55); padding:3px 7px; border-radius:4px; }
        .vc-t1 { background: linear-gradient(135deg, #f4a574, #c44d1a); }
        .vc-t2 { background: linear-gradient(135deg, #4a7cb8, #2a3d6b); }
        .vc-t3 { background: linear-gradient(135deg, #d8b878, #8a6432); }
        .vc-t4 { background: linear-gradient(135deg, #8a3d3d, #4a1a1a); }
        .vc-t5 { background: linear-gradient(135deg, #4a8c5e, #1a3d2a); }
        .vc-body { padding: 10px 11px; }
        .vc-title { font-size:12.5px; font-weight:600; color:#f0e8d8; }
        .vc-prompt { font-size:11px; color: rgba(240,232,216,0.6); margin-top:5px; line-height:1.4; height: 30px; overflow:hidden; }
        .vc-acts { display:flex; gap:5px; margin-top:9px; }
        .vc-act { flex:1; font-size:10.5px; padding:5px 7px; background: rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.08); border-radius:5px; color: rgba(240,232,216,0.75); text-align:center; cursor:pointer; }
        .vc-act.send { color:#7a7aff; border-color: rgba(122,122,255,0.35); }

        /* Master Plan footer actions */
        .mp-foot { display:flex; gap:8px; margin-top:14px; padding-top:14px; border-top:1px solid rgba(229,124,74,0.18); flex-wrap:wrap; }

        /* AI Result card */
        .ai { background: rgba(240,232,216,0.025); border:1px solid rgba(240,232,216,0.07); border-radius: 12px; padding: 16px 18px; }
        .ai-h { display:flex; justify-content:space-between; margin-bottom: 10px; align-items:center; }
        .ai-tag { display:inline-flex; align-items:center; gap:7px; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; color: rgba(240,232,216,0.55); }
        .ai-tag::before { content:''; width:6px; height:6px; background:#4ade80; border-radius:50%; box-shadow: 0 0 6px #4ade80; }
        .ai-meta { font-family:'JetBrains Mono',monospace; font-size:10px; color: rgba(240,232,216,0.4); }
        .ai-body { font-size:13.5px; line-height:1.6; color: rgba(240,232,216,0.85); }

        /* Composer */
        .composer-wrap { padding: 0 28px 22px; }
        .composer-shell { padding:1px; border-radius:14px; background: linear-gradient(135deg, rgba(229,124,74,0.35), rgba(240,232,216,0.05)); }
        .composer { background: #1f1813; border-radius: 13px; padding: 14px 16px; }
        .composer-text { font-size:14px; color: rgba(240,232,216,0.45); padding: 8px 4px; min-height: 44px; }
        .composer-bar { display:flex; align-items:center; justify-content:space-between; padding-top:10px; border-top:1px solid rgba(240,232,216,0.05); }
        .composer-bar-l { display:flex; gap:6px; }
        .chip { font-size:11.5px; padding:5px 10px; border-radius:6px; border:1px solid rgba(240,232,216,0.08); color: rgba(240,232,216,0.65); cursor:pointer; display:inline-flex; gap:6px; align-items:center; background: rgba(240,232,216,0.02); }
        .chip:hover { color:#f4a574; border-color: rgba(229,124,74,0.3); }

        /* Master Brief preview line under composer */
        .brief-preview { display:flex; align-items:center; gap:10px; margin-top:10px; padding: 8px 12px; background: rgba(229,124,74,0.06); border:1px dashed rgba(229,124,74,0.3); border-radius:7px; font-family:'JetBrains Mono',monospace; font-size:10.5px; color:#f4a574; letter-spacing:0.04em; }
        .brief-preview .bp-i { font-size:13px; }

        /* === CHAIN BRIDGE GUTTER === */
        .chain-gutter { position:relative; border-left:1px dashed rgba(229,124,74,0.18); border-right:1px dashed rgba(229,124,74,0.18); display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 30px 0; }
        .chain-spine { position:absolute; top: 60px; bottom: 60px; width:2px; background: linear-gradient(180deg, rgba(229,124,74,0.0), rgba(229,124,74,0.5) 12%, rgba(229,124,74,0.5) 88%, rgba(229,124,74,0.0)); }
        .chain-link { width:18px; height:26px; border:2px solid #f4a574; border-radius:9px; position:relative; z-index:1; box-shadow: 0 0 12px rgba(229,124,74,0.55), inset 0 0 6px rgba(229,124,74,0.4); animation: pulse 2.2s ease-in-out infinite; background: rgba(26,20,16,0.8); }
        .chain-link + .chain-link { margin-top:-9px; transform: rotate(90deg); }
        .chain-stack { display:flex; flex-direction:column; align-items:center; }
        @keyframes pulse { 0%,100% { box-shadow: 0 0 12px rgba(229,124,74,0.55), inset 0 0 6px rgba(229,124,74,0.4); } 50% { box-shadow: 0 0 22px rgba(244,165,116,0.85), inset 0 0 10px rgba(244,165,116,0.7); } }
        .chain-label { writing-mode: vertical-rl; transform: rotate(180deg); font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:0.22em; text-transform:uppercase; color:#f4a574; padding: 12px 0; }
        .chain-label.top { margin-bottom: 12px; }
        .chain-label.bot { margin-top: 12px; }
        .chain-particles { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); display:flex; gap:3px; }
        .pt { width:3px; height:3px; background:#f4a574; border-radius:50%; box-shadow:0 0 5px #f4a574; opacity:0.7; }

        /* RIGHT PANEL */
        .tools { padding: 18px 16px; display:flex; flex-direction:column; gap: 14px; }
        .tools-h { display:flex; justify-content:space-between; align-items:center; }
        .tools-h .t { font-size:13px; font-weight:600; display:flex; align-items:center; gap:7px; }
        .tools-h .pin { font-size:10px; color:#f4a574; cursor:pointer; padding: 3px 7px; border:1px solid rgba(229,124,74,0.3); border-radius:5px; }
        .tools-h .sub { font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:0.14em; text-transform:uppercase; color: rgba(240,232,216,0.4); margin-top:3px; }

        .ml-card { padding:11px 13px; background: linear-gradient(135deg, rgba(229,124,74,0.14), rgba(244,165,116,0.06)); border:1px solid rgba(229,124,74,0.5); border-radius:10px; box-shadow: 0 0 18px rgba(229,124,74,0.18); }
        .ml-row { display:flex; align-items:center; justify-content:space-between; }
        .ml-row .lab { font-size:12.5px; font-weight:600; color:#f4a574; display:flex; align-items:center; gap:7px; }
        .ml-row .desc { font-size:10.5px; color: rgba(240,232,216,0.55); margin-top:3px; }
        .switch { width:36px; height:20px; background: rgba(229,124,74,0.5); border-radius:10px; position:relative; cursor:pointer; }
        .switch::after { content:''; position:absolute; top:2px; left:18px; width:16px; height:16px; background:#f4a574; border-radius:50%; box-shadow: 0 0 10px rgba(244,165,116,0.7); }
        .ml-status { margin-top:8px; padding-top:8px; border-top:1px dashed rgba(229,124,74,0.2); font-family:'JetBrains Mono',monospace; font-size:9.5px; letter-spacing:0.14em; color:#f4a574; display:flex; align-items:center; gap:6px; }
        .ml-status .d { width:5px; height:5px; border-radius:50%; background:#f4a574; box-shadow:0 0 6px #f4a574; }

        .photo { background: rgba(240,232,216,0.025); border:1px solid rgba(240,232,216,0.06); border-radius:10px; padding: 12px 13px; }
        .photo-h { display:flex; justify-content:space-between; align-items:center; margin-bottom: 10px; }
        .photo-h .t { font-size:12.5px; font-weight:600; display:inline-flex; gap:7px; align-items:center; }
        .photo-h .surprise { font-size:11px; color:#f4a574; cursor:pointer; }
        .acc { padding: 9px 0; border-bottom:1px solid rgba(240,232,216,0.05); display:flex; justify-content:space-between; align-items:center; cursor:pointer; }
        .acc:last-child { border-bottom:none; }
        .acc .nm { font-size:12px; color: rgba(240,232,216,0.75); }
        .acc.open .nm { color:#f4a574; }
        .acc .ct { font-family:'JetBrains Mono', monospace; font-size:9.5px; color: rgba(240,232,216,0.4); letter-spacing:0.06em; }
        .pills { display:flex; flex-wrap:wrap; gap:5px; padding: 8px 0 4px; }
        .pl { font-size:10.5px; padding: 4px 8px; border-radius:5px; background: rgba(240,232,216,0.04); border:1px solid rgba(240,232,216,0.07); color: rgba(240,232,216,0.7); cursor:pointer; }
        .pl.on { background: rgba(229,124,74,0.15); color:#f4a574; border-color: rgba(229,124,74,0.4); }

        .knobs { display:grid; grid-template-columns: 1fr 1fr; gap:6px; padding: 6px 0 2px; }
        .knob { padding: 6px 8px; background: rgba(240,232,216,0.03); border:1px solid rgba(240,232,216,0.07); border-radius:6px; }
        .knob .lab { font-family:'JetBrains Mono',monospace; font-size:9px; letter-spacing:0.12em; color: rgba(240,232,216,0.45); text-transform:uppercase; }
        .knob .val { font-size:11.5px; color:#f4a574; font-weight:600; margin-top:2px; }

        /* status bar */
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
              <div className="crumb">/<span>app</span> · workstation · master link active</div>
            </div>
            <div className="tb-r">
              <span className="kbd">⌘K Search</span>
              <div className="ico">?</div>
              <span className="expert">⚙ Expert Mode</span>
              <div className="av">U</div>
            </div>
          </div>

          <div className="app-body">
            {/* LEFT RAIL */}
            <aside className="rail">
              <button className="new-btn">+ New Prompt</button>
              <div className="rail-h">Local Vault · 28 saved</div>
              <div className="vault-item sel">
                <div className="t">Q3 Nebraska Expansion Brief</div>
                <div className="m">Master Plan · 4 visuals · 12m</div>
              </div>
              <div className="vault-item">
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
                  <div className="swatches">
                    <div className="sw sw1" /><div className="sw sw2" /><div className="sw sw3" /><div className="sw sw4" />
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(240,232,216,0.6)' }}>Theme accent</div>
                </div>
              </div>
            </aside>

            {/* MAIN */}
            <section className="main">
              <div className="mode-bar">
                <div className="tpl-picker">
                  <div>
                    <div className="tp-lab">Template</div>
                    <div className="tp-name">Board Presentation · Q3 Expansion</div>
                  </div>
                  <span className="tp-meta">Text + Visual Companion · 28 templates</span>
                  <span className="car">▾</span>
                </div>
                <div className="session-meta">
                  <span className="pill linked">⛓ Linked</span>
                  <span className="pill live">Session</span>
                </div>
              </div>

              <div className="thread">
                {/* User msg */}
                <div className="u-row">
                  <div className="u-av">U</div>
                  <div className="u-msg">Q3 board presentation about our Nebraska expansion — need a polished script and visuals for each major beat.</div>
                </div>

                {/* Generated Prompt card with synergy chip */}
                <div className="gp-shell">
                  <div className="gp">
                    <div className="gp-h">
                      <div className="gp-h-l">
                        <span className="brand-dot" style={{ width: 18, height: 18, borderRadius: 5 }} />
                        <div>
                          <div className="gp-tag">Generated Prompt</div>
                          <div className="gp-title">Board Presentation Brief · v1</div>
                        </div>
                      </div>
                      <span className="gp-strength">Strength <b>94</b>/100</span>
                    </div>
                    <div className="gp-body">
                      Act as a <em>senior strategist</em> presenting to a board. Draft a 12-minute Q3 narrative covering the Nebraska expansion: market thesis, three regional wins, capital plan, hiring roadmap, and risk register. Output as a slide-by-slide script with on-screen text, speaker notes, and a one-line takeaway per slide. Tone: confident, data-led, no hype.
                    </div>

                    <div className="syn-chip">
                      <span className="dot" /> ⛓ Master Link active · Visual Companion: 4 image prompts queued
                    </div>

                    <div className="gp-actions">
                      <button className="btn primary">📋 Copy Prompt</button>
                      <button className="btn linked">✦ Make Master Plan</button>
                      <button className="btn">▷ Run with AI</button>
                      <button className="btn">Save to Vault</button>
                      <button className="btn">Refine</button>
                    </div>

                    {/* Send to — branded muted */}
                    <div className="sendto">
                      <div className="sendto-grp">
                        <span className="sendto-lab active">Text →</span>
                        <span className="sb sb-chatgpt"><span className="bd" />ChatGPT</span>
                        <span className="sb sb-claude"><span className="bd" />Claude</span>
                        <span className="sb sb-gemini"><span className="bd" />Gemini</span>
                        <span className="sb sb-perplexity"><span className="bd" />Perplexity</span>
                      </div>
                      <div className="sendto-grp dim" style={{ marginTop: 6 }}>
                        <span className="sendto-lab">Image →</span>
                        <span className="sb sb-mj"><span className="bd" />Midjourney</span>
                        <span className="sb sb-dalle"><span className="bd" />DALL·E</span>
                        <span className="sb sb-sd"><span className="bd" />Stable Diffusion</span>
                      </div>
                      <div className="sendto-grp dim" style={{ marginTop: 6 }}>
                        <span className="sendto-lab">Video →</span>
                        <span className="sb sb-sora"><span className="bd" />Sora</span>
                        <span className="sb sb-runway"><span className="bd" />Runway</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* === MASTER PLAN CARD === */}
                <div className="mp-card-shell">
                  <div className="mp-card">
                    <div className="mp-card-h">
                      <div className="mp-card-h-l">
                        <div className="mp-icon">✦</div>
                        <div>
                          <div className="tag">Master Actionable Plan · Linked</div>
                          <div className="ttl">Q3 Nebraska Expansion · Board Brief</div>
                        </div>
                      </div>
                      <div className="mp-meta">
                        <span className="pill">3.2s</span>
                        <span className="pill linked">⛓ Linked</span>
                      </div>
                    </div>

                    {/* Section 01 — Narrative */}
                    <div className="mp-sec">
                      <div className="mp-sec-h">
                        <span className="mp-sec-num">01</span>
                        <span className="mp-sec-t">The Narrative</span>
                      </div>
                      <div className="mp-sec-body">
                        <strong>Slide 1 · Opening:</strong> "Nebraska isn't a pivot — it's the first proof of our Midwest thesis." On-screen: <em>Q3 Expansion · Lincoln, NE</em>. Speaker note: hold for two beats before clicking through.<br />
                        <strong>Slide 2 · Market Thesis:</strong> Three regional drivers: cost of operations down 34%, talent pool 2.1× the coastal market, regulatory tailwind on agri-tech grants. …
                      </div>
                    </div>

                    {/* Section 02 — Visual Companion (carousel) */}
                    <div className="mp-sec">
                      <div className="mp-sec-h">
                        <span className="mp-sec-num">02</span>
                        <span className="mp-sec-t">Visual Companion · 4 image prompts</span>
                      </div>
                      <div className="vc">
                        <div className="vc-card">
                          <div className="vc-thumb vc-t1"><span className="scn">Slide 1 · Cover</span></div>
                          <div className="vc-body">
                            <div className="vc-title">Nebraska Sunset Cover</div>
                            <div className="vc-prompt">Wide cinematic Nebraska sunset, golden hour over cornfields, warm grade…</div>
                            <div className="vc-acts"><span className="vc-act">Copy</span><span className="vc-act send">Send →</span></div>
                          </div>
                        </div>
                        <div className="vc-card">
                          <div className="vc-thumb vc-t2"><span className="scn">Slide 4 · Map</span></div>
                          <div className="vc-body">
                            <div className="vc-title">Expansion Map</div>
                            <div className="vc-prompt">Stylized US map, Nebraska highlighted in terracotta, isometric perspective…</div>
                            <div className="vc-acts"><span className="vc-act">Copy</span><span className="vc-act send">Send →</span></div>
                          </div>
                        </div>
                        <div className="vc-card">
                          <div className="vc-thumb vc-t3"><span className="scn">Slide 6 · Team</span></div>
                          <div className="vc-body">
                            <div className="vc-title">Lincoln Team Hero</div>
                            <div className="vc-prompt">Documentary photo, six-person team in modern office, natural window light…</div>
                            <div className="vc-acts"><span className="vc-act">Copy</span><span className="vc-act send">Send →</span></div>
                          </div>
                        </div>
                        <div className="vc-card">
                          <div className="vc-thumb vc-t4"><span className="scn">Slide 9 · Risk</span></div>
                          <div className="vc-body">
                            <div className="vc-title">Risk Matrix Visual</div>
                            <div className="vc-prompt">Editorial infographic, dark background, terracotta accent, four-quadrant…</div>
                            <div className="vc-acts"><span className="vc-act">Copy</span><span className="vc-act send">Send →</span></div>
                          </div>
                        </div>
                        <div className="vc-card">
                          <div className="vc-thumb vc-t5"><span className="scn">Slide 12 · Close</span></div>
                          <div className="vc-body">
                            <div className="vc-title">Closing CTA Frame</div>
                            <div className="vc-prompt">Open prairie at dawn, single pathway leading to horizon, hopeful palette…</div>
                            <div className="vc-acts"><span className="vc-act">Copy</span><span className="vc-act send">Send →</span></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 03 — Sources from Perplexity */}
                    <div className="mp-sec">
                      <div className="mp-sec-h">
                        <span className="mp-sec-num">03</span>
                        <span className="mp-sec-t">Sources · Perplexity Research Mode</span>
                      </div>
                      <div className="mp-sec-body" style={{ fontSize: 12, color: 'rgba(240,232,216,0.7)' }}>
                        Citations pulled automatically when Master Link is on:
                      </div>
                      <div className="sources">
                        <span className="src">[1] BLS · Nebraska Labor 2025</span>
                        <span className="src">[2] USDA Agri-Tech Grants Q2</span>
                        <span className="src">[3] Lincoln Chamber Report</span>
                        <span className="src">[4] CBRE Midwest Cost Index</span>
                      </div>
                    </div>

                    {/* Section 04 — AI Execution */}
                    <div className="mp-sec">
                      <div className="mp-sec-h">
                        <span className="mp-sec-num">04</span>
                        <span className="mp-sec-t">AI Execution · copy-ready</span>
                      </div>
                      <div className="mp-sec-body" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, padding: 10, background: 'rgba(0,0,0,0.25)', borderRadius: 7, color: 'rgba(240,232,216,0.75)' }}>
                        TEXT_PROMPT for ChatGPT / Claude / Gemini · pre-formatted<br />
                        IMAGE_PROMPTS × 4 for Midjourney <span style={{ color: '#f4a574' }}>--ar 16:9 --v 6 --style raw</span><br />
                        DALL·E variants · Stable Diffusion preset bundle
                      </div>
                    </div>

                    {/* Footer actions */}
                    <div className="mp-foot">
                      <button className="btn primary">⬇ Export Plan (PDF)</button>
                      <button className="btn">📋 Copy All</button>
                      <button className="btn">▷ Run All In-House</button>
                      <button className="btn">Save to Vault</button>
                    </div>
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
                <div className="brief-preview">
                  <span className="bp-i">⛓</span>
                  <span>Master Brief ready · 1 narrative + 4 visuals + 4 sources · est. 3–4s</span>
                </div>
              </div>
            </section>

            {/* CHAIN BRIDGE GUTTER */}
            <div className="chain-gutter">
              <div className="chain-spine" />
              <div className="chain-label top">SOUL</div>
              <div className="chain-stack">
                <div className="chain-link" />
                <div className="chain-link" />
                <div className="chain-link" />
                <div className="chain-link" />
              </div>
              <div className="chain-particles">
                <div className="pt" /><div className="pt" /><div className="pt" />
              </div>
              <div className="chain-label bot">BODY</div>
            </div>

            {/* RIGHT PANEL */}
            <aside className="tools">
              <div className="tools-h">
                <div>
                  <div className="t">📷 Tool Panel · Auto-expanded</div>
                  <div className="sub">Template: Board Presentation</div>
                </div>
                <span className="pin" title="Pin open">📌 Pinned</span>
              </div>

              <div className="ml-card">
                <div className="ml-row">
                  <div>
                    <div className="lab">⛓ Master Link · ON</div>
                    <div className="desc">Soul + Body → one Master Plan</div>
                  </div>
                  <div className="switch" />
                </div>
                <div className="ml-status">
                  <span className="d" /> ENGINES LINKED · BRIEF OPTIMIZED
                </div>
              </div>

              <div className="photo">
                <div className="photo-h">
                  <div className="t">Visual Asset Engine</div>
                  <span className="surprise">⚡ Surprise Me</span>
                </div>
                <div className="acc open">
                  <span className="nm">Style</span>
                  <span className="ct">3 picked ▾</span>
                </div>
                <div className="pills">
                  <span className="pl on">Editorial</span>
                  <span className="pl on">Cinematic</span>
                  <span className="pl on">Documentary</span>
                  <span className="pl">Studio</span>
                </div>
                <div className="acc"><span className="nm">Camera &amp; Lens</span><span className="ct">35mm ▸</span></div>
                <div className="acc"><span className="nm">Lighting &amp; Mood</span><span className="ct">Golden hour ▸</span></div>
                <div className="acc open"><span className="nm">Technical Knobs</span><span className="ct">5 set ▾</span></div>
                <div className="knobs">
                  <div className="knob"><div className="lab">Aperture</div><div className="val">f/2.8</div></div>
                  <div className="knob"><div className="lab">Shutter</div><div className="val">1/250s</div></div>
                  <div className="knob"><div className="lab">ISO</div><div className="val">400</div></div>
                  <div className="knob"><div className="lab">Focal</div><div className="val">35mm</div></div>
                  <div className="knob"><div className="lab">Film</div><div className="val">Portra 400</div></div>
                </div>
                <div className="acc"><span className="nm">Composition</span><span className="ct">— ▸</span></div>
                <div className="acc"><span className="nm">Color Palette</span><span className="ct">Warm ▸</span></div>
                <div className="acc"><span className="nm">Negative Prompt</span><span className="ct">2 ▸</span></div>
              </div>

              <div className="photo" style={{ borderColor: 'rgba(229,124,74,0.3)' }}>
                <div className="photo-h">
                  <div className="t">Enhance With</div>
                </div>
                <div className="pills">
                  <span className="pl on">Emotion</span>
                  <span className="pl">Story</span>
                  <span className="pl on">Texture</span>
                  <span className="pl">Atmosphere</span>
                  <span className="pl">Tension</span>
                </div>
              </div>
            </aside>
          </div>

          <div className="statusbar">
            <div className="l">
              <span>● Saved locally</span>
              <span>28 in Vault</span>
              <span>⛓ Master Link ON</span>
            </div>
            <div>v3 chassis · synergy preview · no popups · no forced login</div>
          </div>
        </div>
      </div>
    </>
  );
}
