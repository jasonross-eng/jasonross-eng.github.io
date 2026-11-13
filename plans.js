// One block per week. "week" is that week's Monday (YYYY-MM-DD).
// The board opens to the newest week that has started. Old weeks stay here as a record
// and can be picked from the week menu. Anything ever used shows under "All pages".
//
// Inside each week there is one part per grade: "1", "2", "3", "4".
// Each grade has:
//   clarity = the Teacher Clarity words for that grade
//       will: "Today I will ..."     so: "So I can ..."     know: "I know I have it when ..."
//     Type only the ending, inside the quotes. Example:  will: "log in to Typing Club",
//     Leave "" to fill it in on the board with the Edit button.
//   items = the buttons under "This week" for that grade
//
// Item types:
//   "guide" = a step guide from guides.js (opens full screen)
//   "steps" = a page in this repo (opens full screen)
//   "link"  = opens in a new tab
// Optional icon: "icons/name.png" shows a real app icon in place of the number.
//
// Commas: every line in a list ends with a comma, except the last one.
// Public repo: no student names, class lists, or class codes in this file.

const PLANS = [
  {
    week: "2026-11-09",
    grades: {
      // ---------- 1st grade ----------
      "1": {
        clarity: {
          will: "",
          so:   "",
          know: ""
        },
        items: [
          { label: "Typing Club",        type: "link",  url: "https://www.typingclub.com", icon: "icons/typingclub.png" },
          { label: "Teach Your Monster", type: "guide", guide: "2026-11-11-teach-your-monster", icon: "icons/tym.png" },
          { label: "Login Practice",     type: "steps", url: "login-practice.html", icon: "icons/practice.png" },
          { label: "Classroom",          type: "link",  url: "https://classroom.google.com", icon: "icons/classroom.png" },
          { label: "TapLights",          type: "link",  url: "https://sites.google.com/plsd.us/taplights-pkc/home", icon: "icons/taplights.png" }
        ]
      },
      // ---------- 2nd grade ----------
      "2": {
        clarity: {
          will: "",
          so:   "",
          know: ""
        },
        items: [
          { label: "Typing Club",        type: "link",  url: "https://www.typingclub.com", icon: "icons/typingclub.png" },
          { label: "Teach Your Monster", type: "guide", guide: "2026-11-11-teach-your-monster", icon: "icons/tym.png" },
          { label: "Login Practice",     type: "steps", url: "login-practice.html", icon: "icons/practice.png" },
          { label: "Classroom",          type: "link",  url: "https://classroom.google.com", icon: "icons/classroom.png" },
          { label: "TapLights",          type: "link",  url: "https://sites.google.com/plsd.us/taplights-pkc/home", icon: "icons/taplights.png" }
        ]
      },
      // ---------- 3rd grade ----------
      "3": {
        clarity: {
          will: "",
          so:   "",
          know: ""
        },
        items: [
          { label: "Typing Club",        type: "link",  url: "https://www.typingclub.com", icon: "icons/typingclub.png" },
          { label: "Teach Your Monster", type: "guide", guide: "2026-11-11-teach-your-monster", icon: "icons/tym.png" },
          { label: "Login Practice",     type: "steps", url: "login-practice.html", icon: "icons/practice.png" },
          { label: "Classroom",          type: "link",  url: "https://classroom.google.com", icon: "icons/classroom.png" },
          { label: "TapLights",          type: "link",  url: "https://sites.google.com/plsd.us/taplights-pkc/home", icon: "icons/taplights.png" }
        ]
      },
      // ---------- 4th grade ----------
      "4": {
        clarity: {
          will: "",
          so:   "",
          know: ""
        },
        items: [
          { label: "Typing Club",        type: "link",  url: "https://www.typingclub.com", icon: "icons/typingclub.png" },
          { label: "Teach Your Monster", type: "guide", guide: "2026-11-11-teach-your-monster", icon: "icons/tym.png" },
          { label: "Login Practice",     type: "steps", url: "login-practice.html", icon: "icons/practice.png" },
          { label: "Classroom",          type: "link",  url: "https://classroom.google.com", icon: "icons/classroom.png" },
          { label: "TapLights",          type: "link",  url: "https://sites.google.com/plsd.us/taplights-pkc/home", icon: "icons/taplights.png" }
        ]
      }
    }
  }
];
