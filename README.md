# Techboard

Teacher-only display board. Open `index.html` (or https://jasonross-eng.github.io) and project it.

## Grades
The 1st, 2nd, 3rd, 4th and Specials buttons at the top switch the board to that class. The clock and timer stay the same. "This week" and Teacher Clarity change with the grade. The board remembers the last grade picked.

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

## Must Do / May Do
The green Must Do / May Do button opens two checklists for the grade that is picked. Tap Edit to type the jobs, then Done. Tap a job to check it off. Uncheck all clears the checks for the next class. Saved on that device only, one pair of lists per grade.

## Scores
The Scores button (top right) opens a team scoreboard for the grade that is picked. Teams - / + sets how many teams. Tap a team name to rename it. Tap + or - to change points. Reset scores sets everyone to 0. Saved on that device only. Class race turns the scoreboard into a race between your homerooms for that grade (the classes from the Picker); points stay until you tap New round.

## Picker
The Picker button (top right) turns the picker card on or off. Each grade can hold several classes. Tap + Add class, type the teacher's name, then the students (one per line, or copy the names column from your Google Sheet), and tap Save. Tap a teacher's name at the top of the card to choose that class. Then pick a tab:
- Cold call: tap Pick for a random name. With No repeats on, everyone in that class gets called before anyone is called again; Start over resets that.
- Special seats: tap Pick to fill the seats (1 or 2) from students who have not sat yet. Tap Mark sat when the student sits there. Checklist shows everyone; tap a name to check or uncheck it. Start over unchecks everyone.

- Notes: where this class left off. Saved as you type. Students can see it on the board.
- Exit check: tap 👍 👌 or 👎 once for each student's answer. Today's tally is saved for that class, and the last few days are listed under it.

Read aloud says the picked name out loud. Tap it to turn it off.

Edit class changes the names or removes the class. The names are saved on that device only, never on the public site.

Use Sheet on the card shows your Google Sheet instead. Script buttons in the sheet do not work inside the board; use Open in tab for those.

Use Arrange to move the card or make it bigger or smaller.

## Fill the screen
Each card (clock, timer, This week, picker) has a round button with four corners, next to its - button. Tap it and that card fills the whole screen. Tap it again (or the edge around it) to put it back.

## Small and big cards
The clock, timer and "This week" each have a small round button. Tap - to make that card small, tap + to make it big again. Hide (top right) hides the top row of buttons. Tap the faint Menu button at the top right to bring it back.

## Arrange
Tap Arrange (top right). Drag a card to move it. Drag its yellow corner to make it bigger or smaller. Tap Done. Reset layout puts everything back. Saved on that device only.

## Backgrounds
Each grade has its own background. Tap the grade, tap Background, then pick a color or Upload picture. Saved on that device only.

## More menu
Countdown and Background moved into More (top right). More also has:
- Backup and restore: Save a backup file now and then and keep it in Google Drive or on a flash drive. Restore from a file puts it back, or copies your setup to another computer. Every day: On saves a backup by itself on your first tap of each school day. The file has student names in it, so keep it private.
- Noise meter: also turned on with the Noise meter button under the voice levels in the clock. It shows how loud the room is in a bar at the bottom of the clock. The settings button at the end of the bar has the limit, the sound and Reset. Move the Limit slider; above it, the card flashes Too loud! and plays the sound you pick (Chime, Bell, Shh, Beep beep or No sound; Test plays it). Went off counts how many times; Reset sets it back to 0. It uses the microphone only to measure, and records nothing.
- Schedule: add each class start time for each day. Turn it On, and the board switches grade and picker class by itself when each class starts.
- Sub mode: hides editing and the picker. You pick a code; the red Exit sub mode button asks for it.

## Start class
The green Start class button (top right): starts a 10 minute Typing Club timer (change it under Edit in the timer), voice level 0, Must Do / May Do checks cleared, and Teacher Clarity for the grade on the screen.

## Clean-up warning
Classes are 45 minutes. 5 minutes before the end (counting from when you tap Start class, or when the Schedule starts the class), a big warning pops up with a sound and a 5 minute Clean up timer starts. Tap to close the popup; the timer keeps going. While a class is running, a "Clean up at 10:40" button shows under the date. Tap it to move this class's warning earlier or later, pick an exact time, warn now, or skip it for this class. More, then Clean-up warning, opens the same box, and also sets the class length and warning time for every class (0 turns it off).

## Poll
More, then Poll. Pick Smileys, Thumbs or Multiple choice, type a question if you like, and tap Start poll. Tap an answer on the board to add a vote. Student devices: On shows a code and a QR code; students go to the vote page, type the code and tap their answer. Their votes show up on the board. Votes go through a free service called ntfy.sh (no names, only the code and the answer). If the board says it cannot reach the vote service, the school filter is blocking it.

## Dice, websites and pictures
More, then Dice: tap Roll. Plus and minus change how many dice (1 to 6).
More, then Embed a website: paste a link and it shows inside its own widget. Some websites do not allow this; use Open in tab.
More, then Add a picture: pick a picture and it becomes its own widget. Remove takes it off. Pictures stay on that device only.
Move or resize any of them with Arrange.

## Groups
In the Picker, tap the Groups tab. Pick People per group or Number of groups, then Make groups. The board remembers the groups for that class. Tap a name, then another name, to swap them. Or tap a name, then a different group, to move them. New groups makes a fresh set.

## QR code
More, then QR code: paste a link and tap Show QR code. The board shows a giant QR code to scan, with the link under it. Change link swaps it. One link per grade.

## Attention and timer labels
Attention (yellow, top right) fills the screen with "Eyes on me!" and a chime. Tap to close. Change words is on that screen.
The dashed buttons in the timer start a timer with words above it, like Clean up. Edit changes them.

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
