import './_group.css';
import { ChevronDown, Sparkles, SlidersHorizontal, Check, CircleDot } from 'lucide-react';

export function WorkstationHeader() {
  return (
    <div
      className="pmg-chassis"
      style={{
        width: '100%',
        minHeight: 900,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-bg)',
      }}
    >
      {/* Top app bar */}
      <header
        style={{
          height: 56,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-elev)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            P
          </div>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: '-0.025em',
              color: 'var(--color-text)',
            }}
          >
            PromptMeGood
          </span>
        </div>

        {/* Mode switcher pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            padding: 3,
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-sunken)',
            borderRadius: 999,
          }}
        >
          <button
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'var(--color-bg-elev)',
              border: '1px solid var(--color-border)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            Prompt Engine
            <ChevronDown size={13} strokeWidth={2.25} />
          </button>
          <button
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              background: 'transparent',
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-muted)',
            }}
          >
            Photography Suite
          </button>
          <button
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              background: 'transparent',
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--color-text-muted)',
            }}
          >
            Master Link
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, justifyContent: 'flex-end' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              color: 'var(--color-text-muted)',
            }}
          >
            <CircleDot size={10} style={{ color: 'var(--color-success)' }} />
            Saved
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-elev)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--color-text)',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: 'var(--color-primary)',
              }}
            />
            Claude Sonnet
          </span>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: 'var(--color-primary-highlight)',
              color: 'var(--color-primary-hover)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              border: '1px solid var(--color-border)',
            }}
          >
            JS
          </div>
        </div>
      </header>

      {/* Sub-header rail */}
      <div
        style={{
          height: 40,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          background: 'var(--color-bg-sunken)',
          borderBottom: '1px solid var(--color-border)',
          fontSize: 12.5,
          color: 'var(--color-text-muted)',
        }}
      >
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Workstation</span>
          <span style={{ color: 'var(--color-text-faint)' }}>/</span>
          <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>
            Series A launch announcement
          </span>
        </div>
        <button
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 'none',
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--color-primary)',
            cursor: 'pointer',
          }}
        >
          <SlidersHorizontal size={13} strokeWidth={2} />
          Open Expert Command Center
          <span aria-hidden>→</span>
        </button>
      </div>

      {/* Main canvas */}
      <main style={{ flex: 1, padding: '40px 24px 56px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 860, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Goal card */}
          <div className="pmg-card" style={{ padding: 32 }}>
            <div className="pmg-eyebrow" style={{ marginBottom: 12 }}>
              Your goal
            </div>

            <div
              style={{
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                background: 'var(--color-bg-elev)',
                fontSize: 15,
                lineHeight: 1.55,
                color: 'var(--color-text)',
                minHeight: 112,
                letterSpacing: '-0.011em',
              }}
            >
              Draft a confident, slightly understated launch announcement for our $18M Series A.
              Audience: existing customers + tech press. Tone: build trust, avoid hype. Include a
              specific milestone we hit.
            </div>

            {/* Context chips grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 10,
                marginTop: 16,
              }}
            >
              {[
                { label: 'Tone', value: 'Confident, understated' },
                { label: 'Audience', value: 'Customers + press' },
                { label: 'Format', value: 'Email + blog post' },
              ].map((c) => (
                <div
                  key={c.label}
                  style={{
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    background: 'var(--color-bg)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 10.5,
                      fontWeight: 600,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-faint)',
                      marginBottom: 4,
                    }}
                  >
                    {c.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                    {c.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Action row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 24,
                paddingTop: 20,
                borderTop: '1px solid var(--color-border)',
              }}
            >
              <button className="pmg-btn pmg-btn-primary">
                <Sparkles size={14} strokeWidth={2.25} />
                Run with AI
              </button>
              <button className="pmg-btn pmg-btn-secondary">Save draft</button>
              <button className="pmg-btn pmg-btn-ghost">Clear</button>
              <div style={{ flex: 1 }} />
              <span
                className="pmg-mono"
                style={{ fontSize: 11.5, color: 'var(--color-text-faint)' }}
              >
                ⌘ + ↵
              </span>
            </div>
          </div>

          {/* Status strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              padding: '0 4px',
              fontSize: 12,
              color: 'var(--color-text-muted)',
            }}
          >
            <span>
              Tokens today{' '}
              <span className="pmg-mono" style={{ color: 'var(--color-text)' }}>
                1,240 / 25,000
              </span>
            </span>
            <span style={{ color: 'var(--color-text-faint)' }}>·</span>
            <span>
              Last run <span style={{ color: 'var(--color-text-faint)' }}>—</span>
            </span>
            <div style={{ flex: 1 }} />
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 10px',
                borderRadius: 999,
                background: 'var(--color-primary-highlight)',
                color: 'var(--color-primary-hover)',
                fontSize: 11.5,
                fontWeight: 600,
                border: '1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)',
              }}
            >
              <Check size={11} strokeWidth={2.5} />
              Quick Win complete
            </span>
          </div>

          {/* Empty-state placeholder */}
          <div
            style={{
              height: 360,
              border: '1.5px dashed var(--color-border-strong)',
              borderRadius: 'var(--radius-lg)',
              background:
                'repeating-linear-gradient(135deg, transparent 0 12px, rgba(36,33,28,0.012) 12px 24px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: 32,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: 'var(--color-bg-sunken)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 6,
              }}
            >
              <Sparkles size={16} strokeWidth={1.75} style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: 'var(--color-text)',
              }}
            >
              Your prompt + result will land here.
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Run a prompt to populate this panel.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
export default WorkstationHeader;
