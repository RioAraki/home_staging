// Lightweight gallery for the auto-extracted DXF block SVGs under
// app/public/cards/modules/. Lets the player eyeball every module the
// DXF pipeline pulled out of the CAD library and copy a module name
// into furniture_visual.yaml when wiring a card.
//
// Access via the `#/modules` hash route from App.tsx.

import { useState } from 'react';

const moduleUrls = import.meta.glob<string>(
  '/public/cards/modules/*.svg',
  { eager: true, import: 'default', query: '?url' },
) as Record<string, string>;

interface Mod {
  name: string;            // filename without .svg
  url: string;
}

const ALL: Mod[] = Object.entries(moduleUrls)
  .map(([absPath, url]) => {
    const filename = absPath.split('/').pop() ?? '';
    return { name: filename.replace(/\.svg$/, ''), url };
  })
  .sort((a, b) => a.name.localeCompare(b.name, 'zh'));

export function ModuleGallery() {
  const [query, setQuery] = useState('');
  const [size, setSize] = useState(120);

  const filtered = query.trim()
    ? ALL.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
    : ALL;

  return (
    <div style={{ padding: 20, background: 'var(--bg)', minHeight: '100vh' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontFamily: "'Patrick Hand', sans-serif" }}>
          📦 Module Library
        </h1>
        <span style={{ color: 'var(--pen-soft)' }}>
          {filtered.length} / {ALL.length}
        </span>
        <input
          type="search"
          placeholder="filter by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '6px 10px',
            background: 'transparent',
            border: '1px dashed var(--pen-soft)',
            color: 'var(--pen)',
            borderRadius: 4,
            fontFamily: "'Patrick Hand', sans-serif",
            fontSize: '1rem',
          }}
        />
        <label style={{ color: 'var(--pen-soft)', display: 'flex', gap: 6, alignItems: 'center' }}>
          size
          <input
            type="range"
            min={60}
            max={240}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
          />
        </label>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${size + 24}px, 1fr))`,
          gap: 12,
        }}
      >
        {filtered.map((m) => (
          <div
            key={m.name}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6,
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <div
              style={{
                width: size,
                height: size,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.20)',
                borderRadius: 4,
              }}
            >
              {/* Each SVG's viewBox now matches its true CAD aspect
                  ratio; object-fit: contain keeps proportions in the
                  square cell. */}
              <img
                src={m.url}
                alt={m.name}
                style={{
                  maxWidth: '95%',
                  maxHeight: '95%',
                  objectFit: 'contain',
                }}
              />
            </div>
            <span
              style={{
                fontSize: '0.75rem',
                color: 'var(--pen-soft)',
                wordBreak: 'break-all',
                textAlign: 'center',
                fontFamily: 'ui-monospace, monospace',
              }}
              title={m.name}
            >
              {m.name.length > 22 ? `${m.name.slice(0, 20)}…` : m.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
