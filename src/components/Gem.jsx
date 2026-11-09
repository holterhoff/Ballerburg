import { useEffect, useRef, useState } from 'react';

/**
 * Menu bar in the style of a 1980s desktop (GEM): titles open drop-down menus on click,
 * moving across titles while a menu is open switches menus, Esc or a click outside closes.
 */
export function MenuBar({ menus }) {
  const [open, setOpen] = useState(-1);
  const ref = useRef(null);

  useEffect(() => {
    if (open < 0) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(-1);
    };
    const key = (e) => e.key === 'Escape' && setOpen(-1);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <nav className="gem-menubar" ref={ref} aria-label="Hauptmenü">
      <ul role="menubar">
        {menus.map((m, i) => (
          <li key={m.title} className={open === i ? 'open' : ''}>
            <button
              role="menuitem"
              aria-haspopup="true"
              aria-expanded={open === i}
              className="gem-title"
              onClick={() => setOpen(open === i ? -1 : i)}
              onPointerEnter={() => open >= 0 && setOpen(i)}
            >
              {m.title}
            </button>
            {open === i && (
              <ul className="gem-dropdown" role="menu">
                {m.items.map((it, j) =>
                  it.separator ? (
                    <li key={`s${j}`} className="gem-sep" role="separator" />
                  ) : (
                    <li key={it.label}>
                      <button
                        role="menuitem"
                        disabled={it.disabled}
                        onClick={() => {
                          setOpen(-1);
                          it.onSelect();
                        }}
                      >
                        <span className="gem-check" aria-hidden="true">{it.checked ? '✓' : ''}</span>
                        {it.label}
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A modal dialog box with a double border; Esc triggers onClose when given. */
export function Dialog({ title, children, onClose, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    const first = el?.querySelector('[data-autofocus]') || el?.querySelector('button:not([disabled]), input, select');
    first?.focus();
    const key = (e) => {
      if (e.key === 'Escape' && onClose) {
        e.stopPropagation();
        onClose();
      }
    };
    el?.addEventListener('keydown', key);
    return () => el?.removeEventListener('keydown', key);
  }, [onClose]);
  return (
    <div className="gem-overlay">
      <div className={`gem-dialog ${className}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        {title && <h2 className="gem-dialog-title">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Btn({ def, children, className = '', ...rest }) {
  return (
    <button className={`gem-btn ${def ? 'default' : ''} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** Value with coarse and fine arrows on both sides, like the classic number fields. */
export function Spinner({ label, value, onChange, min, max, coarse, fine = 1, unit = '' }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="gem-spinner" role="group" aria-label={label}>
      <span className="gem-spinner-label">{label}:</span>
      <button className="gem-arrow" onClick={() => set(value - coarse)} aria-label={`${label} minus ${coarse}`}>◂◂</button>
      <button className="gem-arrow" onClick={() => set(value - fine)} aria-label={`${label} minus ${fine}`}>◂</button>
      <output className="gem-value">{value}{unit}</output>
      <button className="gem-arrow" onClick={() => set(value + fine)} aria-label={`${label} plus ${fine}`}>▸</button>
      <button className="gem-arrow" onClick={() => set(value + coarse)} aria-label={`${label} plus ${coarse}`}>▸▸</button>
    </div>
  );
}
