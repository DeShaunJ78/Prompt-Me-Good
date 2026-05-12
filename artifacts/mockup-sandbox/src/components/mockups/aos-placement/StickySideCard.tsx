import { Topbar, GoalArea, AOSCard, PageFrame, ResultPanel, border, muted, teal } from "./_shell";

export function StickySideCard() {
  return (
    <PageFrame>
      <Topbar />
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, padding: 20, maxWidth: 1240, margin: "0 auto", alignItems: "start" }}>
        <aside style={{ position: "sticky", top: 72, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{
            padding: "8px 12px", borderRadius: 8, background: "rgba(62,224,160,.08)",
            border: `1px dashed rgba(62,224,160,.4)`, fontSize: 11, color: teal,
            textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center",
          }}>
            Variant B — Sticky Side Card
          </div>
          <AOSCard compact />
          <div style={{
            background: "#0f1d22", border: `1px solid ${border}`, borderRadius: 12, padding: 12,
          }}>
            <div style={{ fontSize: 11, color: muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>Voice</div>
            <select style={{
              width: "100%", padding: "8px 10px", borderRadius: 6, background: "#0a1417",
              border: `1px solid ${border}`, color: "#cfe7df", fontSize: 13,
            }}>
              <option>Friendly · conversational</option>
            </select>
          </div>
          <div style={{ fontSize: 11, color: muted, textAlign: "center", padding: "0 8px", lineHeight: 1.5 }}>
            ↑ Card stays pinned as you scroll the workstation.
          </div>
        </aside>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <GoalArea />
          <ResultPanel />
        </div>
      </div>
    </PageFrame>
  );
}
