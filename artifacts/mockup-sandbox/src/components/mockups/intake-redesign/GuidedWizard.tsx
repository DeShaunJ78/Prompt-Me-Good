import { useState } from 'react';
import './_group.css';

export function GuidedWizard() {
  const [subject, setSubject] = useState("A lone fisherman");
  const [environment, setEnvironment] = useState("");
  const [action, setAction] = useState("");
  const [style, setStyle] = useState("");

  const currentStep = 2; // Fixed on step 2 for mockup purposes
  const totalSteps = 4;

  const handleChipClick = (text: string) => {
    setEnvironment(text);
  };

  const getPreviewText = () => {
    const parts = [subject, environment, action, style].filter(Boolean);
    if (parts.length === 0) return "Your prompt preview will appear here...";
    return parts.join(", ");
  };

  return (
    <div className="pmg-intake-root">
      <div className="pmg-tabs" role="tablist" aria-label="Photography mode">
        <button className="pmg-tab is-active">📷 Create New</button>
        <button className="pmg-tab">✨ Edit Photo</button>
        <button className="pmg-tab">🔍 Reverse Engineer</button>
      </div>

      <section style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <label className="pmg-section-label" style={{ margin: 0 }}>Step 2 of 4 — Environment</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pmg-mint)', opacity: 0.3 }}></div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pmg-mint)' }}></div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pmg-mint)', opacity: 0.3 }}></div>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--pmg-mint)', opacity: 0.3 }}></div>
          </div>
        </div>
        
        <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: '0 0 16px 0' }}>Where is this happening?</h2>
        
        <textarea
          className="pmg-textarea"
          rows={3}
          placeholder="e.g. misty pine forest at dawn, cyberpunk city street, abandoned warehouse..."
          value={environment}
          onChange={(e) => setEnvironment(e.target.value)}
          autoFocus
        />

        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button className="pmg-pill" onClick={() => handleChipClick("misty pine forest at dawn")}>misty pine forest</button>
          <button className="pmg-pill" onClick={() => handleChipClick("cyberpunk city street")}>cyberpunk city street</button>
          <button className="pmg-pill" onClick={() => handleChipClick("abandoned warehouse")}>abandoned warehouse</button>
          <button className="pmg-pill" onClick={() => handleChipClick("bright neon studio")}>bright neon studio</button>
        </div>
        
        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="pmg-btn pmg-btn-secondary" style={{ flex: 1 }}>
            ← Back
          </button>
          <button className="pmg-btn pmg-btn-primary" style={{ flex: 2 }}>
            Next Step →
          </button>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <label className="pmg-section-label">Live Preview</label>
        <div className="pmg-card" style={{ 
          minHeight: 80, 
          display: 'flex', 
          alignItems: 'flex-start',
          color: (subject || environment || action || style) ? 'var(--pmg-text)' : 'var(--pmg-text-faint)',
          fontSize: '0.95rem',
          lineHeight: 1.5,
          background: 'rgba(0,0,0,0.2)'
        }}>
          {getPreviewText()}
          <span style={{ color: 'var(--pmg-text-faint)', fontStyle: 'italic', marginLeft: 4 }}>
            {(!action && !style) ? "[...action, style]" : ""}
          </span>
        </div>
      </section>

      <section style={{ marginBottom: 12 }}>
        <div className="pmg-accordion">
          <button className="pmg-accordion-header" aria-expanded="false">
            <span>🎛️ Tune Your Image</span>
            <span className="pmg-accordion-hint">Camera · Lighting · more</span>
            <span aria-hidden="true">▾</span>
          </button>
        </div>
      </section>

      <section className="pmg-card" style={{ marginTop: 24, fontSize: '0.82rem', color: 'var(--pmg-text-faint)' }}>
        <strong style={{ color: 'var(--pmg-text-muted)' }}>Guided Wizard:</strong> Pacing-led progressive disclosure. 
        Breaks the prompt down step-by-step to prevent blank-page paralysis while teaching users how answers translate into a prompt.
      </section>
    </div>
  );
}
