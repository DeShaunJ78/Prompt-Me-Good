import './_group.css';
import { X, ChevronDown, ChevronRight, Plus, Sparkles } from 'lucide-react';

export function ExpertCenter() {
  const variables = ['audience', 'tone', 'milestone', 'company_name'];
  const saved = [
    { name: 'Series B announcement — board-ready', mode: 'Prompt Engine', date: '2d ago' },
    { name: 'Editorial portrait, golden hour', mode: 'Photography', date: '5d ago' },
    { name: 'Q4 launch plan — 6 steps', mode: 'Master Link', date: 'Mar 12' },
  ];

  return (
    <div
      className="pmg-chassis relative overflow-hidden"
      style={{ width: 480, height: 900, background: 'var(--color-bg)' }}
    >
      {/* Faint workstation hint */}
      <div className="absolute inset-0 p-6 space-y-4" style={{ opacity: 0.55 }}>
        <div
          className="h-7 w-40 rounded"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-elev)' }}
        />
        <div
          className="h-32 w-full rounded-lg"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-elev)' }}
        />
        <div
          className="h-48 w-full rounded-lg"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-elev)' }}
        />
        <div
          className="h-24 w-full rounded-lg"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-elev)' }}
        />
        <div
          className="h-40 w-full rounded-lg"
          style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-elev)' }}
        />
      </div>

      {/* Scrim */}
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.40)' }} />

      {/* Drawer */}
      <div
        className="absolute top-0 right-0 h-full flex flex-col"
        style={{
          width: 420,
          background: 'var(--color-bg-elev)',
          borderLeft: '1px solid var(--color-border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-start justify-between px-5"
          style={{
            height: 64,
            borderBottom: '1px solid var(--color-border)',
            paddingTop: 12,
            paddingBottom: 12,
          }}
        >
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Sparkles size={14} style={{ color: 'var(--color-primary)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.025em' }}>
                Expert Command Center
              </h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
              Advanced controls for this goal
            </p>
          </div>
          <button
            className="pmg-btn pmg-btn-ghost"
            style={{ padding: 6, marginTop: -2, marginRight: -6 }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Section: Variables */}
          <Section title="Variables" count="4" open>
            <div className="flex flex-wrap gap-2">
              {variables.map((v) => (
                <span
                  key={v}
                  className="pmg-mono"
                  style={{
                    fontSize: 12,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: 'var(--color-bg-sunken)',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text)',
                  }}
                >
                  {`{{${v}}}`}
                </span>
              ))}
              <button
                className="pmg-btn pmg-btn-ghost"
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  border: '1px dashed var(--color-border-strong)',
                }}
              >
                <Plus size={12} /> add
              </button>
            </div>
          </Section>

          {/* Section: System prompt */}
          <Section title="System prompt" open>
            <div
              className="pmg-mono"
              style={{
                background: 'var(--color-bg-sunken)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                padding: 12,
                fontSize: 12,
                lineHeight: 1.55,
                color: 'var(--color-text)',
                whiteSpace: 'pre-wrap',
              }}
            >
{`You are a senior comms editor. Write with
confidence and restraint. Avoid superlatives,
hedging, and corporate filler. Lead with the
concrete change; defer the framing. Keep
sentences under 22 words. Match {{tone}} for
{{audience}}.`}
            </div>
          </Section>

          {/* Section: Output schema */}
          <Section title="Output schema" open>
            <div
              className="pmg-mono"
              style={{
                background: 'var(--color-bg-sunken)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                padding: 12,
                fontSize: 12,
                lineHeight: 1.6,
                color: 'var(--color-text)',
                whiteSpace: 'pre',
                overflowX: 'auto',
              }}
            >
{`{
  "headline": "string",
  "body": "string",
  "talking_points": "string[]"
}`}
            </div>
          </Section>

          {/* Section: Model & temperature */}
          <Section title="Model & temperature" open>
            <div className="space-y-3">
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-muted)',
                    marginBottom: 6,
                    fontWeight: 500,
                  }}
                >
                  Model
                </div>
                <div
                  className="flex items-center justify-between"
                  style={{
                    padding: '9px 12px',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 6,
                    background: 'var(--color-bg-elev)',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  <span>Claude Sonnet 4.5</span>
                  <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
                </div>
              </div>
              <div>
                <div
                  className="flex items-center justify-between"
                  style={{ marginBottom: 8 }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-muted)',
                      fontWeight: 500,
                    }}
                  >
                    Temperature
                  </span>
                  <span
                    className="pmg-mono"
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      background: 'var(--color-bg-sunken)',
                      border: '1px solid var(--color-border)',
                      fontWeight: 600,
                    }}
                  >
                    0.4
                  </span>
                </div>
                <div
                  style={{
                    position: 'relative',
                    height: 4,
                    borderRadius: 999,
                    background: 'var(--color-bg-sunken)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '40%',
                      borderRadius: 999,
                      background: 'var(--color-primary)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 'calc(40% - 7px)',
                      top: -5,
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: '#fff',
                      border: '1.5px solid var(--color-primary)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  />
                </div>
                <div
                  className="flex justify-between"
                  style={{
                    marginTop: 6,
                    fontSize: 10,
                    color: 'var(--color-text-faint)',
                  }}
                >
                  <span>Precise</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>
          </Section>

          {/* Section: Saved prompts library */}
          <Section title="Saved prompts library" count="12" open last>
            <div className="flex flex-col">
              {saved.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between"
                  style={{
                    padding: '10px 0',
                    borderTop: i === 0 ? 'none' : '1px solid var(--color-border)',
                  }}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.name}
                    </div>
                    <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: 'var(--color-bg-sunken)',
                          color: 'var(--color-text-muted)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {s.mode}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>
                        {s.date}
                      </span>
                    </div>
                  </div>
                  <button
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Load
                  </button>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            padding: '12px 16px',
            background: 'var(--color-bg-elev)',
          }}
        >
          <button
            className="pmg-btn pmg-btn-primary"
            style={{ width: '100%' }}
          >
            Apply to Workstation
          </button>
          <button
            className="pmg-btn pmg-btn-ghost"
            style={{ width: '100%', marginTop: 6, fontSize: 12 }}
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  open,
  last,
  children,
}: {
  title: string;
  count?: string;
  open?: boolean;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
        padding: '14px 20px 16px',
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: open ? 12 : 0, cursor: 'pointer' }}
      >
        <div className="flex items-center gap-2">
          {open ? (
            <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />
          ) : (
            <ChevronRight size={14} style={{ color: 'var(--color-text-muted)' }} />
          )}
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: 'var(--color-text)',
            }}
          >
            {title}
          </span>
          {count && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                padding: '1px 6px',
                borderRadius: 999,
                background: 'var(--color-bg-sunken)',
                border: '1px solid var(--color-border)',
              }}
            >
              {count}
            </span>
          )}
        </div>
      </div>
      {open && children}
    </div>
  );
}
export default ExpertCenter;
