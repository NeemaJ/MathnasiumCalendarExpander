// Mathnasium Calendar Expander
// Removes scroll clipping from the Radius scheduling calendar so the full
// day's schedule is visible and centered on screen, and prints as a single
// page that fills the paper.

// --- Configuration -------------------------------------------------------

// Printable page width in inches. Defaults to US Letter in landscape (11in
// wide). For A4 landscape use { width: 11.69 }. Height is deliberately not
// part of this: the schedule is scaled to fill the page width and then runs to
// whatever height that gives it, over as many pages as it needs.
const PAGE = { width: 11, margin: 0.3 };
const PX_PER_IN = 96;

const CAL = '.ec';
const ANCESTOR_CLASS = 'mn-print-ancestor';

// --- Expanding -----------------------------------------------------------

// Used for height only. An element whose children simply overflow it, with
// overflow:visible, is hiding nothing vertically -- and forcing a height on it
// inflates the row, then feeds the next pass and ratchets further.
const CLIPS = /auto|scroll|hidden|clip/;

function expandCalendar() {
  const root = document.querySelector(CAL);
  if (!root) return false;

  let changed = false;
  const els = [root, ...root.querySelectorAll('*')];

  els.forEach((el) => {
    const style = getComputedStyle(el);

    // `mnW`/`mnH` mark what we've already sized, so a later pass can never
    // grow the same element a second time.
    // No clipping test on this axis: the calendar is held in by a max-width
    // while its overflow stays `visible`, so it never reads as clipping even
    // though its content is wider than it is and spills out of the card.
    if (!el.dataset.mnW && el.scrollWidth > el.clientWidth + 1) {
      el.dataset.mnW = '1';
      el.style.width = el.scrollWidth + 'px';
      el.style.maxWidth = 'none';
      el.style.overflowX = 'visible';
      changed = true;
    }
    if (
      !el.dataset.mnH &&
      CLIPS.test(style.overflowY) &&
      el.scrollHeight > el.clientHeight + 1
    ) {
      el.dataset.mnH = '1';
      // `auto`, not a pixel height. scrollHeight lies here: the calendar's
      // sidebar ends in a row with `flex-basis: 100%`, which inflates the
      // measurement to roughly double what the content needs, and pinning
      // that number is what makes the printed rows tall and empty.
      el.style.height = 'auto';
      el.style.maxHeight = 'none';
      el.style.overflowY = 'visible';
      changed = true;
    }
  });

  return changed;
}

// The calendar lays itself out to fit a fixed-height box and scrolls inside
// it, and its rows are flex children that stretch to fill that box (the last
// one absorbing all the slack). Releasing the height makes every row size to
// its own content, so nothing hides behind a scrollbar -- on screen and on
// paper alike. This is a stylesheet rather than inline styles because it has
// to beat the library's own rules and survive its re-renders.
function ensureUnclipStyle() {
  if (document.getElementById('mn-unclip-style')) return;
  const style = document.createElement('style');
  style.id = 'mn-unclip-style';
  style.textContent = `
    ${CAL}, ${CAL} .ec-body, ${CAL} .ec-content, ${CAL} .ec-sidebar {
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
    }
    /* The page caps the calendar at the width of its card, so the schedule is
       cut off however wide we make the scrolling parts inside it. */
    ${CAL} { max-width: none !important; }
    /* Deliberately NOT touching overflow here: expandCalendar detects the
       horizontal clipping by reading it, and would skip widening the body if
       this rule cleared it first. It clears overflow itself once widened. */
    /* This one carries flex-basis:100%, which balloons it and its parent. */
    ${CAL}.ec-timeline .ec-sidebar .ec-resource:last-child {
      flex-basis: auto !important;
    }
  `;
  document.head.appendChild(style);
}

// Center the expanded calendar horizontally in the viewport. Ancestors often
// place it hard against the left of a wide layout column, so rather than
// guessing at their box model we measure where the calendar actually landed
// and nudge it by the difference.
function centerCalendar() {
  const root = document.querySelector(CAL);
  if (!root) return;

  // Move it with a transform rather than a margin. The calendar is an
  // auto-width block, so adjusting its margins also changes how wide it is,
  // and the measurement ends up chasing its own tail. A transform shifts it
  // without touching layout, so one measurement is enough.
  root.style.transform = '';

  const viewportWidth = document.documentElement.clientWidth;
  const rect = root.getBoundingClientRect();
  // Wider than the screen: there is no "center" to move it to.
  if (!rect.width || rect.width >= viewportWidth) return;

  const offset = (viewportWidth - rect.width) / 2 - rect.left;
  if (Math.abs(offset) < 1) return;

  root.style.transform = `translateX(${offset}px)`;
}

function expandFully() {
  ensureUnclipStyle();
  // Container sizes often only reveal their true content size after
  // children have already expanded, so run several passes.
  for (let i = 0; i < 8; i++) {
    if (!expandCalendar()) break;
  }
  centerCalendar();
}

// --- Printing ------------------------------------------------------------

// Mark every wrapper between <body> and the calendar, so the print stylesheet
// can strip their padding and clipping and hide everything else outright.
function tagAncestors(root) {
  document
    .querySelectorAll('.' + ANCESTOR_CLASS)
    .forEach((el) => el.classList.remove(ANCESTOR_CLASS));

  for (let el = root.parentElement; el && el !== document.body; el = el.parentElement) {
    el.classList.add(ANCESTOR_CLASS);
  }
}

function updatePrintStyle() {
  const root = document.querySelector(CAL);
  if (!root) return;

  tagAncestors(root);

  const targetWidth = (PAGE.width - 2 * PAGE.margin) * PX_PER_IN;
  const contentWidth = root.scrollWidth;
  if (!contentWidth) return;

  // One uniform factor, chosen purely so the schedule spans the full width of
  // the paper. Uniform means nothing is stretched or squashed -- the type keeps
  // its shape. Height is left alone: at this scale the schedule is as tall as
  // it is, and runs onto a second page if that's what it takes.
  //
  // `zoom` rather than a transform because zoom resizes the element's layout
  // box, so the browser paginates against the scaled schedule. A transform
  // would leave the layout at full size and paginate against that instead.
  const zoom = targetWidth / contentWidth;

  let style = document.getElementById('mn-print-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'mn-print-style';
    document.head.appendChild(style);
  }

  style.textContent = `
    @page { size: landscape; margin: ${PAGE.margin}in; }
    @media print {
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: auto !important;
        height: auto !important;
        background: #fff !important;
      }
      /* Drop everything that isn't the calendar or on the path down to it.
         Hiding with visibility would leave the boxes in flow, and that empty
         space is what pushes the schedule onto a second and third page. */
      body > *:not(.${ANCESTOR_CLASS}):not(${CAL}),
      .${ANCESTOR_CLASS} > *:not(.${ANCESTOR_CLASS}):not(${CAL}) {
        display: none !important;
      }
      /* Neutralise the wrappers themselves: their padding, clipping and
         positioning would otherwise offset or crop the printed schedule. */
      .${ANCESTOR_CLASS} {
        display: block !important;
        position: static !important;
        overflow: visible !important;
        transform: none !important;
        margin: 0 !important;
        padding: 0 !important;
        border: 0 !important;
        width: auto !important;
        height: auto !important;
        max-width: none !important;
        max-height: none !important;
        background: none !important;
      }
      ${CAL} {
        margin: 0 !important;
        zoom: ${zoom};
        /* drop the on-screen centering shift */
        transform: none !important;
        /* Pin to the width the scale was calculated from. The calendar is an
           auto-width block, and stripping the wrappers above lets it reflow
           wider than it was when measured, which would throw the scale off. */
        width: ${contentWidth}px !important;
        max-width: none !important;
        max-height: none !important;
      }
      ${CAL}, ${CAL} * {
        overflow: visible !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      #mn-btns { display: none !important; }
    }
  `;
}

// --- UI ------------------------------------------------------------------

function addButtons() {
  if (document.getElementById('mn-btns')) return;

  const wrap = document.createElement('div');
  wrap.id = 'mn-btns';
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
  wrap.appendChild(makeBtn('mn-print-btn', 'Print schedule', '#1d4ed8', () => window.print()));
  document.body.appendChild(wrap);
}

// --- Wiring --------------------------------------------------------------

// Run once the calendar has had a chance to render.
setTimeout(() => {
  expandFully();
  updatePrintStyle();
  addButtons();
}, 1500);

// The calendar re-renders via AJAX when the date/center changes, which
// re-introduces the scroll clipping. Watch for that and re-expand.
let expandTimer;
const observer = new MutationObserver(() => {
  clearTimeout(expandTimer);
  expandTimer = setTimeout(() => {
    expandFully();
    addButtons();
  }, 800);
});
observer.observe(document.body, { childList: true, subtree: true });

// Recompute immediately before printing, so Ctrl+P behaves exactly like the
// button and the scale always matches whatever is on screen right now.
window.addEventListener('beforeprint', () => {
  expandFully();
  updatePrintStyle();
});

// The print rules leave the on-screen layout alone, but the schedule may have
// grown while expanding, so re-center once the dialog closes.
window.addEventListener('afterprint', centerCalendar);

// Keep the calendar centered as the window resizes.
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(centerCalendar, 150);
});
