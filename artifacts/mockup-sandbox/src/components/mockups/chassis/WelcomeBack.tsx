import './_group.css';
import { ArrowRight, Plus } from 'lucide-react';

type Goal = {
  title: string;
  mode: 'Prompt Engine' | 'Master Link' | 'Photography';
  edited: string;
};

const goals: Goal[] = [
  { title: 'Series A launch announcement', mode: 'Prompt Engine', edited: 'Edited 2h ago' },
  { title: 'Onboarding email sequence (week 1–3)', mode: 'Master Link', edited: 'Edited yesterday' },
  { title: 'Espresso bar hero photo', mode: 'Photography', edited: 'Edited 3 days ago' },
];

const modeStyles: Record<Goal['mode'], { bg: string; fg: string; border: string }> = {
  'Prompt Engine': {
    bg: 'var(--color-primary-highlight)',
    fg: 'var(--color-primary-hover)',
    border: 'color-mix(in srgb, var(--color-primary) 20%, transparent)',
  },
  'Master Link': {
    bg: 'color-mix(in srgb, var(--color-text) 6%, var(--color-bg-elev))',
    fg: 'var(--color-text)',
    border: 'var(--color-border-strong)',
  },
  'Photography': {
    bg: 'color-mix(in srgb, var(--color-text-muted) 12%, var(--color-bg-elev))',
    fg: 'var(--color-text-muted)',
    border: 'var(--color-border-strong)',
  },
};

export function WelcomeBack() {
  return (
    <div
      className="pmg-chassis"
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '56px 24px',
      }}
    >
      <div
        className="pmg-card"
        style={{
          width: '100%',
          maxWidth: 560,
          padding: '32px 32px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        {/* Greeting row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: 'var(--color-primary-highlight)',
              border: '1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)',
              color: 'var(--color-primary-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.02em',
            }}
          >
            JS
          </div>
          <span className="pmg-eyebrow">Welcome back, Jordan</span>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h1 style={{ fontSize: 28, lineHeight: 1.15, margin: 0 }}>
            Pick up where you left off
          </h1>
          <p style={{ fontSize: 15, color: 'var(--color-text-muted)', margin: 0 }}>
            You have 3 active goals across two modes.
          </p>
        </div>

        {/* Goals list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {goals.map((g, i) => {
            const m = modeStyles[g.mode];
            const isTop = i === 0;
            return (
              <div
                key={g.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  padding: '14px 16px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  background: isTop ? 'color-mix(in srgb, var(--color-primary-highlight) 35%, var(--color-bg-elev))' : 'var(--color-bg-elev)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14.5,
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      letterSpacing: '-0.01em',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {g.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        padding: '3px 8px',
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 600,
                        background: m.bg,
                        color: m.fg,
                        border: `1px solid ${m.border}`,
                        letterSpacing: '0.005em',
                      }}
                    >
                      {g.mode}
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: 'var(--color-text-faint)',
                      }}
                    >
                      {g.edited}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 13,
                    fontWeight: 600,
                    color: isTop ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Resume
                  <ArrowRight size={14} strokeWidth={2.25} />
                </div>
              </div>
            );
          })}
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            className="pmg-btn pmg-btn-primary"
            style={{ width: '100%', padding: '12px 16px', fontSize: 14.5 }}
          >
            Resume top goal
            <ArrowRight size={16} strokeWidth={2.25} />
          </button>
          <button
            className="pmg-btn pmg-btn-ghost"
            style={{ width: '100%', padding: '10px 16px' }}
          >
            <Plus size={14} strokeWidth={2.25} />
            Start a new goal
          </button>
        </div>

        {/* Footer stat strip */}
        <div className="pmg-divider" />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            paddingTop: 2,
          }}
        >
          <span className="pmg-mono" style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
            🔥 4-day streak
          </span>
          <span className="pmg-mono" style={{ color: 'var(--color-text-faint)', fontSize: 12 }}>
            12 prompts saved
          </span>
          <span className="pmg-mono" style={{ color: 'var(--color-text-faint)', fontSize: 12 }}>
            3 in library
          </span>
        </div>
      </div>
    </div>
  );
}

export default WelcomeBack;
