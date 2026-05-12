import { Topbar, GoalArea, AOSCard, PageFrame, border, muted } from "./_shell";

export function RightColumnHero() {
  return (
    <PageFrame>
      <Topbar />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, padding: 20, maxWidth: 1240, margin: "0 auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <GoalArea />
          <div style={{
            background: "#0f1d22", border: `1px solid ${border}`, borderRadius: 12,
            padding: 16, minHeight: 360,
          }}>
            <div style={{ fontSize: 12, color: muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
              Your prompt will appear here
            </div>
            <div style={{
              height: 280, borderRadius: 8, border: `1px dashed ${border}`,
              display: "grid", placeItems: "center", color: muted, fontSize: 13,
            }}>
              Empty state · waiting for first build
            </div>
          </div>
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{
            padding: "8px 12px", borderRadius: 8, background: "rgba(62,224,160,.08)",
            border: `1px dashed rgba(62,224,160,.4)`, fontSize: 11, color: "#3ee0a0",
            textTransform: "uppercase", letterSpacing: 0.6, textAlign: "center",
          }}>
            Variant A — Right Column Hero
          </div>
          <AOSCard />
          <div style={{
            background: "#0f1d22", border: `1px solid ${border}`, borderRadius: 12, padding: 14,
            fontSize: 12, color: muted, lineHeight: 1.5,
          }}>
            <div style={{ color: "#cfe7df", fontWeight: 600, marginBottom: 6, fontSize: 13 }}>💡 Tip</div>
            Set tone before building for the best results. Settings stick across sessions.
          </div>
        </aside>
      </div>
    </PageFrame>
  );
}
