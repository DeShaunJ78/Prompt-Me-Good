import './_group.css';
import { ChevronDown, ArrowLeft, Camera, Aperture, Sun, Palette, Grid3x3, Focus, Heart, Sparkles, Bookmark } from 'lucide-react';

type SegProps = { label: string; options: string[]; selectedIndex: number; icon?: React.ReactNode };

function Segmented({ label, options, selectedIndex, icon }: SegProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {icon && <span style={{ color: 'var(--color-text-muted)' }}>{icon}</span>}
        <span className="pmg-eyebrow" style={{ letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div
        className="inline-flex w-full p-0.5"
        style={{
          background: 'var(--color-bg-sunken)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        {options.map((opt, i) => {
          const selected = i === selectedIndex;
          return (
            <button
              key={opt}
              className="flex-1 text-[12.5px] font-medium px-2.5 py-1.5"
              style={{
                borderRadius: 4,
                background: selected ? 'var(--color-bg-elev)' : 'transparent',
                color: selected ? 'var(--color-text)' : 'var(--color-text-muted)',
                boxShadow: selected ? '0 1px 2px rgba(36,33,28,0.06)' : 'none',
                border: selected ? '1px solid var(--color-border)' : '1px solid transparent',
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TILES = [
  { v: 'v1', from: '#3b3a36', to: '#1f1e1c', accent: '#d4a574' },
  { v: 'v2', from: '#5a4a3a', to: '#2d241c', accent: '#e8c39a' },
  { v: 'v3', from: '#2c3a3a', to: '#141d1e', accent: '#a8b8b0' },
  { v: 'v4', from: '#4a3d34', to: '#241d18', accent: '#c89070' },
];

export function PhotoSuite() {
  return (
    <div
      className="pmg-chassis"
      style={{ width: 1280, minHeight: 900, padding: '20px 28px 28px' }}
    >
      {/* App bar */}
      <div className="flex items-center justify-between" style={{ paddingBottom: 16 }}>
        <div className="flex items-center gap-4">
          <button
            className="flex items-center gap-1.5 text-[13px]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <ArrowLeft size={14} /> Workstation
          </button>
          <div style={{ width: 1, height: 16, background: 'var(--color-border)' }} />
          <button
            className="flex items-center gap-1.5 text-[13px] font-semibold px-2.5 py-1.5"
            style={{
              background: 'var(--color-primary-highlight)',
              color: 'var(--color-primary-hover)',
              borderRadius: 999,
              border: '1px solid color-mix(in srgb, var(--color-primary) 18%, transparent)',
            }}
          >
            <Camera size={13} /> Photography Suite
            <ChevronDown size={13} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="pmg-mono" style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>autosaved · 12:04</span>
          <div
            style={{
              width: 28, height: 28, borderRadius: 999,
              background: '#24211c', color: '#f8f7f4',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 600,
            }}
          >DJ</div>
        </div>
      </div>

      {/* Sub-header */}
      <div style={{ paddingBottom: 20 }}>
        <h1 style={{ fontSize: 26, lineHeight: 1.1, margin: 0 }}>Photography Suite</h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginTop: 6 }}>
          Compose precise image prompts with camera, lens, and lighting controls.
        </p>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '720px 1fr', gap: 24 }}>
        {/* LEFT */}
        <div className="flex flex-col gap-5">
          {/* Goal card */}
          <div className="pmg-card" style={{ padding: 18 }}>
            <div className="flex items-center justify-between mb-2.5">
              <label className="pmg-eyebrow">Describe the photo</label>
              <span className="pmg-mono" style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>
                42 / 600
              </span>
            </div>
            <div
              style={{
                fontSize: 14.5,
                lineHeight: 1.55,
                color: 'var(--color-text)',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                minHeight: 96,
              }}
            >
              Hero shot of an espresso bar in a converted Brooklyn warehouse. Morning light,
              steam rising from a freshly pulled shot, baristas working in soft focus background.
            </div>

            {/* Style chips */}
            <div className="mt-4">
              <div className="pmg-eyebrow mb-2">Style</div>
              <div className="flex flex-wrap gap-1.5">
                {['Editorial', 'Product', 'Lifestyle', 'Studio', 'Cinematic', 'Documentary'].map((s, i) => {
                  const selected = i === 0;
                  return (
                    <button
                      key={s}
                      className="text-[12.5px] font-medium"
                      style={{
                        padding: '5px 11px',
                        borderRadius: 999,
                        background: selected ? 'var(--color-primary-highlight)' : 'var(--color-bg-elev)',
                        color: selected ? 'var(--color-primary-hover)' : 'var(--color-text-muted)',
                        border: selected
                          ? '1px solid color-mix(in srgb, var(--color-primary) 22%, transparent)'
                          : '1px solid var(--color-border)',
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Camera controls */}
          <div className="pmg-card" style={{ padding: 18 }}>
            <div className="flex items-center justify-between mb-4">
              <div className="pmg-eyebrow">Camera</div>
              <button
                className="text-[12px] font-medium"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Reset to defaults
              </button>
            </div>
            <div className="grid grid-cols-2" style={{ gap: '18px 24px' }}>
              <Segmented label="Aspect ratio" icon={<Grid3x3 size={12} />} options={['1:1', '4:5', '16:9', '9:16']} selectedIndex={2} />
              <Segmented label="Lens" icon={<Aperture size={12} />} options={['35mm', '50mm', '85mm', '135mm']} selectedIndex={1} />
              <Segmented label="Lighting" icon={<Sun size={12} />} options={['Natural', 'Studio', 'Golden hour', 'Moody']} selectedIndex={0} />
              <Segmented label="Mood" icon={<Palette size={12} />} options={['Warm', 'Cool', 'Neutral', 'High contrast']} selectedIndex={0} />
              <Segmented label="Composition" icon={<Grid3x3 size={12} />} options={['Rule of thirds', 'Centered', 'Negative space']} selectedIndex={0} />
              <Segmented label="Depth" icon={<Focus size={12} />} options={['Shallow', 'Deep', 'Tilt-shift']} selectedIndex={0} />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="pmg-btn pmg-btn-primary">
              <Sparkles size={14} /> Generate 4 variations
            </button>
            <button className="pmg-btn pmg-btn-secondary">
              <Bookmark size={14} /> Save preset
            </button>
            <span className="pmg-mono ml-auto" style={{ fontSize: 11, color: 'var(--color-text-faint)' }}>
              ⌘ ↵ to generate
            </span>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="pmg-eyebrow">Latest results · 2s ago</span>
            <button className="text-[12px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
              View all
            </button>
          </div>

          <div className="grid grid-cols-2" style={{ gap: 12 }}>
            {TILES.map((t) => (
              <div
                key={t.v}
                style={{
                  position: 'relative',
                  aspectRatio: '16 / 11',
                  borderRadius: 'var(--radius-md)',
                  background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                  border: '1px solid var(--color-border-strong)',
                  overflow: 'hidden',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div
                  style={{
                    position: 'absolute', inset: 0,
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
                  }}
                />
                {/* faux subject */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '18%',
                    left: '14%',
                    width: '40%',
                    height: '36%',
                    background: t.accent,
                    opacity: 0.55,
                    borderRadius: 4,
                    filter: 'blur(2px)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '24%',
                    right: '18%',
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: t.accent,
                    opacity: 0.85,
                    boxShadow: `0 0 24px ${t.accent}66`,
                  }}
                />
                {/* badge */}
                <div
                  className="pmg-mono"
                  style={{
                    position: 'absolute', top: 8, left: 8,
                    background: 'rgba(20,18,15,0.72)',
                    color: '#f8f7f4',
                    fontSize: 10,
                    padding: '2px 7px',
                    borderRadius: 4,
                    backdropFilter: 'blur(4px)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {t.v}
                </div>
                {/* heart */}
                <button
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 26, height: 26,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(20,18,15,0.55)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 999,
                    color: t.v === 'v2' ? '#ff7e7e' : '#f8f7f4',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <Heart size={13} fill={t.v === 'v2' ? '#ff7e7e' : 'transparent'} />
                </button>
                {/* meta */}
                <div
                  className="pmg-mono"
                  style={{
                    position: 'absolute', bottom: 8, left: 8,
                    fontSize: 10,
                    color: 'rgba(248,247,244,0.78)',
                    letterSpacing: '0.04em',
                  }}
                >
                  16:9 · 50mm · ƒ2.0
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-1">
            <button className="pmg-btn pmg-btn-secondary" style={{ flex: 1 }}>
              Iterate on selected
            </button>
            <button className="pmg-btn pmg-btn-ghost">
              Open in workstation
            </button>
          </div>

          <div
            className="pmg-card"
            style={{ padding: 12, marginTop: 4, display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <div
              style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'var(--color-primary-highlight)',
                color: 'var(--color-primary-hover)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Sparkles size={14} />
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
              <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>Tip.</span>{' '}
              Pin a variation to lock its lighting and mood for the next iteration.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PhotoSuite;
