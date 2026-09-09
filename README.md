# Mathnasium Calendar Expander

A tiny Chrome extension for the Radius scheduling calendar
(`https://radius.mathnasium.com/Scheduling/Calendar...`). It removes the
scroll clipping so the whole day's schedule is visible on screen, centers it,
and makes it print at full page width in landscape.

## Install (unpacked, local use)

1. Unzip this folder somewhere permanent (don't delete it after installing —
   Chrome loads the extension from this folder each time).
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this folder.
5. Visit the calendar page. After a second or so it auto-expands and centers.
   If you change the date or center, it re-expands automatically.
6. Two buttons appear in the top-right corner:
   - **Expand for printing** — removes the scroll clipping and centers the
     schedule on screen.
   - **Print schedule** — opens the print dialog.

Leave the print dialog's scale at the default 100% and its layout at whatever
it defaults to — the extension sets landscape and does the sizing itself.
Printing with Ctrl+P / Cmd+P gives exactly the same result as the button.

## Printing

The schedule is scaled to span the full width of one landscape page, and then
runs to whatever height that gives it -- continuing onto a second page if the
day is long. The scale is a single uniform factor, so nothing is stretched or
squashed and the text keeps its shape.

Everything else on the page -- nav, sidebar, footer, the extension's own
buttons -- is removed from the print, so none of it can crop the schedule or
add blank pages.

One setting at the top of `content.js`: `PAGE` is the paper width in inches,
defaulting to US Letter in landscape (`{ width: 11, margin: 0.3 }`). For A4
landscape, use `{ width: 11.69, margin: 0.3 }`.

## Notes

- This only affects your own browser's view of the page — it doesn't change
  anything on Mathnasium's servers or for anyone else.
- It only runs on the specific Scheduling/Calendar URL, and requests no
  special permissions.
