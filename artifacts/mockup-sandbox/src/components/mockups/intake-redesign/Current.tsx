import './_group.css';

export function Current() {
  return (
    <div className="pmg-intake-root">
      <div className="pmg-tabs" role="tablist" aria-label="Photography mode">
        <button className="pmg-tab is-active">📷 Create New</button>
        <button className="pmg-tab">✨ Edit Photo</button>
        <button className="pmg-tab">🔍 Reverse Engineer</button>
      </div>

      <section style={{ marginBottom: 16 }}>
        <label className="pmg-section-label" htmlFor="goal">Describe Your Image</label>
        <textarea
          id="goal"
          className="pmg-textarea"
          rows={4}
          placeholder="A woman walking through rainy Tokyo at night, cinematic, neon reflections, 35mm film look…"
        />
        <button className="pmg-btn pmg-btn-primary pmg-btn-full" style={{ marginTop: 10 }}>
          ✨ Build My Image Prompt
        </button>
      </section>

      <section style={{ marginBottom: 12 }}>
        <div className="pmg-accordion">
          <button className="pmg-accordion-header" aria-expanded="false">
            <span>🎛️ Tune Your Image</span>
            <span className="pmg-accordion-hint">Style · Camera · Lighting · more</span>
            <span aria-hidden="true">▾</span>
          </button>
        </div>
      </section>

      <section style={{ marginBottom: 12 }}>
        <div className="pmg-accordion">
          <button className="pmg-accordion-header" aria-expanded="false">
            <span>💡 Lighting</span>
            <span className="pmg-accordion-hint">soft · golden · neon · studio</span>
            <span aria-hidden="true">▾</span>
          </button>
        </div>
      </section>

      <section className="pmg-card" style={{ marginTop: 18, fontSize: '0.82rem', color: 'var(--pmg-text-faint)' }}>
        <strong style={{ color: 'var(--pmg-text-muted)' }}>Today's intake:</strong> one freeform textarea →
        the user types whatever they want → backend enhancer (now layered)
        unpacks it into Subject / Environment / Camera / Lighting / Style.
      </section>
    </div>
  );
}
