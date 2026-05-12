import type { ReactNode } from "react";

export const teal = "#3ee0a0";
export const bg = "#0b1518";
export const card = "#0f1d22";
export const border = "#1d2f35";
export const text = "#cfe7df";
export const muted = "#7a9690";

export function Topbar({ extra }: { extra?: ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 16px", borderBottom: `1px solid ${border}`,
      background: "#0a1316", height: 52, position: "sticky", top: 0, zIndex: 5,
    }}>
      <div style={{ fontWeight: 700, color: teal, letterSpacing: 0.3 }}>PromptMeGood</div>
      <div style={{ display: "flex", gap: 6, marginLeft: 12 }}>
        {["Text", "Photography", "Video"].map((t, i) => (
          <div key={t} style={{
            padding: "6px 12px", borderRadius: 8, fontSize: 13,
            background: i === 0 ? "rgba(62,224,160,.12)" : "transparent",
            color: i === 0 ? teal : muted,
            border: i === 0 ? `1px solid rgba(62,224,160,.3)` : `1px solid transparent`,
          }}>{t}</div>
        ))}
      </div>
      <div style={{ flex: 1 }} />
      {extra}
      {["💼", "🔔", "⚙", "👤"].map((g) => (
        <div key={g} style={{
          width: 36, height: 36, display: "grid", placeItems: "center",
          borderRadius: 8, color: muted, fontSize: 16,
        }}>{g}</div>
      ))}
    </div>
  );
}

export function GoalArea() {
  return (
    <div style={{
      background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 16,
    }}>
      <div style={{ fontSize: 12, color: muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
        What do you want the AI to do?
      </div>
      <div style={{
        minHeight: 110, padding: 12, borderRadius: 8, background: "#0a1417",
        border: `1px solid ${border}`, color: text, fontSize: 14, lineHeight: 1.5,
      }}>
        Write a launch email for our new espresso subscription — friendly, a bit playful, 120 words.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
        <button style={primaryBtn}>✨ Build My Prompt</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: muted }}>
          🎙 Voice Input · en-US · <span style={{ color: teal }}>Prompt Tuning</span>
        </div>
      </div>
    </div>
  );
}

export function ResultPanel({ collapsed }: { collapsed?: boolean }) {
  return (
    <div style={{
      background: card, border: `1px solid ${border}`, borderRadius: 12,
      padding: 16, minHeight: collapsed ? 220 : 360,
    }}>
      <div style={{ fontSize: 12, color: muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
        Your prompt will appear here
      </div>
      <div style={{
        height: collapsed ? 140 : 280, borderRadius: 8, border: `1px dashed ${border}`,
        display: "grid", placeItems: "center", color: muted, fontSize: 13,
      }}>
        Empty state · waiting for first build
      </div>
    </div>
  );
}

export const primaryBtn: React.CSSProperties = {
  padding: "10px 14px", borderRadius: 8, border: "none",
  background: teal, color: "#062019", fontWeight: 600, cursor: "pointer", fontSize: 13,
};

export const ghostBtn: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8, background: "transparent",
  border: `1px solid ${border}`, color: text, fontSize: 12, cursor: "pointer",
};

export function AOSCard({ compact }: { compact?: boolean }) {
  return (
    <div style={{
      background: "linear-gradient(180deg, rgba(62,224,160,.06), transparent)",
      border: `1px solid ${border}`, borderRadius: 12, padding: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(62,224,160,.12)",
          display: "grid", placeItems: "center", color: teal, fontSize: 14 }}>⚙</div>
        <div style={{ fontWeight: 600, color: text, fontSize: 14 }}>Advanced Output Settings</div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: muted }}>▾</div>
      </div>
      {!compact && (
        <div style={{ fontSize: 12, color: muted, marginBottom: 12, lineHeight: 1.5 }}>
          Quick toggles for the most-used prompt boosts. Open the Expert Command Center for full control.
        </div>
      )}
      {[
        { label: "💰 Growth Mode", desc: "Conversion-focused phrasing" },
        { label: "🗣 Human Voice", desc: "Warmer, less robotic" },
        { label: "🔍 Clarity Boost", desc: "Tighter structure & spec" },
      ].map((row, i) => (
        <div key={row.label} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid ${border}`,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: text, fontSize: 13, fontWeight: 500 }}>{row.label}</div>
            {!compact && <div style={{ color: muted, fontSize: 11, marginTop: 2 }}>{row.desc}</div>}
          </div>
          <div style={{
            width: 36, height: 20, borderRadius: 999,
            background: i === 1 ? teal : "#1a2a30",
            position: "relative", flexShrink: 0,
          }}>
            <div style={{
              position: "absolute", top: 2, left: i === 1 ? 18 : 2,
              width: 16, height: 16, borderRadius: "50%", background: "#fff",
            }}/>
          </div>
        </div>
      ))}
      {!compact && (
        <button style={{ ...ghostBtn, marginTop: 10, width: "100%" }}>
          ⚙ Open Expert Command Center
        </button>
      )}
    </div>
  );
}

export function PageFrame({ children }: { children: ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh", background: bg, color: text,
      fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
    }}>
      {children}
    </div>
  );
}
