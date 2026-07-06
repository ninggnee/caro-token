import { useEffect, useRef, useState } from 'react';

/**
 * Custom bank picker for Token Discounting — replaces the native <select>
 * with a Web3-styled dropdown (dark glass panel, green accent, per-bank
 * cards) matching the rest of the CaRo dashboard.
 *
 * No UI-kit dependency (Radix / Headless UI / shadcn) is installed in this
 * project — everything here is hand-rolled with inline styles, the same
 * pattern already used throughout FarmerLayout.jsx and this page, to avoid
 * introducing a new runtime dependency for a single control.
 *
 * Pure presentation: `banks` (with their Haircut/disbursement policy),
 * `value` and `onChange` all come from the caller — no calculation logic
 * lives in this file.
 */

const C = {
  card: '#0f1e20', border: 'rgba(255,255,255,0.08)',
  green: '#B0E4CC', text: '#eaecef', muted: '#848e9c', input: '#162020',
};

function ChevronIcon({ open }) {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, transition: 'transform 180ms ease', transform: open ? 'rotate(180deg)' : 'none' }}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function pct(n) {
  return `${(Number(n) * 100).toFixed(0)}%`;
}

export default function BankSelect({ banks = [], value, onChange, loading = false }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const wrapRef = useRef(null);
  const closeTimer = useRef(null);

  const selected = banks.find(b => b.name === value) || null;

  useEffect(() => {
    if (open) {
      clearTimeout(closeTimer.current);
      setMounted(true);
    } else if (mounted) {
      closeTimer.current = setTimeout(() => setMounted(false), 180);
    }
    return () => clearTimeout(closeTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const disabled = loading || banks.length === 0;

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '9px 12px', background: C.input,
          border: `1px solid ${open ? C.green : C.border}`, borderRadius: 6,
          cursor: disabled ? 'default' : 'pointer', boxSizing: 'border-box',
          transition: 'border-color 150ms ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontSize: 17, flexShrink: 0 }}>🏦</span>
          <div style={{ textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {loading ? 'Đang tải danh sách ngân hàng...' : (selected?.name || 'Chọn ngân hàng')}
            </div>
            {selected && !loading && (
              <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                Haircut {pct(selected.haircut)} • Giải ngân {pct(selected.disbursementRatio)}
              </div>
            )}
          </div>
        </div>
        {!loading && <ChevronIcon open={open} />}
      </button>

      {mounted && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40,
          background: 'rgba(15,30,32,0.94)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${C.border}`, borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.45)', overflow: 'hidden',
          opacity: open ? 1 : 0, transform: open ? 'translateY(0)' : 'translateY(-6px)',
          transition: 'opacity 180ms ease, transform 180ms ease',
          maxHeight: 320, overflowY: 'auto',
        }}>
          {banks.map((b, i) => {
            const isSelected = b.name === value;
            const isHovered = hoverIdx === i;
            return (
              <button
                type="button"
                key={b.name}
                onClick={() => { onChange(b.name); setOpen(false); }}
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(-1)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                  gap: 10, padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                  border: 'none', borderLeft: isSelected ? `3px solid ${C.green}` : '3px solid transparent',
                  borderBottom: i < banks.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  background: isSelected ? 'rgba(176,228,204,0.12)' : isHovered ? 'rgba(255,255,255,0.05)' : 'transparent',
                  transition: 'background 150ms ease',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700,
                    color: isSelected ? C.green : C.text }}>
                    <span>🏦</span><span>{b.name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Haircut: {pct(b.haircut)}</div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>Giải ngân: {pct(b.disbursementRatio)}</div>
                </div>
                {isSelected && (
                  <span style={{ color: C.green, fontWeight: 800, fontSize: 14, flexShrink: 0, marginTop: 2 }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
