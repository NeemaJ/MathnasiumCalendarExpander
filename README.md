# Mathnasium Calendar Expander

A tiny Chrome extension that removes the scroll clipping on the Radius
scheduling calendar (`https://radius.mathnasium.com/Scheduling/Calendar...`)
so the whole day's schedule is visible and prints in one piece.

## Install (unpacked, local use)

1. Unzip this folder somewhere permanent (don't delete it after installing —
   Chrome loads the extension from this folder each time).
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select this folder.
5. Visit the calendar page. After a second or so it auto-expands. If you
   change the date or center, it re-expands automatically.
6. Two buttons appear in the top-right corner:
   - **Expand for printing** — just removes the scroll clipping (use this
     if you want to look at the full schedule on screen).
   - **Print schedule** — expands the calendar, switches the page to
     landscape, automatically shrinks the schedule to fit the page width,
     and opens the print dialog. Leave the dialog's scale at the default
     100% — the shrinking is already done for you.

## Notes

- This only affects your own browser's view of the page — it doesn't change
  anything on Mathnasium's servers or for anyone else.
- It only runs on the specific Scheduling/Calendar URL, and requests no
  special permissions.
