import './_group.css';
import { ArrowRight, Check, Lock, Sparkles } from 'lucide-react';

export default function HomepageHero() {
  return (
    <div
      className="pmg-chassis"
      style={{ minHeight: 900, width: '100%', background: 'var(--color-bg)' }}
    >
      {/* Sticky Nav */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'rgba(247,246,242,0.85)',
          backdropFilter: 'saturate(180%) blur(12px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
            padding: '14px 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              color: 'var(--color-primary)',
              fontWeight: 700,
              fontSize: 17,
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: 'var(--color-primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
              }}
            >
              <Sparkles size={13} strokeWidth={2.5} />
            </span>
            PromptMeGood
          </div>

          <nav
            style={{
              display: 'flex',
              gap: 28,
              fontSize: 14,
              color: 'var(--color-text-muted)',
              fontWeight: 500,
            }}
          >
            <a style={{ color: 'var(--color-text)' }}>Workstation</a>
            <a>Photography</a>
            <a>Marketplace</a>
            <a>Pricing</a>
          </nav>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="pmg-btn pmg-btn-ghost">Sign in</button>
            <button className="pmg-btn pmg-btn-primary">Start free</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        style={{
          maxWidth: 880,
          margin: '0 auto',
          padding: '56px 32px 32px',
          textAlign: 'center',
        }}
      >
        <span
          className="pmg-chip"
          style={{ marginBottom: 22 }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: 'var(--color-primary)',
              display: 'inline-block',
            }}
          />
          Earn the Workstation
        </span>

        <h1
          style={{
            fontSize: 52,
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: '0 0 18px',
            color: 'var(--color-text)',
          }}
        >
          Stop guessing what to ask AI.
          <br />
          Start with a goal.
        </h1>

        <p
          style={{
            fontSize: 18,
            lineHeight: 1.55,
            color: 'var(--color-text-muted)',
            maxWidth: 660,
            margin: '0 auto 32px',
          }}
        >
          Tell us what you're trying to do. We'll write the prompt that earns
          the result — and unlock your Workstation when you're ready.
        </p>

        {/* Goal capture card */}
        <div
          className="pmg-card"
          style={{ padding: 24, textAlign: 'left', marginBottom: 20 }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-text)',
              }}
            >
              What are you trying to accomplish?
            </label>
            <span
              className="pmg-mono"
              style={{ color: 'var(--color-text-faint)', fontSize: 11 }}
            >
              prompt-engine · v3
            </span>
          </div>

          <div
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '14px 14px',
              background: 'var(--color-bg)',
              minHeight: 92,
              fontSize: 15,
              color: 'var(--color-text)',
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: 'var(--color-text-faint)' }}>
              Try: Draft a launch announcement for our Series A round…
            </span>
            <span
              style={{
                display: 'inline-block',
                width: 1.5,
                height: 16,
                background: 'var(--color-primary)',
                marginLeft: 2,
                verticalAlign: 'middle',
                animation: 'none',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 14,
              flexWrap: 'wrap',
            }}
          >
            {[
              'Write a Series A announcement',
              'Plan a 3-week customer onboarding flow',
              'Photo: hero shot of an espresso bar at golden hour',
            ].map((c, i) => (
              <button
                key={c}
                style={{
                  fontSize: 12.5,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1px solid var(--color-border-strong)',
                  background:
                    i === 0
                      ? 'var(--color-primary-highlight)'
                      : 'var(--color-bg-elev)',
                  color:
                    i === 0
                      ? 'var(--color-primary-hover)'
                      : 'var(--color-text-muted)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* CTA row */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <button
            className="pmg-btn pmg-btn-primary"
            style={{ padding: '12px 18px', fontSize: 14.5 }}
          >
            Generate Starter Blueprint
            <ArrowRight size={15} strokeWidth={2.5} />
          </button>
          <button className="pmg-btn pmg-btn-ghost">See how it works</button>
        </div>

        <div
          style={{
            marginTop: 12,
            fontSize: 12.5,
            color: 'var(--color-text-faint)',
          }}
        >
          No signup required for your first run.
        </div>
      </section>

      {/* Seam rail */}
      <section style={{ padding: '8px 32px 0' }}>
        <div
          style={{
            maxWidth: 1100,
            margin: '0 auto',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            background: 'var(--color-bg-elev)',
            padding: '14px 20px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 0,
            position: 'relative',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {[
            {
              label: 'Workstation unlocks after first run',
              done: true,
            },
            { label: 'Photography Suite + Master Link', done: false },
            { label: 'Expert Command Center', done: false },
          ].map((item, i) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                paddingLeft: i === 0 ? 0 : 20,
                borderLeft:
                  i === 0 ? 'none' : '1px solid var(--color-border)',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: item.done
                    ? 'var(--color-primary)'
                    : 'var(--color-bg-sunken)',
                  color: item.done ? '#fff' : 'var(--color-text-faint)',
                  border: item.done
                    ? 'none'
                    : '1px solid var(--color-border)',
                }}
              >
                {item.done ? (
                  <Check size={13} strokeWidth={3} />
                ) : (
                  <Lock size={11} strokeWidth={2.5} />
                )}
              </span>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: item.done
                      ? 'var(--color-text)'
                      : 'var(--color-text-muted)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {item.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-faint)',
                    marginTop: 2,
                  }}
                >
                  {item.done
                    ? 'Ready · earned'
                    : i === 1
                      ? 'Unlocks at run 2'
                      : 'Power features · later'}
                </div>
              </div>
            </div>
          ))}
          <div
            style={{
              position: 'absolute',
              left: 24,
              right: 24,
              bottom: -1,
              height: 2,
              background:
                'linear-gradient(90deg, transparent, var(--color-primary), transparent)',
              opacity: 0.5,
              borderRadius: 999,
            }}
          />
        </div>

        {/* Trust strip */}
        <div
          style={{
            maxWidth: 1100,
            margin: '36px auto 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
          }}
        >
          {['ACME', 'NORTHWIND', 'GLOBEX', 'INITECH', 'HOOLI'].map(
            (name, i, arr) => (
              <div
                key={name}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  color: 'var(--color-text-faint)',
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: '0.18em',
                  borderRight:
                    i < arr.length - 1
                      ? '1px solid var(--color-border)'
                      : 'none',
                  padding: '6px 0',
                }}
              >
                {name}
              </div>
            )
          )}
        </div>
      </section>
    </div>
  );
}
