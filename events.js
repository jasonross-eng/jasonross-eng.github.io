// Event countdown: the strip that scrolls across the bottom of the board.
// It shows how many SCHOOL days are left until each event. Weekends are skipped on their own.
//
// The easy way to change this is on the board: tap Countdown (top right).
// Changes made on the board are saved on that device only.
// What is typed in this file is the starting list for every device.
//
//   on:       true shows the strip, false hides it
//   events:   one line per event. Date is YEAR-MONTH-DAY.
//               { name: "Winter Break", date: "2026-12-21" },
//   noSchool: days off between now and the events, so they are not counted.
//             One day:        ["2026-11-26", "2026-11-26"],
//             Several days:   ["2026-11-25", "2026-11-27"],
//
// Commas: every line in a list ends with a comma, except the last one.
// Public repo: no student names in this file.

const COUNTDOWN = {
  on: true,
  events: [
  ],
  noSchool: [
  ]
};
