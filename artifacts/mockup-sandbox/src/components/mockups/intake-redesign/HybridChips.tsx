import React, { useState } from 'react';
import './_group.css';

export function HybridChips() {
  const [prompt, setPrompt] = useState("a woman walking through rainy Tokyo at night, neon reflections");
  const [activeChip, setActiveChip] = useState<string | null>("Camera");

  const chips = ["Subject", "Environment", "Action", "Camera", "Lighting", "Style"];
  
  const cameraSuggestions = [
    "35mm film", "medium-format portrait", "GoPro wide", 
    "drone overhead", "macro lens", "tilt-shift",
    "polaroid", "fisheye lens"
  ];

  const handleSuggestionClick = (suggestion: string) => {
    const separator = prompt.trim() === "" ? "" : ", ";
    setPrompt(prompt + separator + suggestion);
    setActiveChip(null);
  };

  return (
    <div className="pmg-intake-root">
      <div className="pmg-tabs" role="tablist" aria-label="Photography mode">
        <button className="pmg-tab is-active">📷 Create New</button>
        <button className="pmg-tab">✨ Edit Photo</button>
        <button className="pmg-tab">🔍 Reverse Engineer</button>
      </div>

      <section style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <label className="pmg-section-label" htmlFor="goal" style={{ margin: 0 }}>Describe Your Image</label>
        </div>

        <div style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 8,
          marginBottom: 4,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}>
          {chips.map(chip => (
            <button 
              key={chip}
              className="pmg-pill"
              aria-pressed={activeChip === chip}
              onClick={() => setActiveChip(activeChip === chip ? null : chip)}
              style={{ whiteSpace: 'nowrap' }}
            >
              + {chip}
            </button>
          ))}
        </div>

        {activeChip === "Camera" && (
          <div style={{
            background: 'var(--pmg-surface-2)',
            border: '1px solid var(--pmg-border)',
            borderRadius: 10,
            padding: 12,
            marginBottom: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6
          }}>
            <div style={{ width: '100%', fontSize: '0.8rem', color: 'var(--pmg-text-muted)', marginBottom: 4, fontWeight: 600 }}>
              Add a camera style:
            </div>
            {cameraSuggestions.map(s => (
              <button 
                key={s}
                className="pmg-btn-secondary"
                style={{
                  fontSize: '0.8rem',
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid var(--pmg-divider)',
                  background: 'rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  color: 'var(--pmg-text-muted)',
                  fontFamily: 'var(--pmg-font)'
                }}
                onClick={() => handleSuggestionClick(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <textarea
          id="goal"
          className="pmg-textarea"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A woman walking through rainy Tokyo at night, cinematic, neon reflections, 35mm film look…"
        />
        <div className="pmg-hint" style={{ marginTop: 8 }}>
          Tap a chip to scaffold your prompt, or just write freely.
        </div>
        
        <button className="pmg-btn pmg-btn-primary pmg-btn-full" style={{ marginTop: 16 }}>
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
    </div>
  );
}
