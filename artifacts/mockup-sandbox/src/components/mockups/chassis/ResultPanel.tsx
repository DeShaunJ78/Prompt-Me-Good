import './_group.css';
import {
  Sparkles,
  ChevronRight,
  Copy,
  Download,
  Share2,
  Pencil,
  ChevronDown,
  Search,
} from 'lucide-react';

export function ResultPanel() {
  return (
    <div
      className="pmg-chassis"
      style={{ width: 1280, minHeight: 900, background: 'var(--color-bg)' }}
    >
      {/* App bar */}
      <header
        className="flex items-center justify-between"
        style={{
          height: 56,
          padding: '0 24px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-elev)',
        }}
      >
        <div className="flex items-center" style={{ gap: 10 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              background: 'var(--color-primary)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--color-text-inverse)',
              fontWeight: 800,
              fontSize: 12,
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
            }}
          >
            PromptMeGood
          </span>
          <span
            style={{
              marginLeft: 8,
              fontSize: 11,
              color: 'var(--color-text-faint)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Workstation
          </span>
        </div>

        <div
          className="flex items-center"
          style={{
            gap: 2,
            padding: 3,
            background: 'var(--color-bg-sunken)',
            borderRadius: 999,
            border: '1px solid var(--color-border)',
          }}
        >
          {['Prompt Engine', 'Photography Suite', 'Master Link'].map((m, i) => (
            <button
              key={m}
              style={{
                padding: '6px 14px',
                fontSize: 12.5,
                fontWeight: 600,
                borderRadius: 999,
                border: 'none',
                background: i === 0 ? 'var(--color-bg-elev)' : 'transparent',
                color: i === 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
                boxShadow: i === 0 ? 'var(--shadow-sm)' : 'none',
                cursor: 'pointer',
              }}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="flex items-center" style={{ gap: 12 }}>
          <button
            className="flex items-center"
            style={{
              gap: 6,
              padding: '6px 10px',
              fontSize: 12.5,
              fontWeight: 600,
              borderRadius: 6,
              background: 'var(--color-bg-elev)',
              border: '1px solid var(--color-border-strong)',
              color: 'var(--color-text)',
              cursor: 'pointer',
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
            Claude Sonnet 4
            <ChevronDown size={13} style={{ color: 'var(--color-text-faint)' }} />
          </button>
          <Search size={16} style={{ color: 'var(--color-text-muted)' }} />
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: '#2b3f4a',
              color: 'white',
              display: 'grid',
              placeItems: 'center',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            DJ
          </div>
        </div>
      </header>

      {/* Goal strip */}
      <div
        className="flex items-center justify-between"
        style={{
          height: 56,
          padding: '0 32px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-elev)',
        }}
      >
        <div className="flex items-center" style={{ gap: 10, minWidth: 0 }}>
          <span className="pmg-eyebrow" style={{ color: 'var(--color-text-faint)' }}>
            Goal
          </span>
          <span
            style={{
              fontSize: 13.5,
              color: 'var(--color-text)',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Draft a confident Series A launch announcement for Throughline — investor-credible, founder-voice, ~250 words.
          </span>
          <span className="pmg-chip" style={{ marginLeft: 4 }}>
            <Sparkles size={11} /> Series A · launch
          </span>
        </div>
        <button
          className="flex items-center"
          style={{
            gap: 6,
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--color-primary)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Pencil size={12} /> Edit goal
        </button>
      </div>

      {/* Tabs */}
      <div
        className="flex items-center"
        style={{
          padding: '0 32px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-bg-elev)',
          gap: 0,
        }}
      >
        {[
          { label: 'Prompt', active: false },
          { label: 'Result', active: true },
          { label: 'Iterate', active: false },
        ].map((t) => (
          <button
            key={t.label}
            style={{
              padding: '12px 16px',
              fontSize: 13,
              fontWeight: 600,
              color: t.active ? 'var(--color-text)' : 'var(--color-text-muted)',
              background: 'transparent',
              border: 'none',
              borderBottom: t.active
                ? '2px solid var(--color-primary)'
                : '2px solid transparent',
              marginBottom: -1,
              cursor: 'pointer',
            }}
          >
            {t.label}
            {t.active && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10.5,
                  color: 'var(--color-text-faint)',
                  fontWeight: 500,
                }}
              >
                · 2 runs
              </span>
            )}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 11.5,
            color: 'var(--color-text-faint)',
            fontWeight: 500,
          }}
        >
          Generated 2m ago · 1,184 tokens
        </span>
      </div>

      {/* Body */}
      <div
        className="flex"
        style={{ padding: 24, gap: 16, alignItems: 'flex-start' }}
      >
        {/* Main column */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {/* Floating Run-with-AI */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 4,
              zIndex: 5,
            }}
          >
            <button
              className="pmg-btn pmg-btn-primary"
              style={{ padding: '8px 14px', fontSize: 13, borderRadius: 999, boxShadow: 'var(--shadow-md)' }}
            >
              <Sparkles size={14} /> Run with AI
            </button>
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-text-faint)',
                fontWeight: 500,
              }}
            >
              (unsaved changes)
            </span>
          </div>

          <div className="pmg-card" style={{ padding: 36 }}>
            <div
              className="flex items-center"
              style={{ gap: 8, marginBottom: 18 }}
            >
              <span className="pmg-eyebrow">Draft output</span>
              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 999,
                  background: 'var(--color-text-faint)',
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'var(--color-text-faint)',
                }}
              >
                Markdown · Claude Sonnet 4
              </span>
            </div>

            <h2
              style={{
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: '-0.025em',
                marginBottom: 18,
                lineHeight: 1.15,
              }}
            >
              Series A launch — draft v1
            </h2>

            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.65,
                color: 'var(--color-text)',
                marginBottom: 14,
              }}
            >
              Today we're announcing that <strong>Throughline</strong> has raised
              an $18M Series A led by <strong>Index Ventures</strong>, with
              participation from our existing investors. The round closes a year
              in which we grew from a closed beta to <strong>100 paying teams</strong>{' '}
              — companies that ship customer-facing software and need their
              internal context to keep up.
            </p>

            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.65,
                color: 'var(--color-text)',
                marginBottom: 18,
              }}
            >
              We started Throughline because the work that makes a product feel
              coherent — the briefs, the decisions, the half-finished docs — is
              still scattered across five tools and three group chats. This
              round lets us double the engineering team, open a research office
              in New York, and continue investing in the parts of the product
              our customers tell us matter most: search that respects context,
              and a writing surface that earns its place in the workflow.
            </p>

            <div
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--color-text-muted)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              What we're talking about
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 20px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {[
                'A new pricing tier for teams above 50 seats, available in March.',
                'Native integrations with Linear, Notion, and Slack — generally available.',
                'Hiring across applied AI, design engineering, and customer engineering.',
              ].map((b) => (
                <li
                  key={b}
                  style={{
                    fontSize: 14.5,
                    lineHeight: 1.55,
                    color: 'var(--color-text)',
                    paddingLeft: 18,
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: 2,
                      top: 9,
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      background: 'var(--color-primary)',
                    }}
                  />
                  {b}
                </li>
              ))}
            </ul>

            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.65,
                color: 'var(--color-text)',
                marginBottom: 22,
              }}
            >
              If you're building software that more than a handful of people
              depend on, we'd like to hear from you. Read the full announcement
              on our blog, or reply to this note directly.
            </p>

            <div
              style={{
                paddingTop: 18,
                borderTop: '1px solid var(--color-border)',
              }}
            >
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: 'var(--color-text)',
                }}
              >
                — [Founder name]
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--color-text-faint)',
                  marginTop: 2,
                }}
              >
                Co-founder & CEO, Throughline
              </div>
            </div>
          </div>
        </div>

        {/* Right rail */}
        <aside
          style={{
            width: 360,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            flexShrink: 0,
          }}
        >
          {/* Refinements */}
          <div className="pmg-card" style={{ padding: 18 }}>
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 12 }}
            >
              <div className="flex items-center" style={{ gap: 8 }}>
                <Sparkles size={13} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.015em' }}>
                  Refinements
                </span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-faint)',
                  fontWeight: 500,
                }}
              >
                Suggested
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                'Make it 30% shorter',
                'Add a customer quote',
                'Reframe for tech press',
              ].map((s) => (
                <button
                  key={s}
                  className="flex items-center justify-between"
                  style={{
                    padding: '10px 12px',
                    background: 'transparent',
                    border: '1px solid transparent',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: 13,
                    color: 'var(--color-text)',
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background =
                      'var(--color-bg-sunken)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  <span>{s}</span>
                  <ChevronRight size={14} style={{ color: 'var(--color-text-faint)' }} />
                </button>
              ))}
            </div>
          </div>

          {/* Export */}
          <div className="pmg-card" style={{ padding: 18 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '-0.015em',
                marginBottom: 12,
              }}
            >
              Export
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { icon: <Copy size={14} />, label: 'Copy result' },
                { icon: <Download size={14} />, label: 'Download .md' },
                { icon: <Share2 size={14} />, label: 'Share link' },
              ].map((b) => (
                <button
                  key={b.label}
                  className="pmg-btn pmg-btn-secondary"
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    padding: '10px 12px',
                    fontSize: 13,
                  }}
                >
                  {b.icon}
                  <span>{b.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Run again with… */}
          <div className="pmg-card" style={{ padding: 18 }}>
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 12 }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.015em' }}>
                Run again with…
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--color-text-faint)',
                  fontWeight: 500,
                }}
              >
                Side-by-side
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { label: 'Claude Sonnet 4', meta: 'Anthropic · ★ Recommended', selected: true },
                { label: 'GPT-4o', meta: 'OpenAI · faster', selected: false },
                { label: 'Gemini 2.5 Pro', meta: 'Google · long context', selected: false },
              ].map((m) => (
                <label
                  key={m.label}
                  className="flex items-center"
                  style={{
                    gap: 10,
                    padding: '10px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: m.selected ? 'var(--color-primary-highlight)' : 'transparent',
                    border: m.selected
                      ? '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)'
                      : '1px solid transparent',
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      border: m.selected
                        ? '4px solid var(--color-primary)'
                        : '1.5px solid var(--color-border-strong)',
                      background: m.selected ? 'var(--color-bg-elev)' : 'var(--color-bg-elev)',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--color-text)',
                      }}
                    >
                      {m.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: 'var(--color-text-muted)',
                        marginTop: 1,
                      }}
                    >
                      {m.meta}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: '1px solid var(--color-border)',
              }}
            >
              <button
                className="pmg-btn pmg-btn-primary"
                style={{ width: '100%', padding: '11px 16px', fontSize: 13.5 }}
              >
                <Sparkles size={14} /> Run with AI
              </button>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: 'var(--color-text-faint)',
                  textAlign: 'center',
                  fontWeight: 500,
                }}
              >
                ⌘↵ to run · est. 1,200 tokens
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
export default ResultPanel;
