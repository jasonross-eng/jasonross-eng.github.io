# Techboard

Teacher-only display board. Open `index.html` (or https://jasonross-eng.github.io) and project it.

## Grades
The 1st, 2nd, 3rd, 4th buttons at the top switch the board to that grade. The clock and timer stay the same. "This week" and Teacher Clarity change with the grade. The board remembers the last grade picked.

## Teacher Clarity
The yellow Teacher Clarity button shows three big lines for the grade that is picked: Today I will, So I can, I know I have it when.
- Type the words in `plans.js` (under that grade's `clarity`), or
- Tap Edit on the board, type, and tap Done. That copy is saved on that device only. Reset goes back to what is in `plans.js`.

## Voice level
Next to the clock: tap 0, 1 or 2 to show the voice level (0 Silent, 1 Whisper, 2 Normal talking). Tap the lit number again to clear it.

## YouTube video
Tap Edit next to "This week". At the bottom is a YouTube video box: paste a link, type a button name if you want one, and tap Off to turn it On. A Video button joins that grade's list and plays the video inside the board. Saved on that device only, one video per grade.

## Slides or Canva
Same Edit box as the YouTube video, one below it: paste a Google Slides or Canva link, name the button, turn it On. The deck opens inside the board. Share the deck so anyone with the link can view, or it may ask for a login. Open in tab (bottom right) is the backup.

## Event countdown
A strip across the bottom shows how many school days are left until each event. Tap Countdown (top right) to turn it On or Off, add events, and add no school days (weekends are skipped already). That is saved on that device only. To set the list for every device, type it in `events.js`.

## Weekly plan
`plans.js` has one block per week, keyed by that week's Monday. Inside each week, each grade ("1" to "4") has its own `clarity` words and its own `items` list. The board opens to the newest week that has started, so next week can be added ahead of time and it switches on its own Monday. Old weeks stay in the file and in the week menu.

Each item:
- `label`: short text on the button
- `type`: `"guide"` opens a guide from `guides.js`, `"steps"` opens a page full screen, `"link"` opens a new tab
- `url` or `guide`: what it opens. Leave `url` as `""` if the link isn't ready.
- `icon` (optional): `"icons/name.png"`, a real app icon shown in place of the number

"All pages" lists every guide and every page or link used in any week.

## Hide and move (on the board)
- Edit next to "This week": each row gets an up arrow, a down arrow, Hide and Hide all. Tap Done when finished.
- Hide is for the grade you are on. Hide all hides it for every grade.
- Edit inside "All pages": tap a row to hide it for the grade you are on, tap again to bring it back.
- Both are saved on that device only. The order is kept for each grade and week.

## Step guides
New guides go in `guides.js`, pictures in `guides/<guide id>/`. Old guides stay in the list and show under "All pages" on the board.
In a guide: Next/Back, "Show all" for the wall of cards, "Big" for one picture at a time.

## Keys
- D: draw on/off (the draw bar has Blank page: a white or black page to draw on)
- Esc: stop drawing, or close steps
- Left / Right: back / next on a steps page
- Ctrl+Z: undo last mark

## Rules
Public repo. No student names, class lists, or class codes.
