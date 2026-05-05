
const group = window.FCCB_DATA.groups[0];
const STORAGE_KEY = "fccb-small-groups-progress-v2";
const NOTES_KEY = "fccb-small-groups-notes-v1";
const ONE_DAY = 24 * 60 * 60 * 1000;

let progress = loadJson(STORAGE_KEY, {});
let notes = loadJson(NOTES_KEY, {});

function loadJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}
function saveJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function parseLocalDate(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function keyDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function formatDate(date) {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function allReadings() {
  const startMonth = group.startMonth || 1;
  const ordered = [
    ...group.months.filter(m => m.month >= startMonth),
    ...group.months.filter(m => m.month < startMonth)
  ];
  return ordered.flatMap(month => month.days.map(day => ({ ...day, month: month.month, label: month.label })));
}
function scheduleIndexForDate(date) {
  const start = parseLocalDate(group.startDate);
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (current < start) return -1;
  let index = 0;
  for (let d = new Date(start); d <= current; d = new Date(d.getTime() + ONE_DAY)) {
    if (!group.readingDays.includes(d.getDay())) continue;
    if (keyDate(d) === keyDate(current)) return index;
    index++;
  }
  return -1;
}
function getReadingForDate(date) {
  const weekday = date.getDay();
  if (weekday === 0) return { type: "event", title: group.sundayService.title, time: group.sundayService.time };
  if (weekday === 1) return { type: "event", title: group.mondayMeeting.title, time: group.mondayMeeting.time };
  const idx = scheduleIndexForDate(date);
  if (idx < 0) return { type: "prestart" };
  const readings = allReadings();
  if (idx >= readings.length) return { type: "complete" };
  return { type: "reading", dateKey: keyDate(date), scheduleIndex: idx, ...readings[idx] };
}
function progressKey(dayObj) { return `m${dayObj.month}-d${dayObj.day}`; }
function getProgressForDay(dayObj) { return progress[progressKey(dayObj)] || [false,false,false,false]; }
function setProgressForDay(dayObj, readingIndex, checked) {
  const current = getProgressForDay(dayObj);
  current[readingIndex] = checked;
  progress[progressKey(dayObj)] = current;
  saveJson(STORAGE_KEY, progress);
  render();
}
function setWholeDay(dayObj, checked) {
  progress[progressKey(dayObj)] = dayObj.readings.map(() => checked);
  saveJson(STORAGE_KEY, progress);
  render();
}
function noteKey(dayObj) { return `note-m${dayObj.month}-d${dayObj.day}`; }
function getNote(dayObj) { return notes[noteKey(dayObj)] || ""; }
function setNote(dayObj, value) {
  notes[noteKey(dayObj)] = value;
  saveJson(NOTES_KEY, notes);
}
function dayCompletion(dayObj) {
  const p = getProgressForDay(dayObj);
  return Math.round((p.filter(Boolean).length / dayObj.readings.length) * 100);
}

const BIBLE_COM_BOOKS = {
  "Genesis": "GEN", "Exodus": "EXO", "Leviticus": "LEV", "Numbers": "NUM", "Deuteronomy": "DEU",
  "Joshua": "JOS", "Judges": "JDG", "Ruth": "RUT", "1 Samuel": "1SA", "2 Samuel": "2SA",
  "1 Kings": "1KI", "2 Kings": "2KI", "1 Chronicles": "1CH", "2 Chronicles": "2CH",
  "Ezra": "EZR", "Nehemiah": "NEH", "Esther": "EST", "Job": "JOB", "Psalms": "PSA",
  "Proverbs": "PRO", "Ecclesiastes": "ECC", "Song of Songs": "SNG", "Isaiah": "ISA", "Jeremiah": "JER",
  "Lamentations": "LAM", "Ezekiel": "EZK", "Daniel": "DAN", "Hosea": "HOS", "Joel": "JOL",
  "Amos": "AMO", "Obadiah": "OBA", "Jonah": "JON", "Micah": "MIC", "Nahum": "NAM",
  "Habakkuk": "HAB", "Zephaniah": "ZEP", "Haggai": "HAG", "Zechariah": "ZEC", "Malachi": "MAL",
  "Matthew": "MAT", "Mark": "MRK", "Luke": "LUK", "John": "JHN", "Acts": "ACT",
  "Romans": "ROM", "1 Corinthians": "1CO", "2 Corinthians": "2CO", "Galatians": "GAL",
  "Ephesians": "EPH", "Philippians": "PHP", "Colossians": "COL",
  "1 Thessalonians": "1TH", "2 Thessalonians": "2TH", "1 Timothy": "1TI", "2 Timothy": "2TI",
  "Titus": "TIT", "Philemon": "PHM", "Hebrews": "HEB", "James": "JAS",
  "1 Peter": "1PE", "2 Peter": "2PE", "1 John": "1JN", "2 John": "2JN", "3 John": "3JN",
  "Jude": "JUD", "Revelation": "REV"
};

function bibleComUrl(book, passage) {
  const abbr = BIBLE_COM_BOOKS[book];
  if (!abbr) return null;

  const cleaned = String(passage).trim().replace(/\s+/g, "");

  // Same-chapter verse ranges, e.g. 1:1-17, 119:1-8, 3:14-22
  let match = cleaned.match(/^(\d+):(\d+)(?:-(\d+))?$/);
  if (match) {
    const chapter = match[1];
    const versePart = match[3] ? `${match[2]}-${match[3]}` : match[2];
    return `https://www.bible.com/bible/111/${abbr}.${chapter}.${versePart}.NIV`;
  }

  // Full chapter, e.g. 16, 3, 150
  match = cleaned.match(/^(\d+)$/);
  if (match) {
    return `https://www.bible.com/bible/111/${abbr}.${match[1]}.NIV`;
  }

  // Multi-chapter or mixed range, e.g. 1-2, 25-26, 22:12-31.
  // For multi-chapter readings, link to the first chapter.
  match = cleaned.match(/^(\d+)(?::\d+)?-/);
  if (match) {
    return `https://www.bible.com/bible/111/${abbr}.${match[1]}.NIV`;
  }

  return `https://www.bible.com/bible/111/${abbr}.1.NIV`;
}

function readingLinkMarkup(reading) {
  const url = bibleComUrl(reading.book, reading.passage);
  const text = `<span class="book">${escapeHtml(reading.book)}</span> <span class="passage">${escapeHtml(reading.passage)}</span>`;
  if (!url) return text;
  return `<a class="bible-link" href="${url}" target="_blank" rel="noopener noreferrer" title="Open in Bible.com">${text}<span class="external-icon" aria-hidden="true">↗</span></a>`;
}

function makeReadingCard(dayObj, titlePrefix = "") {
  const card = document.createElement("article");
  card.className = "card day-card";

  const h = document.createElement("h3");
  h.innerHTML = `<span>${titlePrefix}${dayObj.label} · Day ${dayObj.day}</span><span class="day-meta">${dayCompletion(dayObj)}%</span>`;
  card.appendChild(h);

  const topActions = document.createElement("div");
  topActions.className = "mini-actions";
  topActions.innerHTML = `
    <button class="mini-button complete-day">Mark whole day complete</button>
    <button class="mini-button clear-day">Clear day</button>
  `;
  topActions.querySelector(".complete-day").addEventListener("click", () => setWholeDay(dayObj, true));
  topActions.querySelector(".clear-day").addEventListener("click", () => setWholeDay(dayObj, false));
  card.appendChild(topActions);

  const p = getProgressForDay(dayObj);
  dayObj.readings.forEach((r, index) => {
    const id = `m${dayObj.month}-d${dayObj.day}-r${index}-${Math.random().toString(36).slice(2)}`;
    const row = document.createElement("div");
    row.className = "reading" + (p[index] ? " complete" : "");
    row.innerHTML = `
      <input type="checkbox" id="${id}" ${p[index] ? "checked" : ""}>
      <label for="${id}">
        <span class="section-label">${r.section}</span>
        ${readingLinkMarkup(r)}
      </label>
    `;
    row.querySelector("input").addEventListener("change", e => setProgressForDay(dayObj, index, e.target.checked));
    card.appendChild(row);
  });

  const noteWrap = document.createElement("details");
  noteWrap.className = "notes";
  noteWrap.innerHTML = `
    <summary>Notes / Reflection</summary>
    <textarea placeholder="Write a private note for this day...">${escapeHtml(getNote(dayObj))}</textarea>
    <small class="help">Saved privately on this device.</small>
  `;
  const textarea = noteWrap.querySelector("textarea");
  textarea.addEventListener("input", e => setNote(dayObj, e.target.value));
  card.appendChild(noteWrap);

  return card;
}
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
function makeEventCard(event, date) {
  const card = document.createElement("article");
  card.className = "card event-card";
  card.innerHTML = `<p class="eyebrow">${formatDate(date)}</p><h3>${event.title}</h3><p>${event.time}</p><small class="help">No assigned reading today. Use this as a rest, worship, discussion, or catch-up day.</small>`;
  return card;
}
function renderToday() {
  const today = new Date();
  const item = getReadingForDate(today);
  document.getElementById("dateLabel").textContent = formatDate(today);
  const view = document.getElementById("todayView");
  view.innerHTML = "";

  if (item.type === "reading") {
    document.getElementById("todayTitle").textContent = `${item.label} · Day ${item.day}`;
    document.getElementById("todaySub").textContent = "Today’s four readings";
    document.getElementById("todayPercent").textContent = `${dayCompletion(item)}%`;
    view.appendChild(makeReadingCard(item));
  } else if (item.type === "event") {
    document.getElementById("todayTitle").textContent = item.title;
    document.getElementById("todaySub").textContent = item.time;
    document.getElementById("todayPercent").textContent = "—";
    view.appendChild(makeEventCard(item, today));
  } else if (item.type === "prestart") {
    document.getElementById("todayTitle").textContent = "Plan starts soon";
    document.getElementById("todaySub").textContent = `The current schedule starts on ${group.startDate}.`;
    document.getElementById("todayPercent").textContent = "—";
    view.innerHTML = `<article class="card empty">The first reading appears on Tuesday, May 5, 2026.</article>`;
  } else {
    document.getElementById("todayTitle").textContent = "Plan complete";
    document.getElementById("todaySub").textContent = "You reached the end of the loaded schedule.";
    document.getElementById("todayPercent").textContent = "✓";
    view.innerHTML = `<article class="card empty">The full 12-month plan is complete.</article>`;
  }
}
function weekDates(date) {
  const day = date.getDay();
  const tuesdayOffset = day >= 2 ? 2 - day : -5 - day;
  const tuesday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + tuesdayOffset);
  return [0,1,2,3,4].map(i => new Date(tuesday.getFullYear(), tuesday.getMonth(), tuesday.getDate() + i));
}
function renderWeek() {
  const view = document.getElementById("weekView");
  view.innerHTML = "";
  weekDates(new Date()).forEach(date => {
    const item = getReadingForDate(date);
    if (item.type === "reading") {
      view.appendChild(makeReadingCard(item, `${date.toLocaleDateString(undefined, { weekday: "short" })}: `));
    }
  });
}
function renderCatchup() {
  const view = document.getElementById("catchupView");
  view.innerHTML = "";
  const today = new Date();
  const start = parseLocalDate(group.startDate);
  const unfinished = [];
  for (let d = new Date(start); d <= today; d = new Date(d.getTime() + ONE_DAY)) {
    if (!group.readingDays.includes(d.getDay())) continue;
    const item = getReadingForDate(d);
    if (item.type === "reading" && dayCompletion(item) < 100) unfinished.push({ item, date: new Date(d) });
  }
  if (!unfinished.length) {
    view.innerHTML = `<article class="card empty">You are caught up on all loaded readings.</article>`;
    return;
  }
  unfinished.forEach(({item, date}) => {
    view.appendChild(makeReadingCard(item, `${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}: `));
  });
}
function renderSettings() {
  const view = document.getElementById("settingsView");
  view.innerHTML = `
    <article class="card">
      <h3>Settings</h3>
      <small class="help">This version includes all 12 months of the reading plan. The active schedule begins with Month 4 on Tuesday, May 5, 2026, then continues Month 5, Month 6, and so on.</small>
      <div class="button-row" style="margin-top:14px">
        <button class="action secondary" id="clearProgress">Reset progress</button>
        <button class="action secondary" id="clearNotes">Delete notes</button>
      </div>
      <small class="help">To install: open this page in Safari or Chrome, then use “Add to Home Screen.”</small>
    </article>
  `;
  document.getElementById("clearProgress").addEventListener("click", () => {
    if (confirm("Reset all reading progress on this device?")) {
      progress = {};
      saveJson(STORAGE_KEY, progress);
      render();
    }
  });
  document.getElementById("clearNotes").addEventListener("click", () => {
    if (confirm("Delete all notes on this device?")) {
      notes = {};
      saveJson(NOTES_KEY, notes);
      render();
    }
  });
}
function render() {
  renderToday();
  renderWeek();
  renderCatchup();
  renderSettings();
}
document.querySelectorAll(".tab").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.view + "View").classList.add("active");
  });
});
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js"));
}
render();
