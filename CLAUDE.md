# Tech Board: notes for Claude

## Who and what
- Elementary technology teacher, grades K-5. Teaches in a room with a Newline board.
- Teacher-only display board, projected in class.
- Live at https://jasonross-eng.github.io (repo jasonross-eng/jasonross-eng.github.io, GitHub Pages from main, root).
- Started as a copy of smithpick/smithpick.github.io. The guides, icons, and weekly plan that came with it are another teacher's and will be trimmed over time.
- New to GitHub. Explain steps in plain words and say exactly what to click.

## Rules
- Public repo and site. No student names, class lists, class codes, or student faces in screenshots. Teacher's own name: keep it off the site (the sub note is signed with no name).
- Kid-facing visuals use real screenshots, not drawings. Kindergartners need to see the exact thing they tap. Exception already in place: the generic Seesaw "Tech Activity" card (guides/2026-11-11-seesaw/3.jpg).
- Low maintenance. Has to survive a low-prep week.
- No em dashes. Short labels. Big text for a projector.
- Work step by step. Don't rework finished parts unless asked. Commit and push after each change.
- Original login-steps.html and login-practice.html stay untouched.

## Files
- index.html: the board. Grade tabs in the top bar (1st, 2nd, 3rd, 4th; one page, the tab only swaps the plan and Teacher Clarity words; last grade is remembered on that device). Yellow Teacher Clarity tab opens a full-screen page for the picked grade: Today I will / So I can / I know I have it when. Its Edit button lets the teacher type on the board (saved on that device only, per week and grade; Reset goes back to plans.js). Clock (compact, text only; the tiger avatar and tap-to-celebrate from the original were removed, the teacher may add their own images later), timer (1/2/3/5/10 min, +/-1, chime), weekly plan panel, steps viewer, guide viewer (Wall / Big; Edit button lets the teacher tap steps to hide or show them, saved on that device only, remaining steps renumber), All pages list. Hide and order, both saved on that device only: the Edit button on the This week panel gives each row Up, Down and Hide/Show buttons (order is kept per week and grade); the Edit button in All pages lets the teacher tap rows to hide or show them. There is one hidden list for the whole board, so a hidden guide, page or link is gone from This week (every grade) and from All pages until it is shown again in Edit, backgrounds (Black + purple is default: purple cards #2a0f58 / #391273 with white accents; Black + green still an option), Draw layer (pen/arrow/circle; its white bar uses fixed dark text so it reads in every theme), big Home button on full-screen pages.
- plans.js: one block per week, keyed by that week's Monday (YYYY-MM-DD). Each week has grades: { "1": { clarity: { will, so, know }, items: [...] }, ... "4" }. A grade with no items list falls back to a week-level items list if there is one. Optional icon: "icons/name.png" (real app icon cropped from screenshots, rounded square) replaces the number. Board opens to the newest week that has started. Future weeks can be added ahead. Old weeks stay.
- guides.js: step guides. id format YYYY-MM-DD-name. Optional practice: "page.html" adds a yellow Practice button on the guide and a Steps button on that page (Teach Your Monster uses login-practice.html). Images in guides/<guide id>/1.jpg, 2.jpg... Old guides stay and show in All pages.
- keyboard.html: projected Chromebook keyboard (lowercase keys, search key, Chromebook top row). Tap a key to light it orange (tap again to unlight, Clear resets). Typing on a real keyboard flashes that key. Opens as an overlay from anywhere: Keyboard button in the home top bar and next to Draw on guide/practice pages; Close keyboard returns to the same spot. Also works alone at jasonross-eng.github.io/keyboard.html. Drawn, not a screenshot, on purpose.
- sub.html, sub-note.pdf, sub-qr.svg: printable half-sheet sub note with QR code to the board.
- Google Slides links auto-open in present mode.

## Building a guide
- The teacher uploads screenshots and says what kids tap.
- All app guides start from Classlink (kids get there on their own). Google Classroom based guides start "Tap Google Classroom", "Tap Technology", then Quick Links.
- Shared first step: guides/classlink.jpg, "Open Classlink". It is the original teacher's full Classlink page (teacher view, staff apps left in, Frontline tooltip removed, Google Classroom / Seesaw labels rebuilt). Replace it with this teacher's own screenshot when they send one. It is step 1 of all five guides; new guides start with it too.
- Crop to what kids need. If an icon sits in a different place for kids, crop tight to the icon only.
- Box tap targets in orange (#ff7a00 style rounded box). A big orange arrow is fine for "Scroll down".
- Cover teacher-only UI (remove buttons, tooltips, gradebook stats) with plain background.
- Kid-friendly words: "Tap the apple", "Find the purple S", "Find the green robot", "Pick one".
- Test in Playwright (Wall and Big, desktop and phone), then push.

## Current guides
All five came with the copied board. Remove or replace as asked.
- Log in to Teach Your Monster (10 steps: Open Classlink full page, original login page images, then Monster to Read tile, then your monster, NOT Practice)
- How to open INFOhio (Open Classlink, Infohio tile, Grades K-5, Scroll down, Tap the apple, Pick one)
- How to open TypeTastic (Open Classlink, Classroom, Technology, Quick Links TypeTastic, red fox, Pick a game)
- How to open Tap Lights (Open Classlink, Classroom, Technology, Quick Links Tap Lights, Pick one)
- How to open Seesaw (Open Classlink, purple S, green robot, Tap Start on generic card)

## Weekly plan
- Week of Nov 9, 2026: all four grades have the same list (Typing Club first, link to typingclub.com with the teacher's own icon, then the copied Teach Your Monster, Login Practice, Classroom, TapLights) and blank Teacher Clarity words.
- That list came with the copied board. The teacher will say what goes on each grade.

## Open items
- Sub access: check whether the Newline board's built-in browser opens the site without a login; if so bookmark it. Phone + QR is the fallback.
- Teacher may add their own image by the clock later.
- Trim the copied guides and weekly plan to what this teacher uses.
