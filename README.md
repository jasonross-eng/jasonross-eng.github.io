# Techboard

Teacher-only display board. Open `index.html` (or https://jasonross-eng.github.io) and project it.

## Grades
The 1st, 2nd, 3rd, 4th buttons at the top switch the board to that grade. The clock and timer stay the same. "This week" and Teacher Clarity change with the grade. The board remembers the last grade picked.

## Teacher Clarity
The yellow Teacher Clarity button shows three big lines for the grade that is picked: Today I will, So I can, I know I have it when.
- Type the words in `plans.js` (under that grade's `clarity`), or
- Tap Edit on the board, type, and tap Done. That copy is saved on that device only. Reset goes back to what is in `plans.js`.

## Weekly plan
`plans.js` has one block per week, keyed by that week's Monday. Inside each week, each grade ("1" to "4") has its own `clarity` words and its own `items` list. The board opens to the newest week that has started, so next week can be added ahead of time and it switches on its own Monday. Old weeks stay in the file and in the week menu.

Each item:
- `label`: short text on the button
- `type`: `"guide"` opens a guide from `guides.js`, `"steps"` opens a page full screen, `"link"` opens a new tab
- `url` or `guide`: what it opens. Leave `url` as `""` if the link isn't ready.
- `icon` (optional): `"icons/name.png"`, a real app icon shown in place of the number

"All pages" lists every guide and every page or link used in any week. Tap Edit there, then tap a row to hide it from the list. Tap it again in Edit to bring it back. Hiding is saved on that device only.

## Step guides
New guides go in `guides.js`, pictures in `guides/<guide id>/`. Old guides stay in the list and show under "All pages" on the board.
In a guide: Next/Back, "Show all" for the wall of cards, "Big" for one picture at a time.

## Keys
- D: draw on/off
- Esc: stop drawing, or close steps
- Left / Right: back / next on a steps page
- Ctrl+Z: undo last mark

## Rules
Public repo. No student names, class lists, or class codes.
