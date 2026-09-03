// Mathnasium Calendar Expander
// Removes scroll clipping from the Radius scheduling calendar so the
// full day's schedule is visible on screen and prints in one piece.

function expandCalendar() {
  const root = document.querySelector('.ec');
  if (!root) return false;

  let changed = false;
  const els = [root, ...root.querySelectorAll('*')];

  els.forEach((el) => {
    if (el.scrollWidth > el.clientWidth + 1) {
      el.style.width = el.scrollWidth + 'px';
      el.style.maxWidth = 'none';
      el.style.overflowX = 'visible';
      changed = true;
    }
    if (el.scrollHeight > el.clientHeight + 1) {
      el.style.height = el.scrollHeight + 'px';
      el.style.maxHeight = 'none';
      el.style.overflowY = 'visible';
      changed = true;
    }
  });

  return changed;
}

function expandFully() {
  // Container sizes often only reveal their true content size after
  // children have already expanded, so run several passes.
  for (let i = 0; i < 8; i++) {
    if (!expandCalendar()) break;
  }
}

// Chrome doesn't let a page set the print dialog's scale slider, so
// instead we shrink the calendar itself (via CSS transform) before
// printing, and force landscape via @page. Left at 100% in the print
// dialog, this reproduces a "50% custom scale, landscape" print.

function ensurePrintStyle() {
  if (document.getElementById('mn-print-style')) return;
  const style = document.createElement('style');
  style.id = 'mn-print-style';
  style.textContent = `
    @page { size: landscape; margin: 0.3in; }
    @media print {
      body * { visibility: hidden; }
      .ec, .ec * { visibility: visible; }
      .ec { position: absolute; top: 0; left: 0; }
      #mn-expand-btn, #mn-print-btn { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

function printSchedule() {
  expandFully();
  ensurePrintStyle();

  const root = document.querySelector('.ec');
  if (!root) {
    window.print();
    return;
  }

  // Target width approximates the printable area of a landscape US
  // Letter/A4 page at 96 CSS px/in, with margins already subtracted.
  const targetWidthPx = 1300;
  const contentWidth = root.scrollWidth;
  let scale = contentWidth > targetWidthPx ? targetWidthPx / contentWidth : 1;
  scale = Math.max(scale, 0.25); // never shrink to the point of being unreadable

  const prevTransform = root.style.transform;
  const prevOrigin = root.style.transformOrigin;
  const prevWidth = root.style.width;

  root.style.transformOrigin = 'top left';
  root.style.transform = `scale(${scale})`;
  root.style.width = (100 / scale) + '%';

  const restore = () => {
    root.style.transform = prevTransform;
    root.style.transformOrigin = prevOrigin;
    root.style.width = prevWidth;
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);

  // Give the browser a moment to apply the transform before opening
  // the print dialog.
  setTimeout(() => window.print(), 100);
}

function addButtons() {
  if (document.getElementById('mn-expand-btn')) return;

  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position: 'fixed',
    top: '12px',
    right: '12px',
    zIndex: 999999,
    display: 'flex',
    gap: '8px',
  });

  const makeBtn = (id, label, color, onClick) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.textContent = label;
    Object.assign(btn.style, {
      padding: '8px 14px',
      background: color,
      color: '#fff',
      border: 'none',
      borderRadius: '6px',
      fontSize: '13px',
      fontFamily: 'sans-serif',
      cursor: 'pointer',
      boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
    });
    btn.addEventListener('click', onClick);
    return btn;
  };

  wrap.appendChild(makeBtn('mn-expand-btn', 'Expand for printing', '#2d6a4f', expandFully));
  wrap.appendChild(makeBtn('mn-print-btn', 'Print schedule', '#1d4ed8', printSchedule));
  document.body.appendChild(wrap);
}

// Run once the calendar has had a chance to render.
setTimeout(() => {
  expandFully();
  addButtons();
}, 1500);

// The calendar re-renders via AJAX when the date/center changes, which
// re-introduces the scroll clipping. Watch for that and re-expand.
const observer = new MutationObserver(() => {
  clearTimeout(window.__mnExpandTimer);
  window.__mnExpandTimer = setTimeout(expandFully, 800);
});
observer.observe(document.body, { childList: true, subtree: true });

// Also expand right before printing, in case something changed since
// the last auto-run.
window.addEventListener('beforeprint', expandFully);
