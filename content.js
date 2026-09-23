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

// On/off switch, remembered per browser. Kept in the page's localStorage
// rather than chrome.storage because sort-students.js has to read it too, from
// the page's own world, synchronously, before any of the page's scripts run --
// and chrome.storage is neither synchronous nor reachable from there. The key
// is duplicated in that file; keep the two in step.
const ENABLED_KEY = 'mnCalendarExpander.enabled';

function isEnabled() {
  try {
    return localStorage.getItem(ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

// Reload rather than tear down in place: students are sorted before the
// calendar is first drawn, so the original order only comes back with a fresh
// draw, and a fresh page is also the one state guaranteed to have none of the
// extension's changes left in it.
function setEnabled(on) {
  try {
    localStorage.setItem(ENABLED_KEY, on ? '1' : '0');
  } catch {
    return;
  }
  location.reload();
}

const enabled = isEnabled();

// --- Expanding -----------------------------------------------------------

// Used for height only. An element whose children simply overflow it, with
// overflow:visible, is hiding nothing vertically -- and forcing a height on it
// inflates the row, then feeds the next pass and ratchets further.
const CLIPS = /auto|scroll|hidden|clip/;

// Whether an element is too narrow for the boxes inside it -- the calendar
// being squeezed -- as opposed to too narrow for its own text. The two look
// the same to scrollWidth, but only the first is ours to undo. Text that runs
// past a fixed-width cell is the page's own truncation: a "Blocked 03:00 PM"
// time label in its 100px column, say, where the site pins the width with
// !important so widening can't take, and making the overflow visible instead
// turns the label into a scroll box. An event block is no different: its
// width is its duration, and stretching it to fit a long name would show the
// session running past its end.
function boxOverflows(el) {
  // Measured as if unscrolled, so a scroll container that happens to be
  // scrolled all the way along still counts as clipping what's inside it.
  const edge = el.getBoundingClientRect().left + el.clientLeft + el.clientWidth - el.scrollLeft;

  // The box responsible needn't be a direct child: overflow carries up
  // through every element that doesn't clip it, which is how a widened body
  // pushes out past a calendar root whose own child is stretched to fit it.
  // A child that clips has contained whatever is inside it, so stop there.
  const search = (parent) => {
    for (const child of parent.children) {
      const style = getComputedStyle(child);
      if (style.display === 'none' || style.display === 'inline') continue;
      if (child.getBoundingClientRect().right > edge + 1) return true;
      if (style.overflowX === 'visible' && search(child)) return true;
    }
    return false;
  };
  return search(el);
}

function expandCalendar() {
  const root = document.querySelector(CAL);
  if (!root) return false;

  let changed = false;

  const fix = (el) => {
    // No clipping test on this axis: the calendar is held in by a max-width
    // while its overflow stays `visible`, so it never reads as clipping even
    // though its content is wider than it is and spills out of the card.
    // What's tested instead is where the overflow comes from.
    if (!el.dataset.mnW && el.scrollWidth > el.clientWidth + 1 && boxOverflows(el)) {
      el.dataset.mnW = '1';
      el.style.width = el.scrollWidth + 'px';
      el.style.maxWidth = 'none';
      el.style.overflowX = 'visible';
      changed = true;
    }
    // getComputedStyle is the costly part of this walk -- a thousand elements,
    // several passes -- so reach for it only on the handful that actually
    // overflow vertically.
    if (
      !el.dataset.mnH &&
      el.scrollHeight > el.clientHeight + 1 &&
      CLIPS.test(getComputedStyle(el).overflowY)
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
  };

  fix(root);
  for (const el of root.querySelectorAll('*')) fix(el);

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
    /* Once widened, the schedule reaches past the card it sits in, so the
       card's border is left running down through the middle of it. The
       calendar paints over its ancestors, so an opaque background hides that
       line -- which is exactly what happens by accident on today's date, where
       the site fills the current day's cells with white. Covering it costs no
       width; widening the card would push the page into a horizontal scroll,
       since the card is the schedule's width plus its own 2px borders. */
    ${CAL} { background-color: #fff !important; }
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

// --- Date heading --------------------------------------------------------

// Which day is on screen. The date picker holds it in the centre's own format
// (M/d/yyyy, which is what the page configures Kendo with); once you have
// stepped to another day the URL carries it as well, as an ISO date.
function scheduleDate() {
  const picker = document.getElementById('calendarDatePicker');
  const shown = picker && picker.value && picker.value.trim();
  if (shown) {
    const [month, day, year] = shown.split('/').map(Number);
    if (month && day && year) return new Date(year, month - 1, day);
  }

  const param = new URLSearchParams(location.search).get('Date');
  if (param) {
    const [year, month, day] = param.split('-').map(Number);
    if (year && month && day) return new Date(year, month - 1, day);
  }

  return null;
}

// A printed schedule loses every bit of context the page gives it -- the date
// picker included -- so print the day it belongs to above it. Kept out of the
// on-screen view, where the picker already says which day this is.
function updateDateHeading() {
  const date = scheduleDate();
  let heading = document.getElementById('mn-print-date');

  if (!date) {
    if (heading) heading.remove();
    return;
  }

  if (!heading) {
    heading = document.createElement('div');
    heading.id = 'mn-print-date';
    heading.style.display = 'none';
    document.body.insertBefore(heading, document.body.firstChild);
  }

  heading.textContent = date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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
      body > *:not(.${ANCESTOR_CLASS}):not(${CAL}):not(#mn-print-date),
      .${ANCESTOR_CLASS} > *:not(.${ANCESTOR_CLASS}):not(${CAL}) {
        display: none !important;
      }
      /* Sits outside the calendar, so the scale applied to the schedule
         doesn't shrink it along with everything else. */
      #mn-print-date {
        display: block !important;
        margin: 0 0 6pt !important;
        font: bold 12pt/1.25 system-ui, -apple-system, sans-serif !important;
        color: #000 !important;
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
      /* Nothing that scrolls on screen may scroll away on paper, so the
         calendar's own containers mustn't clip. Only those: the cells inside
         them clip their text on purpose -- a "Blocked 03:00 PM" label cut off
         at its 100px column -- and unclipping those as well prints each such
         label over the top of the next. */
      ${CAL}, ${CAL} .ec-header, ${CAL} .ec-body, ${CAL} .ec-sidebar, ${CAL} .ec-content {
        overflow: visible !important;
      }
      ${CAL}, ${CAL} * {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  `;
}

// --- UI ------------------------------------------------------------------

// Styles for the controls, needed whether the extension is on or off -- the
// switch stays on screen either way so it can be turned back on -- and they
// keep the controls off the printed page in both states.
function ensureControlsStyle() {
  if (document.getElementById('mn-controls-style')) return;
  const style = document.createElement('style');
  style.id = 'mn-controls-style';
  style.textContent = `
    /* Bottom right: the site puts its own account and search controls in the
       top right, and a fixed bar there sits on top of them. */
    #mn-btns {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 999999;
      display: flex;
      gap: 8px;
      align-items: center;
    }
    #mn-btns button {
      margin: 0;
      padding: 8px 14px;
      border: none;
      border-radius: 6px;
      font: 13px/1.2 system-ui, -apple-system, sans-serif;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
    }
    #mn-btns button:focus-visible {
      outline: 2px solid #1d4ed8;
      outline-offset: 2px;
    }
    #mn-print-btn {
      background: #1d4ed8;
      color: #fff;
    }
    #mn-toggle {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #fff;
      color: #111;
    }
    #mn-toggle .mn-track {
      position: relative;
      flex: none;
      width: 28px;
      height: 16px;
      border-radius: 8px;
      background: #9ca3af;
      transition: background 0.15s;
    }
    #mn-toggle .mn-track::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.15s;
    }
    #mn-toggle[aria-checked='true'] .mn-track {
      background: #16a34a;
    }
    #mn-toggle[aria-checked='true'] .mn-track::after {
      transform: translateX(12px);
    }
    @media print {
      #mn-btns { display: none !important; }
    }
  `;
  document.head.appendChild(style);
}

function addControls() {
  if (document.getElementById('mn-btns')) return;
  ensureControlsStyle();

  const wrap = document.createElement('div');
  wrap.id = 'mn-btns';

  // The print button is the extension's own, so it goes when the extension
  // is off: Ctrl+P then prints the page exactly as the site does.
  if (enabled) {
    const print = document.createElement('button');
    print.type = 'button';
    print.id = 'mn-print-btn';
    print.textContent = 'Print schedule';
    print.addEventListener('click', () => window.print());
    wrap.appendChild(print);
  }

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.id = 'mn-toggle';
  toggle.setAttribute('role', 'switch');
  toggle.setAttribute('aria-checked', String(enabled));
  toggle.title = enabled
    ? 'Turn the Calendar Expander off (reloads the page)'
    : 'Turn the Calendar Expander on (reloads the page)';

  const track = document.createElement('span');
  track.className = 'mn-track';
  track.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span');
  label.textContent = enabled ? 'Expander on' : 'Expander off';
  toggle.append(track, label);
  toggle.addEventListener('click', () => setEnabled(!enabled));
  wrap.appendChild(toggle);

  document.body.appendChild(wrap);
}

// --- Wiring --------------------------------------------------------------

function setUp() {
  if (enabled) {
    expandFully();
    updateDateHeading();
    updatePrintStyle();
  }
  addControls();
}

// Changing the date or the center navigates the browser to a fresh page
// (redirectToCalendar assigns window.location), so there is no AJAX re-render
// to chase and nothing to gain from watching the document. The only thing
// worth noticing is the calendar being swapped out in place, so watch its
// container alone: a document-wide subtree observer fires on every unrelated
// widget this page touches, and each firing costs a full relayout pass over a
// thousand elements.
function watchForRerender(root) {
  const parent = root.parentElement;
  if (!parent) return;
  let timer;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(setUp, 300);
  }).observe(parent, { childList: true });
}

// The page builds the calendar from its own script after load, so wait for it
// to appear rather than betting on a fixed delay.
let waited = 0;
const startup = setInterval(() => {
  const root = document.querySelector(CAL);
  if (root) {
    clearInterval(startup);
    setUp();
    if (enabled) watchForRerender(root);
  } else if ((waited += 200) >= 30000) {
    clearInterval(startup);
  }
}, 200);

if (enabled) {
  // Recompute immediately before printing, so Ctrl+P behaves exactly like the
  // button and the scale always matches whatever is on screen right now.
  window.addEventListener('beforeprint', () => {
    expandFully();
    updateDateHeading();
    updatePrintStyle();
  });

  // The print rules leave the on-screen layout alone, but the schedule may
  // have grown while expanding, so re-center once the dialog closes.
  window.addEventListener('afterprint', centerCalendar);

  // Keep the calendar centered as the window resizes.
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(centerCalendar, 150);
  });
}
