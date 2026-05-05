import './_group.css';
import { Check, ChevronDown, Sparkles } from 'lucide-react';

export function Pricing() {
  const tiers = [
    {
      name: 'Free',
      tagline: 'For your first goals',
      price: '$0',
      priceSuffix: '/forever',
      sub: null,
      cta: 'Start free',
      ctaStyle: 'secondary' as const,
      features: [
        '20 runs/day',
        'Prompt Engine',
        'Save up to 10 prompts',
        'Community support',
        '1 seat',
      ],
      highlight: false,
    },
    {
      name: 'Pro',
      tagline: 'For working professionals',
      price: '$15',
      priceSuffix: '/mo, billed yearly',
      sub: '$19 billed monthly',
      cta: 'Upgrade to Pro',
      ctaStyle: 'primary' as const,
      features: [
        'Unlimited runs',
        'Prompt Engine + Photography Suite + Master Link',
        'Expert Command Center',
        'All models (Claude, GPT-4o, Gemini)',
        'Saved library',
        'Export to .md & share links',
        'Email support',
      ],
      highlight: true,
    },
    {
      name: 'Founding Member',
      tagline: 'Pay once. Keep forever.',
      price: '$199',
      priceSuffix: 'one-time',
      sub: null,
      cta: 'Become a founder',
      ctaStyle: 'secondary' as const,
      badge: 'Limited',
      features: [
        'Everything in Pro',
        'Forever',
        'Founder badge in your library',
        'Priority support (24h response)',
        'Early access to new modes',
        'Vote on the roadmap',
      ],
      highlight: false,
    },
  ];

  const compareRows: Array<{ label: string; free: string | boolean; pro: string | boolean; founder: string | boolean }> = [
    { label: 'Daily runs', free: '20', pro: 'Unlimited', founder: 'Unlimited' },
    { label: 'Modes', free: 'Prompt Engine', pro: 'All 3 modes', founder: 'All 3 modes' },
    { label: 'Models', free: 'GPT-4o mini', pro: 'Claude, GPT-4o, Gemini', founder: 'Claude, GPT-4o, Gemini' },
    { label: 'Expert tools', free: false, pro: true, founder: true },
    { label: 'Team seats', free: '1', pro: '3', founder: '5' },
    { label: 'Support', free: 'Community', pro: 'Email', founder: 'Priority (24h)' },
  ];

  const faqs = [
    'Can I switch plans anytime?',
    'What happens to my saved prompts if I downgrade?',
    'Is the Founding Member tier really lifetime?',
  ];

  const renderCell = (v: string | boolean) => {
    if (v === true) return <Check size={16} style={{ color: 'var(--color-primary)' }} strokeWidth={2.5} />;
    if (v === false) return <span style={{ color: 'var(--color-text-faint)' }}>—</span>;
    return <span style={{ color: 'var(--color-text)', fontSize: 13 }}>{v}</span>;
  };

  return (
    <div className="pmg-chassis" style={{ minHeight: 900, width: '100%', padding: '56px 80px 80px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', maxWidth: 720, margin: '0 auto 40px' }}>
        <div className="pmg-eyebrow" style={{ marginBottom: 14 }}>Pricing</div>
        <h1 style={{ fontSize: 44, lineHeight: 1.05, margin: '0 0 16px' }}>
          Pay for the prompts you keep.
        </h1>
        <p style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--color-text-muted)', maxWidth: 620, margin: '0 auto 24px' }}>
          Start free. Upgrade when the workstation pays for itself — usually inside the first week.
        </p>
        {/* Billing toggle */}
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--color-bg-elev)',
            border: '1px solid var(--color-border)',
            borderRadius: 999,
            padding: 4,
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <button
            className="pmg-btn"
            style={{
              background: 'transparent',
              color: 'var(--color-text-muted)',
              padding: '8px 18px',
              borderRadius: 999,
              fontSize: 13,
              border: 'none',
            }}
          >
            Monthly
          </button>
          <button
            className="pmg-btn"
            style={{
              background: 'var(--color-text)',
              color: 'var(--color-text-inverse)',
              padding: '8px 18px',
              borderRadius: 999,
              fontSize: 13,
              border: 'none',
            }}
          >
            Yearly <span style={{ opacity: 0.7, marginLeft: 4 }}>–20%</span>
          </button>
        </div>
      </div>

      {/* Tier cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 48 }}>
        {tiers.map((t) => (
          <div
            key={t.name}
            className="pmg-card"
            style={{
              padding: 32,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              border: t.highlight ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
              boxShadow: t.highlight ? 'var(--shadow-md)' : 'var(--shadow-sm)',
            }}
          >
            {t.highlight && (
              <div
                style={{
                  position: 'absolute',
                  top: -12,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--color-primary)',
                  color: 'var(--color-text-inverse)',
                  padding: '4px 12px',
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Sparkles size={11} /> Most popular
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
              <h3 style={{ fontSize: 18, margin: 0 }}>{t.name}</h3>
              {(t as any).badge && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: 'var(--color-primary-hover)',
                    background: 'var(--color-primary-highlight)',
                    padding: '2px 8px',
                    borderRadius: 999,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                  }}
                >
                  {(t as any).badge}
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 18 }}>{t.tagline}</div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.025em' }}>{t.price}</span>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{t.priceSuffix}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-faint)', marginBottom: 20, minHeight: 16 }}>
              {t.sub || ''}
            </div>

            <button
              className={`pmg-btn ${t.ctaStyle === 'primary' ? 'pmg-btn-primary' : 'pmg-btn-secondary'}`}
              style={{ width: '100%', marginBottom: 22 }}
            >
              {t.cta}
            </button>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {t.features.map((f) => (
                <li key={f} style={{ display: 'flex', gap: 10, fontSize: 13.5, color: 'var(--color-text)', lineHeight: 1.45 }}>
                  <Check size={15} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 2 }} strokeWidth={2.5} />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Comparison table */}
      <div className="pmg-card" style={{ padding: '8px 24px', marginBottom: 32 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ textAlign: 'left', padding: '14px 8px', fontWeight: 600, fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Feature</th>
              <th style={{ textAlign: 'left', padding: '14px 8px', fontWeight: 600, fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', width: 180 }}>Free</th>
              <th style={{ textAlign: 'left', padding: '14px 8px', fontWeight: 600, fontSize: 12, color: 'var(--color-primary-hover)', letterSpacing: '0.04em', textTransform: 'uppercase', width: 220 }}>Pro</th>
              <th style={{ textAlign: 'left', padding: '14px 8px', fontWeight: 600, fontSize: 12, color: 'var(--color-text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', width: 200 }}>Founder</th>
            </tr>
          </thead>
          <tbody>
            {compareRows.map((r, i) => (
              <tr key={r.label} style={{ borderBottom: i === compareRows.length - 1 ? 'none' : '1px solid var(--color-border)' }}>
                <td style={{ padding: '12px 8px', fontWeight: 500 }}>{r.label}</td>
                <td style={{ padding: '12px 8px' }}>{renderCell(r.free)}</td>
                <td style={{ padding: '12px 8px' }}>{renderCell(r.pro)}</td>
                <td style={{ padding: '12px 8px' }}>{renderCell(r.founder)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* FAQ */}
      <div className="pmg-card" style={{ padding: '4px 24px' }}>
        {faqs.map((q, i) => (
          <div
            key={q}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 8px',
              borderBottom: i === faqs.length - 1 ? 'none' : '1px solid var(--color-border)',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text)' }}>{q}</span>
            <ChevronDown size={16} style={{ color: 'var(--color-text-muted)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
