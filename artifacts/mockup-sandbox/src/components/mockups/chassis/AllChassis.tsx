import "./_group.css";
import HomepageHero from "./HomepageHero";
import { WelcomeBack } from "./WelcomeBack";
import { WorkstationHeader } from "./WorkstationHeader";
import { ResultPanel } from "./ResultPanel";
import { ExpertCenter } from "./ExpertCenter";
import { PhotoSuite } from "./PhotoSuite";
import { Marketing } from "./Marketing";
import { Pricing } from "./Pricing";

const surfaces: Array<{ id: string; label: string; Comp: () => JSX.Element; note?: string }> = [
  { id: "homepage", label: "1 · Homepage Hero & Seam", Comp: HomepageHero },
  { id: "welcome", label: "2 · Returning User — Welcome Back", Comp: WelcomeBack, note: "Designed for a 640px column" },
  { id: "workstation", label: "3 · Workstation Header + Goal", Comp: WorkstationHeader },
  { id: "result", label: "4 · Result Panel + Run With AI", Comp: ResultPanel },
  { id: "expert", label: "5 · Expert Command Center Drawer", Comp: ExpertCenter, note: "Designed for a 480px drawer" },
  { id: "photo", label: "6 · Photography Suite", Comp: PhotoSuite },
  { id: "marketing", label: "7 · Marketing Sections", Comp: Marketing },
  { id: "pricing", label: "8 · Pricing Page", Comp: Pricing },
];

export default function AllChassis() {
  return (
    <div style={{ background: "#eceae3", minHeight: "100vh", fontFamily: "Satoshi, system-ui, sans-serif" }}>
      <nav style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(247,246,242,0.92)", backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(36,33,28,0.08)",
        padding: "14px 24px", display: "flex", flexWrap: "wrap", gap: 8,
      }}>
        <strong style={{ fontSize: 13, color: "#24211c", marginRight: 12, alignSelf: "center" }}>
          PromptMeGood — Chassis surfaces
        </strong>
        {surfaces.map((s) => (
          <a key={s.id} href={`#${s.id}`} style={{
            fontSize: 12, padding: "6px 10px", borderRadius: 999,
            background: "#fff", border: "1px solid rgba(36,33,28,0.12)",
            color: "#24211c", textDecoration: "none",
          }}>{s.label.split(" · ")[0]}</a>
        ))}
      </nav>

      {surfaces.map(({ id, label, Comp, note }) => (
        <section key={id} id={id} style={{ padding: "40px 0 60px" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto 16px", padding: "0 24px" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#24211c", margin: 0 }}>{label}</h2>
            {note && (
              <p style={{ fontSize: 13, color: "rgba(36,33,28,0.6)", margin: "4px 0 0" }}>{note}</p>
            )}
          </div>
          <div style={{
            maxWidth: id === "welcome" ? 640 : id === "expert" ? 480 : 1280,
            margin: "0 auto",
            background: "#f7f6f2",
            border: "1px solid rgba(36,33,28,0.12)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 12px 40px -20px rgba(36,33,28,0.25)",
          }}>
            <Comp />
          </div>
        </section>
      ))}
    </div>
  );
}
