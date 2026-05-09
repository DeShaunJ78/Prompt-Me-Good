import React, { useState } from 'react';
import './_group.css';

export function GuidedFields() {
  const [isFreeform, setIsFreeform] = useState(false);

  return (
    <div className="pmg-intake-root">
      <div className="pmg-tabs" role="tablist" aria-label="Photography mode">
        <button className="pmg-tab is-active">📷 Create New</button>
        <button className="pmg-tab">✨ Edit Photo</button>
        <button className="pmg-tab">🔍 Reverse Engineer</button>
      </div>

      <section style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>Describe Your Image</h2>
          <button 
            className="pmg-btn pmg-btn-ghost" 
            onClick={() => setIsFreeform(!isFreeform)}
            style={{ margin: 0, padding: '2px 6px' }}
          >
            ↻ {isFreeform ? 'Back to guided fields' : 'Or write freeform instead'}
          </button>
        </div>

        {isFreeform ? (
          <div style={{ marginBottom: 16 }}>
             <label className="pmg-section-label" htmlFor="freeform">Freeform Prompt</label>
             <textarea
               id="freeform"
               className="pmg-textarea"
               rows={6}
               placeholder="A woman walking through rainy Tokyo at night, cinematic, neon reflections, 35mm film look…"
             />
             <div className="pmg-hint">Type whatever you want, we'll sort it out.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: 16 }}>
            <div>
              <label className="pmg-section-label" htmlFor="subject">Subject</label>
              <input
                id="subject"
                className="pmg-input"
                placeholder="a woman in a red trench coat"
              />
              <div className="pmg-hint">Who or what is the main focus?</div>
            </div>

            <div>
              <label className="pmg-section-label" htmlFor="environment">Environment</label>
              <input
                id="environment"
                className="pmg-input"
                placeholder="rainy Tokyo street at night"
              />
              <div className="pmg-hint">Where is this happening?</div>
            </div>

            <div>
              <label className="pmg-section-label" htmlFor="action">Action / Mood</label>
              <input
                id="action"
                className="pmg-input"
                placeholder="walking, looking up at neon signs"
              />
              <div className="pmg-hint">What are they doing? How does it feel?</div>
            </div>

            <div>
              <label className="pmg-section-label" htmlFor="style">Style</label>
              <select id="style" className="pmg-select">
                <option value="">Select a style (optional)</option>
                <option value="cinematic">Cinematic</option>
                <option value="editorial">Editorial</option>
                <option value="photoreal">Photoreal</option>
                <option value="anime">Anime</option>
                <option value="polaroid">Polaroid</option>
                <option value="studio">Studio</option>
              </select>
            </div>
          </div>
        )}

        <button className="pmg-btn pmg-btn-primary pmg-btn-full">
          ✨ Build My Image Prompt
        </button>
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
    </div>
  );
}
