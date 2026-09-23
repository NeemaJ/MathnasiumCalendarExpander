// Mathnasium Calendar Expander -- student ordering
//
// Lists students who share a time block in alphabetical order by first name.
//
// The page stacks students onto rows in whatever order the server sends them,
// so reordering has to happen in the calendar's data, not in what it draws:
// each event carries its student, and clicking one opens that student's
// record, so swapping names around on screen would open the wrong student.
//
// This runs in the page's own JavaScript world, before any of its scripts, so
// it can catch the calendar library as it loads and sort the events the page
// hands it before the first render. Screen and print then both show the
// sorted order, with nothing to redraw afterwards.

(() => {
  // The on/off switch content.js puts on the page. Same key as there; keep
  // the two in step.
  try {
    if (localStorage.getItem('mnCalendarExpander.enabled') === '0') return;
  } catch {
    // Storage blocked: stay on, which is the default.
  }

  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

  const firstName = (event) => String(event.title || '').trim().split(/\s+/)[0];

  // By first name, then by the full name so that two students who share a
  // first name still come out in a stable, sensible order.
  const byFirstName = (a, b) =>
    collator.compare(firstName(a), firstName(b)) ||
    collator.compare(String(a.title || ''), String(b.title || ''));

  // Students with the same start and end already sit on separate rows. Keep
  // exactly those rows and only change who sits on which: every student in
  // the group occupies the same stretch of time, so any arrangement among
  // their own rows is as free of overlaps as the one the page chose.
  function sortSameTimeRows(events) {
    const groups = new Map();
    for (const event of events) {
      if (!event || event.resourceId == null) continue;
      const key = `${event.start}|${event.end}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(event);
    }

    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const rows = group.map((e) => e.resourceId).sort((a, b) => Number(a) - Number(b));
      group.slice().sort(byFirstName).forEach((event, i) => {
        event.resourceId = rows[i];
      });
    }
  }

  // The library is a plain `var EventCalendar = ...` global, and the page
  // calls EventCalendar.create(element, { events, ... }). Declaring the
  // global's slot as an accessor ahead of time means that assignment lands in
  // the setter below, which wraps `create` before the page ever calls it.
  let library;
  Object.defineProperty(window, 'EventCalendar', {
    configurable: true,
    enumerable: true,
    get() {
      return library;
    },
    set(value) {
      if (value && typeof value.create === 'function' && !value.create.mnSorted) {
        const create = value.create;
        value.create = function (element, options) {
          if (options && Array.isArray(options.events)) sortSameTimeRows(options.events);
          return create.call(this, element, options);
        };
        value.create.mnSorted = true;
      }
      library = value;
    },
  });
})();
