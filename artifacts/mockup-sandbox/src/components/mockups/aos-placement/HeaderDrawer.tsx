import { Topbar, GoalArea, AOSCard, PageFrame, ResultPanel, border, teal, muted, text } from "./_shell";

export function HeaderDrawer() {
  const pulse = (
    <div style={{
      position: "relative", display: "flex", alignItems: "center", gap: 6,
      padding: "6px 10px", borderRadius: 8,
      background: "rgba(62,224,160,.12)", border: `1px solid rgba(62,224,160,.4)`,
      color: teal, fontSize: 12, fontWeight: 600, cursor: "pointer",
    }}>
      ⚙ Output Settings
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: teal, marginLeft: 2,
      }}/>
    </div>
  );

  return (
    <PageFrame>
      <Topbar extra={pulse} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, padding: 20, maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <GoalArea />
          <ResultPanel />
        </div>
        <div style={{
          background: "#0f1d22", border: `1px solid ${border}`, borderRadius: 12, padding: 16,
          color: muted, fontSize: 13, lineHeight: 1.5,
        }}>
          <div style={{ color: text, fontWeight: 600, marginBottom: 8, fontSize: 14 }}>👋 Welcome back</div>
          Pick up where you left off, or start a fresh prompt. Your last 3 prompts are in the Vault.
        </div>
      </div>

      {/* Drawer overlay */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: 380,
        background: "#0a1316", borderLeft: `1px solid ${border}`,
        boxShadow: "-12px 0 40px rgba(0,0,0,.45)",
        padding: 20, display: "flex", flexDirection: "column", gap: 14,
        animation: "none",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ fontWeight: 700, color: text, fontSize: 16 }}>⚙ Output Settings</div>
          <div style={{ marginLeft: "auto", color: muted, cursor: "pointer", fontSize: 18 }}>✕</div>
        </div>
        <div style={{
          padding: "8px 12px", borderRadius: 8, background: "rgba(62,224,160,.08)",
          border: `1px dashed rgba(62,224,160,.4)`, fontSize: 11, color: teal,
          textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center",
        }}>
          Variant C — Header Drawer (matches Business Mode pattern)
        </div>
        <AOSCard />
      </div>
      {/* Dim under drawer */}
      <div style={{
        position: "fixed", top: 0, right: 380, bottom: 0, left: 0,
        background: "rgba(0,0,0,.35)", pointerEvents: "none",
      }}/>
    </PageFrame>
  );
}
