import './_group.css';
import { Sparkles, Camera, GitBranch, ArrowRight } from 'lucide-react';

type Mode = {
  icon: React.ReactNode;
  title: string;
  desc: string;
};

const modes: Mode[] = [
  {
    icon: <Sparkles size={18} strokeWidth={1.75} />,
    title: 'Prompt Engine',
    desc: 'Turn any goal into a clear, model-ready prompt. The default mode for everything text.',
  },
  {
    icon: <Camera size={18} strokeWidth={1.75} />,
    title: 'Photography Suite',
    desc: 'Compose image prompts with camera, lens, and lighting controls. Built for visual work that needs precision.',
  },
  {
    icon: <GitBranch size={18} strokeWidth={1.75} />,
    title: 'Master Link',
    desc: 'Chain prompts into a multi-step plan. For projects that take more than one round to land.',
  },
];

const steps = [
  {
    n: '01',
    title: 'Tell us your goal',
    desc: 'Describe what you want, in plain language.',
  },
  {
    n: '02',
    title: 'Get a starter blueprint',
    desc: 'We draft the prompt and a 3-step plan, instantly.',
  },
  {
    n: '03',
    title: 'Open your Workstation',
    desc: 'Refine, iterate, and run with the model that fits.',
  },
];

const testimonials = [
  {
    initials: 'MC',
    name: 'Maya Chen',
    title: 'Head of Comms, Throughline',
    company: 'THROUGHLINE',
    quote:
      'We replaced four prompt templates with one workstation. Our launch comms now feel written by us, not by a model.',
  },
  {
    initials: 'DP',
    name: 'Diego Park',
    title: 'Founding Designer, Northwind',
    company: 'NORTHWIND',
    quote:
      "The Photography Suite's lens controls are the difference between a stock-looking image and a brand-quality one.",
  },
  {
    initials: 'PS',
    name: 'Priya Shah',
    title: 'Product Lead, Globex',
    company: 'GLOBEX',
    quote:
      'Master Link turned a six-prompt workflow into a single, reproducible plan our team actually follows.',
  },
];

export function Marketing() {
  return (
    <div
      className="pmg-chassis"
      style={{
        width: '100%',
        minHeight: '100vh',
        padding: '72px 64px',
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ maxWidth: 1152, margin: '0 auto' }}>
        {/* BLOCK 1 — Modes */}
        <section>
          <div style={{ maxWidth: 720, marginBottom: 40 }}>
            <div className="pmg-eyebrow" style={{ marginBottom: 14 }}>
              Modes
            </div>
            <h2
              style={{
                fontSize: 36,
                lineHeight: 1.08,
                margin: 0,
                marginBottom: 14,
              }}
            >
              Three modes, one workstation.
            </h2>
            <p
              style={{
                fontSize: 16,
                lineHeight: 1.55,
                color: 'var(--color-text-muted)',
                margin: 0,
              }}
            >
              Each mode adapts the workstation to a different kind of work —
              without ever leaving your goal.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
            }}
          >
            {modes.map((m) => (
              <div
                key={m.title}
                className="pmg-card"
                style={{ padding: 28, display: 'flex', flexDirection: 'column' }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--color-primary-highlight)',
                    color: 'var(--color-primary)',
                    marginBottom: 18,
                  }}
                >
                  {m.icon}
                </div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    margin: 0,
                    marginBottom: 8,
                  }}
                >
                  {m.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'var(--color-text-muted)',
                    margin: 0,
                    marginBottom: 20,
                    flex: 1,
                  }}
                >
                  {m.desc}
                </p>
                <a
                  href="#"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  See how <ArrowRight size={13} strokeWidth={2} />
                </a>
              </div>
            ))}
          </div>
        </section>

        <div className="pmg-divider" style={{ margin: '72px 0' }} />

        {/* BLOCK 2 — How it works */}
        <section>
          <div style={{ maxWidth: 720, marginBottom: 40 }}>
            <div className="pmg-eyebrow" style={{ marginBottom: 14 }}>
              How it works
            </div>
            <h2
              style={{
                fontSize: 36,
                lineHeight: 1.08,
                margin: 0,
              }}
            >
              Earn the Workstation in three steps.
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 32,
            }}
          >
            {steps.map((s) => (
              <div key={s.n} style={{ paddingTop: 8 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 44,
                    fontWeight: 800,
                    letterSpacing: '-0.04em',
                    color: 'var(--color-primary)',
                    opacity: 0.55,
                    lineHeight: 1,
                    marginBottom: 18,
                  }}
                >
                  {s.n}
                </div>
                <h3
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    margin: 0,
                    marginBottom: 8,
                  }}
                >
                  {s.title}
                </h3>
                <p
                  style={{
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: 'var(--color-text-muted)',
                    margin: 0,
                    maxWidth: 280,
                  }}
                >
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="pmg-divider" style={{ margin: '72px 0' }} />

        {/* BLOCK 3 — Social proof */}
        <section>
          <div style={{ maxWidth: 720, marginBottom: 40 }}>
            <div className="pmg-eyebrow" style={{ marginBottom: 14 }}>
              From the workstation
            </div>
            <h2
              style={{
                fontSize: 36,
                lineHeight: 1.08,
                margin: 0,
              }}
            >
              Used by teams who care about how they ask.
            </h2>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
            }}
          >
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="pmg-card"
                style={{
                  padding: 28,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    background: 'var(--color-bg-sunken)',
                    color: 'var(--color-text)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    border: '1px solid var(--color-border)',
                    marginBottom: 18,
                  }}
                >
                  {t.initials}
                </div>
                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.55,
                    fontStyle: 'italic',
                    color: 'var(--color-text)',
                    margin: 0,
                    marginBottom: 24,
                    flex: 1,
                  }}
                >
                  “{t.quote}”
                </p>
                <div
                  style={{
                    paddingTop: 16,
                    borderTop: '1px solid var(--color-border)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--color-text)',
                    }}
                  >
                    {t.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                      marginTop: 2,
                      marginBottom: 10,
                    }}
                  >
                    {t.title}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      color: 'var(--color-text-faint)',
                    }}
                  >
                    {t.company}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Marketing;
