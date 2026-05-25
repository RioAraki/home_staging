// Card-data review tool. Side-by-side of:
//   - the original scanned card (full image)
//   - each option's cropped sketch (what FloorPlan uses)
//   - our SVG render from the mechanical data (shape + open_spaces + walls)
//   - the raw data values, for spot-checking bbox/cells/etc.
//
// Accessed via `#/review`. Comments auto-sync to `md/review_comments.json`
// via the dev-server middleware in `vite-plugins/review-sync.ts`. No manual
// download required.

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { furnitureCards } from '../data';
import type { FurnitureCard, FurnitureOption, WallEdgeSpec } from '../types';
import { FurnitureShape } from './FurnitureShape';
import './ReviewPanel.css';

function originalUrl(number: number, variant: 'A' | 'B'): string {
  return `/cards/original/${String(number).padStart(2, '0')}_${variant}.jpg`;
}

function optionCropUrl(number: number, variant: 'A' | 'B', optIdx: number): string {
  return `/cards/options/${String(number).padStart(2, '0')}_${variant}_opt${optIdx}.jpg`;
}

interface Comment {
  id: string;                 // for delete/edit
  cardKey: string;            // "1-A"
  optionIndex: number | null; // null = card-level
  text: string;
  ts: number;                 // creation timestamp
}

interface Review {
  cardKey: string;            // "1-A"
  optionIndex: number;        // option-level only (card-level = both opts reviewed)
  ts: number;
}

/** Structured proposed edit produced by the visual cell editor.
 *  One per (cardKey, optionIndex) — re-saving overwrites the previous. */
interface ProposedEdit {
  cardKey: string;
  optionIndex: number;
  bbox: [number, number];                 // [rows, cols]
  shape: [number, number][];
  open_spaces: [number, number][];
  /** Optional — included starting in schema v3. Empty array means
   *  "explicitly no wall_edges required". Tuple entries are pass-through
   *  from yaml (the visual cell editor only edits bbox-side strings; any
   *  per-cell tuples are preserved verbatim on save). */
  wall_edges?: WallEdgeSpec[];
  ts: number;
}

interface CommentsFile {
  schema_version: 1 | 2 | 3;
  generated_at: string;
  comments: Comment[];
  reviews?: Review[];
  edits?: ProposedEdit[];
}

const STORAGE_KEY = 'review_comments_v2';
const REVIEWS_STORAGE_KEY = 'review_reviews_v1';
const EDITS_STORAGE_KEY = 'review_edits_v1';

type SyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';

interface AllState {
  comments: Comment[];
  reviews: Review[];
  edits: ProposedEdit[];
}

function loadFromCache(): AllState {
  try {
    const cRaw = localStorage.getItem(STORAGE_KEY);
    const rRaw = localStorage.getItem(REVIEWS_STORAGE_KEY);
    const eRaw = localStorage.getItem(EDITS_STORAGE_KEY);
    return {
      comments: cRaw ? (JSON.parse(cRaw) as Comment[]) : [],
      reviews: rRaw ? (JSON.parse(rRaw) as Review[]) : [],
      edits: eRaw ? (JSON.parse(eRaw) as ProposedEdit[]) : [],
    };
  } catch {
    return { comments: [], reviews: [], edits: [] };
  }
}

function writeToCache(s: AllState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s.comments));
  localStorage.setItem(REVIEWS_STORAGE_KEY, JSON.stringify(s.reviews));
  localStorage.setItem(EDITS_STORAGE_KEY, JSON.stringify(s.edits));
}

async function fetchFromServer(): Promise<AllState> {
  const res = await fetch('/__review/load');
  if (!res.ok) throw new Error(`load ${res.status}`);
  const data = (await res.json()) as CommentsFile | Comment[];
  if (Array.isArray(data)) return { comments: data, reviews: [], edits: [] };
  return {
    comments: data.comments ?? [],
    reviews: data.reviews ?? [],
    edits: data.edits ?? [],
  };
}

async function pushToServer(s: AllState): Promise<void> {
  const sortCard = (a: { cardKey: string; optionIndex?: number | null }, b: typeof a) => {
    if (a.cardKey !== b.cardKey) return a.cardKey.localeCompare(b.cardKey);
    return (a.optionIndex ?? -1) - (b.optionIndex ?? -1);
  };
  const payload: CommentsFile = {
    schema_version: 3,
    generated_at: new Date().toISOString(),
    comments: [...s.comments].sort(sortCard),
    reviews: [...s.reviews].sort(sortCard),
    edits: [...s.edits].sort(sortCard),
  };
  const res = await fetch('/__review/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`save ${res.status}`);
}

function reviewKey(cardKey: string, optionIndex: number): string {
  return `${cardKey}|${optionIndex}`;
}

function randomId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function ReviewPanel() {
  // localStorage hydrates instantly so the UI doesn't flash empty; the server
  // load below replaces it on mount with the canonical on-disk state.
  const initial = useMemo(loadFromCache, []);
  const [comments, setComments] = useState<Comment[]>(initial.comments);
  const [reviews, setReviews] = useState<Review[]>(initial.reviews);
  const [edits, setEdits] = useState<ProposedEdit[]>(initial.edits);
  const [filter, setFilter] = useState<string>('');
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  const [hideReviewed, setHideReviewed] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [syncError, setSyncError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<number | null>(null);

  // Initial pull from the dev-server endpoint.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fromServer = await fetchFromServer();
        if (cancelled) return;
        setComments(fromServer.comments);
        setReviews(fromServer.reviews);
        setEdits(fromServer.edits);
        writeToCache(fromServer);
        setSyncStatus('saved');
        setSyncError(null);
      } catch (e) {
        if (cancelled) return;
        setSyncStatus('error');
        setSyncError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Debounced auto-save: every change writes to localStorage immediately and
  // pushes to the dev server 300 ms later (coalescing rapid edits).
  const scheduleSave = useCallback((next: AllState) => {
    writeToCache(next);
    setSyncStatus('saving');
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(async () => {
      try {
        await pushToServer(next);
        setSyncStatus('saved');
        setSyncError(null);
      } catch (e) {
        setSyncStatus('error');
        setSyncError((e as Error).message);
      }
    }, 300);
  }, []);

  const applyComments = useCallback(
    (next: Comment[]) => {
      setComments(next);
      scheduleSave({ comments: next, reviews, edits });
    },
    [scheduleSave, reviews, edits],
  );

  const applyReviews = useCallback(
    (next: Review[]) => {
      setReviews(next);
      scheduleSave({ comments, reviews: next, edits });
    },
    [scheduleSave, comments, edits],
  );

  const applyEdits = useCallback(
    (next: ProposedEdit[]) => {
      setEdits(next);
      scheduleSave({ comments, reviews, edits: next });
    },
    [scheduleSave, comments, reviews],
  );

  const reviewedSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of reviews) s.add(reviewKey(r.cardKey, r.optionIndex));
    return s;
  }, [reviews]);

  const editsByLocation = useMemo(() => {
    const m = new Map<string, ProposedEdit>();
    for (const e of edits) m.set(reviewKey(e.cardKey, e.optionIndex), e);
    return m;
  }, [edits]);

  const toggleReview = (cardKey: string, optionIndex: number) => {
    const k = reviewKey(cardKey, optionIndex);
    if (reviewedSet.has(k)) {
      applyReviews(
        reviews.filter((r) => !(r.cardKey === cardKey && r.optionIndex === optionIndex)),
      );
    } else {
      applyReviews([...reviews, { cardKey, optionIndex, ts: Date.now() }]);
    }
  };

  const saveEdit = (edit: ProposedEdit) => {
    const others = edits.filter(
      (e) => !(e.cardKey === edit.cardKey && e.optionIndex === edit.optionIndex),
    );
    applyEdits([...others, edit]);
  };

  const removeEdit = (cardKey: string, optionIndex: number) => {
    applyEdits(
      edits.filter((e) => !(e.cardKey === cardKey && e.optionIndex === optionIndex)),
    );
  };

  const flaggedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const c of comments) s.add(c.cardKey);
    return s;
  }, [comments]);

  const commentsByLocation = useMemo(() => {
    // key: `${cardKey}|${optionIndex ?? 'card'}`
    const m = new Map<string, Comment[]>();
    for (const c of comments) {
      const k = `${c.cardKey}|${c.optionIndex ?? 'card'}`;
      const arr = m.get(k) ?? [];
      arr.push(c);
      m.set(k, arr);
    }
    return m;
  }, [comments]);

  const cardsFiltered = useMemo(() => {
    const norm = filter.trim().toLowerCase();
    return furnitureCards.filter((c) => {
      const cardKey = `${c.number}-${c.variant}`;
      if (showOnlyFlagged && !flaggedKeys.has(cardKey)) return false;
      if (hideReviewed) {
        // Hide cards where every option has been reviewed.
        const allDone = c.options.every((o) => reviewedSet.has(reviewKey(cardKey, o.option_index)));
        if (allDone) return false;
      }
      if (!norm) return true;
      if (`${c.number}`.padStart(2, '0').includes(norm)) return true;
      if (`#${c.number}${c.variant}`.toLowerCase().includes(norm)) return true;
      return c.options.some(
        (o) => o.name_zh.toLowerCase().includes(norm) || o.name_en?.toLowerCase().includes(norm),
      );
    });
  }, [filter, showOnlyFlagged, hideReviewed, flaggedKeys, reviewedSet]);

  const totalOptions = useMemo(
    () => furnitureCards.reduce((s, c) => s + c.options.length, 0),
    [],
  );

  const addComment = (cardKey: string, optionIndex: number | null, text: string) => {
    applyComments([
      ...comments,
      { id: randomId(), cardKey, optionIndex, text, ts: Date.now() },
    ]);
  };

  const updateComment = (id: string, text: string) => {
    applyComments(comments.map((c) => (c.id === id ? { ...c, text } : c)));
  };

  const removeComment = (id: string) => {
    applyComments(comments.filter((c) => c.id !== id));
  };

  const clearAll = () => {
    if (!confirm(`Delete all ${comments.length} comments?`)) return;
    applyComments([]);
  };

  const clearReviews = () => {
    if (!confirm(`Clear all ${reviews.length} reviewed ticks?`)) return;
    applyReviews([]);
  };

  const clearEdits = () => {
    if (!confirm(`Discard all ${edits.length} proposed edits?`)) return;
    applyEdits([]);
  };

  const exportJson = () => {
    const payload: CommentsFile = {
      schema_version: 1,
      generated_at: new Date().toISOString(),
      comments: [...comments].sort((a, b) => {
        if (a.cardKey !== b.cardKey) return a.cardKey.localeCompare(b.cardKey);
        return (a.optionIndex ?? -1) - (b.optionIndex ?? -1);
      }),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.download = `review_comments_${ts}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const triggerImport = () => fileInputRef.current?.click();

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as CommentsFile | Comment[];
      const incoming: Comment[] = Array.isArray(parsed) ? parsed : parsed.comments ?? [];
      // Normalize / regenerate ids if missing
      const fixed: Comment[] = incoming
        .filter((c) => c && typeof c.text === 'string' && typeof c.cardKey === 'string')
        .map((c) => ({
          id: c.id || randomId(),
          cardKey: c.cardKey,
          optionIndex:
            c.optionIndex === null || typeof c.optionIndex === 'number'
              ? c.optionIndex
              : null,
          text: c.text,
          ts: typeof c.ts === 'number' ? c.ts : Date.now(),
        }));
      const mode = confirm(
        `Import ${fixed.length} comment(s)?\n\nOK = MERGE with existing ${comments.length}\nCancel = REPLACE existing`,
      );
      const next = mode
        ? // merge: dedupe by id
          (() => {
            const ids = new Set(comments.map((c) => c.id));
            return [...comments, ...fixed.filter((c) => !ids.has(c.id))];
          })()
        : fixed;
      applyComments(next);
      // Edits + reviews aren't imported via this path for now (rare).
    } catch (e) {
      alert('Failed to import: ' + (e as Error).message);
    }
  };

  return (
    <div className="review-panel">
      <header className="review-header">
        <div className="review-title-row">
          <h1>Card data review</h1>
          <SyncIndicator status={syncStatus} error={syncError} count={comments.length} />
        </div>
        <div className="review-controls">
          <input
            type="text"
            placeholder="Filter by number / name…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="review-filter"
          />
          <label className="review-toggle">
            <input
              type="checkbox"
              checked={showOnlyFlagged}
              onChange={(e) => setShowOnlyFlagged(e.target.checked)}
            />
            Only flagged ({flaggedKeys.size})
          </label>
          <label className="review-toggle">
            <input
              type="checkbox"
              checked={hideReviewed}
              onChange={(e) => setHideReviewed(e.target.checked)}
            />
            Hide reviewed ({reviews.length}/{totalOptions})
          </label>
          <button type="button" className="review-btn" onClick={exportJson} disabled={comments.length === 0} title="Download a copy (file is also auto-synced to md/review_comments.json)">
            💾 Download copy
          </button>
          <button type="button" className="review-btn" onClick={triggerImport} title="Import from a JSON file (overwrites or merges)">
            📂 Import
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImport(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="review-btn danger"
            onClick={clearAll}
            disabled={comments.length === 0}
            title="Delete all comments"
          >
            🗑 Clear comments
          </button>
          <button
            type="button"
            className="review-btn danger"
            onClick={clearReviews}
            disabled={reviews.length === 0}
            title="Untick everything"
          >
            🗑 Clear ticks
          </button>
          <button
            type="button"
            className="review-btn danger"
            onClick={clearEdits}
            disabled={edits.length === 0}
            title="Discard all proposed cell edits"
          >
            🗑 Clear edits ({edits.length})
          </button>
          <a href="#" className="back-to-game">← Back to game</a>
        </div>
        <div className="review-howto">
          Comments auto-sync to <code>md/review_comments.json</code> on every change — no
          manual download needed. Just 🚩 add comments and tell the assistant when you're done.
        </div>
      </header>

      <div className="review-grid">
        {cardsFiltered.map((card) => {
          const cardKey = `${card.number}-${card.variant}`;
          const cardLevel = commentsByLocation.get(`${cardKey}|card`) ?? [];
          const allReviewed = card.options.every((o) =>
            reviewedSet.has(reviewKey(cardKey, o.option_index)),
          );
          return (
            <CardRow
              key={cardKey}
              card={card}
              cardLevelComments={cardLevel}
              commentsByLocation={commentsByLocation}
              editsByLocation={editsByLocation}
              reviewedSet={reviewedSet}
              flagged={flaggedKeys.has(cardKey)}
              allReviewed={allReviewed}
              onAdd={(optIdx, text) => addComment(cardKey, optIdx, text)}
              onUpdate={updateComment}
              onRemove={removeComment}
              onToggleReview={toggleReview}
              onSaveEdit={saveEdit}
              onRemoveEdit={removeEdit}
            />
          );
        })}
      </div>
    </div>
  );
}

function SyncIndicator({ status, error, count }: { status: SyncStatus; error: string | null; count: number }) {
  const label =
    status === 'loading' ? 'Loading…' :
    status === 'saving' ? 'Saving…' :
    status === 'saved' ? `Synced (${count})` :
    status === 'error' ? `⚠ ${error ?? 'Sync error'}` :
    '';
  return <span className={`sync-indicator ${status}`}>{label}</span>;
}

interface CardRowProps {
  card: FurnitureCard;
  cardLevelComments: Comment[];
  commentsByLocation: Map<string, Comment[]>;
  editsByLocation: Map<string, ProposedEdit>;
  reviewedSet: Set<string>;
  flagged: boolean;
  allReviewed: boolean;
  onAdd: (optionIndex: number | null, text: string) => void;
  onUpdate: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onToggleReview: (cardKey: string, optionIndex: number) => void;
  onSaveEdit: (edit: ProposedEdit) => void;
  onRemoveEdit: (cardKey: string, optionIndex: number) => void;
}

function CardRow({
  card,
  cardLevelComments,
  commentsByLocation,
  editsByLocation,
  reviewedSet,
  flagged,
  allReviewed,
  onAdd,
  onUpdate,
  onRemove,
  onToggleReview,
  onSaveEdit,
  onRemoveEdit,
}: CardRowProps) {
  const cardKey = `${card.number}-${card.variant}`;
  return (
    <article
      className={`card-row ${flagged ? 'flagged' : ''} ${allReviewed ? 'reviewed' : ''}`}
    >
      <div className="card-row-original">
        <div className="card-row-label">
          #{card.number}
          {card.variant}
          {allReviewed && <span className="card-reviewed-mark"> ✓</span>}
        </div>
        <img
          src={originalUrl(card.number, card.variant)}
          alt={`Card ${card.number}${card.variant}`}
          loading="lazy"
        />
        <CommentsList comments={cardLevelComments} onUpdate={onUpdate} onRemove={onRemove} />
        <FlagButton label="Flag whole card" onSubmit={(text) => onAdd(null, text)} />
      </div>
      <div className="card-row-options">
        {card.options.map((opt) => (
          <OptionBlock
            key={opt.option_index}
            number={card.number}
            variant={card.variant}
            opt={opt}
            reviewed={reviewedSet.has(reviewKey(cardKey, opt.option_index))}
            edit={editsByLocation.get(reviewKey(cardKey, opt.option_index)) ?? null}
            comments={
              commentsByLocation.get(`${card.number}-${card.variant}|${opt.option_index}`) ?? []
            }
            onFlag={(text) => onAdd(opt.option_index, text)}
            onUpdate={onUpdate}
            onRemove={onRemove}
            onToggleReview={() => onToggleReview(cardKey, opt.option_index)}
            onSaveEdit={(payload) =>
              onSaveEdit({
                cardKey,
                optionIndex: opt.option_index,
                bbox: payload.bbox,
                shape: payload.shape,
                open_spaces: payload.open_spaces,
                wall_edges: payload.wall_edges,
                ts: Date.now(),
              })
            }
            onRemoveEdit={() => onRemoveEdit(cardKey, opt.option_index)}
          />
        ))}
      </div>
    </article>
  );
}

interface OptionBlockProps {
  number: number;
  variant: 'A' | 'B';
  opt: FurnitureOption;
  reviewed: boolean;
  edit: ProposedEdit | null;
  comments: Comment[];
  onFlag: (text: string) => void;
  onUpdate: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onToggleReview: () => void;
  onSaveEdit: (payload: Pick<ProposedEdit, 'bbox' | 'shape' | 'open_spaces' | 'wall_edges'>) => void;
  onRemoveEdit: () => void;
}

function OptionBlock({ number, variant, opt, reviewed, edit, comments, onFlag, onUpdate, onRemove, onToggleReview, onSaveEdit, onRemoveEdit }: OptionBlockProps) {
  const [rows, cols] = opt.bbox;
  const [editing, setEditing] = useState(false);
  return (
    <div
      className={`option-block ${comments.length > 0 ? 'has-comments' : ''} ${reviewed ? 'reviewed' : ''} ${edit ? 'has-edit' : ''}`}
    >
      <div className="option-meta">
        <div className="option-title">
          <label className="reviewed-tick" title={reviewed ? 'Marked as reviewed — click to un-tick' : 'Mark this option as reviewed'}>
            <input
              type="checkbox"
              checked={reviewed}
              onChange={onToggleReview}
            />
            <span className="reviewed-tick-box">{reviewed ? '✓' : ''}</span>
          </label>
          opt{opt.option_index} · {opt.name_zh}
          {opt.name_en && <span className="opt-en"> / {opt.name_en}</span>}
          {comments.length > 0 && (
            <span className="comments-badge">🚩 {comments.length}</span>
          )}
          {edit && <span className="edit-badge">✏ Edited</span>}
          {reviewed && <span className="reviewed-badge">Reviewed</span>}
        </div>
        <div className="option-bbox">
          bbox <code>[{rows}, {cols}]</code>
          {opt.wall_edges && opt.wall_edges.length > 0 && (
            <> · wall_edges <code>[{opt.wall_edges.map((e) =>
              typeof e === 'string' ? e : `${e[2]}@[${e[0]},${e[1]}]`,
            ).join(', ')}]</code></>
          )}
          {opt.printed_markers && opt.printed_markers > 1 && (
            <> · markers <code>{opt.printed_markers}</code></>
          )}
        </div>
      </div>

      {editing && (
        <CellEditor
          number={number}
          variant={variant}
          opt={opt}
          initial={edit}
          onSave={(payload) => { onSaveEdit(payload); setEditing(false); }}
          onCancel={() => setEditing(false)}
        />
      )}

      <div className="option-compare">
        <div className="compare-pane">
          <div className="pane-label">Source crop</div>
          <img
            className="opt-crop"
            src={optionCropUrl(number, variant, opt.option_index)}
            alt={`opt${opt.option_index} crop`}
            loading="lazy"
          />
        </div>
        <div className="compare-pane">
          <div className="pane-label">Our render</div>
          <div className="opt-svg-wrap">
            <FurnitureShape option={opt} number={number} variant={variant} cellSize={36} />
          </div>
        </div>
        <div className="compare-pane data-pane">
          <div className="pane-label">Cells</div>
          <table className="cells-table">
            <tbody>
              <tr>
                <th>shape</th>
                <td>{opt.shape.map((c) => `[${c[0]},${c[1]}]`).join(' ')}</td>
              </tr>
              <tr>
                <th>open</th>
                <td>{opt.open_spaces.map((c) => `[${c[0]},${c[1]}]`).join(' ') || '—'}</td>
              </tr>
            </tbody>
          </table>
          {opt.notes && <div className="opt-notes">📝 {opt.notes}</div>}
        </div>
      </div>

      {edit && !editing && (
        <div className="edit-summary">
          <div>
            <strong>Proposed:</strong> bbox <code>[{edit.bbox[0]}, {edit.bbox[1]}]</code>
            {' '}· shape <code>{edit.shape.length}</code> · open <code>{edit.open_spaces.length}</code>
            {' '}· void <code>{edit.bbox[0] * edit.bbox[1] - edit.shape.length - edit.open_spaces.length}</code>
          </div>
          <div className="edit-summary-actions">
            <button type="button" className="flag-btn" onClick={() => setEditing(true)}>✏ Re-edit</button>
            <button type="button" className="flag-btn" onClick={onRemoveEdit}>✕ Discard</button>
          </div>
        </div>
      )}

      <CommentsList comments={comments} onUpdate={onUpdate} onRemove={onRemove} />
      <div className="option-actions">
        {!editing && (
          <button type="button" className="flag-btn edit-btn" onClick={() => setEditing(true)}>
            ✏ Edit cells visually
          </button>
        )}
        <FlagButton label="Add text comment" onSubmit={onFlag} />
      </div>
    </div>
  );
}

// ─────────────────────────── Visual cell editor ───────────────────────────

type CellClass = 'shape' | 'open' | 'void';

type SideKey = 'top' | 'right' | 'bottom' | 'left';
const ALL_SIDES: SideKey[] = ['top', 'right', 'bottom', 'left'];

interface CellEditorProps {
  number: number;
  variant: 'A' | 'B';
  opt: FurnitureOption;
  initial: ProposedEdit | null;
  onSave: (payload: Pick<ProposedEdit, 'bbox' | 'shape' | 'open_spaces' | 'wall_edges'>) => void;
  onCancel: () => void;
}

function CellEditor({ number, variant, opt, initial, onSave, onCancel }: CellEditorProps) {
  const startBbox: [number, number] = initial ? initial.bbox : opt.bbox;
  const [rows, setRows] = useState<number>(startBbox[0]);
  const [cols, setCols] = useState<number>(startBbox[1]);
  // Map "r,c" → 'shape' | 'open'. Missing key = void.
  // Kept across bbox changes so shrinking + re-expanding doesn't lose data.
  const [cellMap, setCellMap] = useState<Map<string, Exclude<CellClass, 'void'>>>(() => {
    const m = new Map<string, Exclude<CellClass, 'void'>>();
    const src = initial
      ? { shape: initial.shape, open_spaces: initial.open_spaces }
      : { shape: opt.shape, open_spaces: opt.open_spaces };
    for (const [r, c] of src.shape) m.set(`${r},${c}`, 'shape');
    for (const [r, c] of src.open_spaces) m.set(`${r},${c}`, 'open');
    return m;
  });
  // The visual editor only handles bbox-side strings. Per-cell tuple
  // entries from yaml are preserved verbatim and re-emitted on save.
  const initialEdges: WallEdgeSpec[] = initial?.wall_edges ?? opt.wall_edges ?? [];
  const [wallSides, setWallSides] = useState<Set<SideKey>>(
    () => new Set(initialEdges.filter((e): e is SideKey => typeof e === 'string')),
  );
  const preservedTuples = initialEdges.filter(
    (e): e is [number, number, SideKey] => typeof e !== 'string',
  );

  const cycleCell = (r: number, c: number) => {
    const k = `${r},${c}`;
    const cur: CellClass = cellMap.get(k) ?? 'void';
    const next: CellClass = cur === 'void' ? 'shape' : cur === 'shape' ? 'open' : 'void';
    const m = new Map(cellMap);
    if (next === 'void') m.delete(k);
    else m.set(k, next);
    setCellMap(m);
  };

  const toggleSide = (side: SideKey) => {
    const s = new Set(wallSides);
    if (s.has(side)) s.delete(side);
    else s.add(side);
    setWallSides(s);
  };

  const handleSave = () => {
    const shape: [number, number][] = [];
    const open: [number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cls = cellMap.get(`${r},${c}`);
        if (cls === 'shape') shape.push([r, c]);
        else if (cls === 'open') open.push([r, c]);
      }
    }
    const wall_edges: WallEdgeSpec[] = [
      ...ALL_SIDES.filter((s) => wallSides.has(s)),
      ...preservedTuples,
    ];
    onSave({ bbox: [rows, cols], shape, open_spaces: open, wall_edges });
  };

  const cellSize = 56;
  const w = cols * cellSize;
  const h = rows * cellSize;
  const cropUrl = optionCropUrl(number, variant, opt.option_index);

  return (
    <div className="cell-editor">
      <div className="editor-controls">
        <span className="dim-label">rows</span>
        <button type="button" className="dim-btn" onClick={() => setRows(Math.max(1, rows - 1))}>−</button>
        <span className="dim-val">{rows}</span>
        <button type="button" className="dim-btn" onClick={() => setRows(Math.min(10, rows + 1))}>+</button>
        <span className="dim-label">cols</span>
        <button type="button" className="dim-btn" onClick={() => setCols(Math.max(1, cols - 1))}>−</button>
        <span className="dim-val">{cols}</span>
        <button type="button" className="dim-btn" onClick={() => setCols(Math.min(10, cols + 1))}>+</button>
        <span className="editor-legend">
          <span className="legend-chip shape">S</span> shape
          <span className="legend-chip open">O</span> open
          <span className="legend-chip void">·</span> void
          <span className="legend-hint">(click cell to cycle)</span>
        </span>
      </div>
      <div className="editor-walls-row">
        <span className="dim-label" title="Bold-edge sides — placement requires a wall along this side">wall edges:</span>
        {ALL_SIDES.map((side) => (
          <button
            key={side}
            type="button"
            className={`wall-side-btn ${wallSides.has(side) ? 'on' : ''}`}
            onClick={() => toggleSide(side)}
          >
            {side}
          </button>
        ))}
        <span className="legend-hint">(toggle which bbox sides have the bold "must-be-wall" line on the card)</span>
      </div>
      <div className="editor-grid-wrap" style={{ width: w, height: h }}>
        <img src={cropUrl} className="editor-bg" style={{ width: w, height: h }} alt="" />
        <div
          className="editor-grid"
          style={{
            gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
            gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          }}
        >
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const cls: CellClass = cellMap.get(`${r},${c}`) ?? 'void';
              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  className={`editor-cell ${cls}`}
                  onClick={() => cycleCell(r, c)}
                  title={`(${r},${c}) — ${cls}`}
                >
                  <span className="cell-letter">
                    {cls === 'shape' ? 'S' : cls === 'open' ? '·' : ''}
                  </span>
                </button>
              );
            }),
          )}
        </div>
        {/* Bold wall-edge overlay on the grid sides */}
        {wallSides.has('top') && <div className="wall-overlay top" />}
        {wallSides.has('bottom') && <div className="wall-overlay bottom" />}
        {wallSides.has('left') && <div className="wall-overlay left" />}
        {wallSides.has('right') && <div className="wall-overlay right" />}
      </div>
      <div className="editor-actions">
        <button type="button" className="editor-save" onClick={handleSave}>✓ Save edit</button>
        <button type="button" className="editor-cancel" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

interface CommentsListProps {
  comments: Comment[];
  onUpdate: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}

function CommentsList({ comments, onUpdate, onRemove }: CommentsListProps) {
  if (comments.length === 0) return null;
  return (
    <ul className="comments-list">
      {comments.map((c) => (
        <CommentRow key={c.id} comment={c} onUpdate={onUpdate} onRemove={onRemove} />
      ))}
    </ul>
  );
}

function CommentRow({ comment, onUpdate, onRemove }: {
  comment: Comment;
  onUpdate: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(comment.text);
  if (editing) {
    return (
      <li className="comment-row editing">
        <input
          type="text"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) {
              onUpdate(comment.id, text.trim());
              setEditing(false);
            } else if (e.key === 'Escape') {
              setText(comment.text);
              setEditing(false);
            }
          }}
        />
        <button type="button" onClick={() => { onUpdate(comment.id, text.trim()); setEditing(false); }}>
          Save
        </button>
      </li>
    );
  }
  return (
    <li className="comment-row">
      <span className="comment-marker">🚩</span>
      <span className="comment-text">{comment.text}</span>
      <button type="button" className="comment-action" onClick={() => setEditing(true)} title="Edit">✎</button>
      <button type="button" className="comment-action danger" onClick={() => onRemove(comment.id)} title="Delete">✕</button>
    </li>
  );
}

interface FlagButtonProps {
  label: string;
  onSubmit: (text: string) => void;
}

function FlagButton({ label, onSubmit }: FlagButtonProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  if (!open) {
    return (
      <button type="button" className="flag-btn" onClick={() => setOpen(true)}>
        🚩 {label}
      </button>
    );
  }
  return (
    <div className="flag-form">
      <input
        type="text"
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's wrong? (Enter to save)"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) {
            onSubmit(text.trim());
            setText('');
            setOpen(false);
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
      />
      <button
        type="button"
        onClick={() => {
          if (text.trim()) {
            onSubmit(text.trim());
            setText('');
            setOpen(false);
          }
        }}
      >
        Save
      </button>
      <button type="button" onClick={() => setOpen(false)}>Cancel</button>
    </div>
  );
}
