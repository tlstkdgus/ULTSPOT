"use client";
import { useState } from 'react';
import { artists, searchArtists } from '@/lib/trip/artists';

export function ArtistPicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const [query, setQuery] = useState('');
  const results = searchArtists(query);
  return <section aria-label="Your artists" className="mb-6 rounded-xl border border-line-strong bg-bg-soft p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-eyebrow text-text-muted">YOUR BIAS LINE</p><h2 className="mt-2 text-heading">Who’s on your playlist?</h2></div><button type="button" aria-pressed={!selected.length} onClick={() => onChange([])} className="rounded-full border border-line-strong px-4 py-3 text-label">{!selected.length ? '✓ ' : ''}Explore all K-pop</button></div>
    <p className="mt-3 text-body-sm text-text-muted">Pick up to 5 favorites, or keep exploring everyone.</p>
    <label className="mt-4 block text-label">Search artists<input className="mt-2 block w-full rounded-sm border border-line-strong bg-bg px-4 py-3 text-body" placeholder="English or 한국어 · Try Stray Kids or 필릭스" value={query} onChange={e => setQuery(e.target.value)} /></label>
    {selected.length > 0 && <div aria-label="Selected artists" className="mt-4 flex flex-wrap gap-2">{selected.map(id => <button key={id} type="button" aria-label={`Remove artist ${artists.find(a => a.id === id)?.name}`} onClick={() => onChange(selected.filter(value => value !== id))} className="rounded-full border border-text bg-surface px-4 py-2 text-label">{artists.find(a => a.id === id)?.name} <span aria-hidden="true">×</span></button>)}</div>}
    <div className="mt-4 grid gap-3 sm:grid-cols-3">{results.map(a => <div key={a.id} className="min-w-0 rounded-lg border border-line-strong bg-surface p-4"><button type="button" aria-label={`Choose artist ${a.name}`} aria-pressed={selected.includes(a.id)} disabled={!selected.includes(a.id) && selected.length >= 5} onClick={() => onChange(selected.includes(a.id) ? selected.filter(id => id !== a.id) : [...selected, a.id])} className="w-full text-left disabled:opacity-40"><span className="text-caption text-text-muted">{a.kind === 'person' ? 'STRAY KIDS · MEMBER' : 'GROUP'} <span aria-hidden="true">{selected.includes(a.id) ? '✓' : '＋'}</span></span><span className="mt-3 block text-subhead">{a.name}</span><span className="mt-1 block text-caption text-text-muted">{a.korean}</span></button><a href={a.source} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-caption text-text-muted underline">Official profile ↗</a></div>)}</div>
    {!results.length && <p role="status" className="mt-4 text-body-sm text-text-muted">This artist isn’t in our verified selection yet. Try another name or explore all K-pop.</p>}
    <p className="mt-4 text-caption text-text-muted">Starting with 3 groups and Stray Kids members. More artists are being checked. A selection doesn’t guarantee events or artist appearances.</p>
  </section>;
}
