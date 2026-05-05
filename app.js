
const group = window.FCCB_DATA.groups[0];
const STORAGE_KEY = "fccb-small-groups-progress-v1";
const ONE_DAY = 24 * 60 * 60 * 1000;

let progress = loadProgress();

function localDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function parseLocalDate(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function allReadings() {
  return group.months.flatMap(month =>
    month.days.map(day => ({ ...day, month: month.month, label: month.label }))
  );
}

function getReadingForDate(date) {
  const weekday = date.getDay(); // Sun=0, Mon=1, Tue=2...
  if (weekday === 0) return { type: "event", title: group.sundayService.title, time: group.sundayService.time };
  if (weekday === 1) return { type: "event", title: group.mondayMeeting.title, time: group.mondayMeeting.time };

  const start = parseLocalDate(group.startDate);
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (current < start) return { type: "prestart" };

  let readingIndex = 0;
  for (let d = new Date(start); d <= current; d = new Date(d.getTime() + ONE_DAY)) {
    if (group.readingDays.includes(d.getDay())) {
      if (localDateKey(d) === localDateKey(current)) break;
      readingIndex++;
    }
  }

  const readings = allReadings();
  if (readingIndex >= readings.length) return { type: "complete" };

  return {
    type: "reading",
    dateKey: localDateKey(current),
    scheduleIndex: readingIndex,
    ...readings[readingIndex]
  };
}

function getProgressForDay(dayObj) {
  const key = `m${dayObj.month}-d${dayObj.day}`;
  return progress[key] || [false, false, false, false];
}

function setProgressForDay(dayObj, readingIndex, checked) {
  const key = `m${dayObj.month}-d${dayObj.day}`;
  const current = getProgressForDay(dayObj);
  current[readingIndex] = checked;
  progress[key] = current;
  saveProgress();
  render();
}

function dayCompletion(dayObj) {
  const p = getProgressForDay(dayObj);
  return Math.round((p.filter(Boolean).length / dayObj.readings.length) * 100);
}

function makeReadingCard(dayObj, titlePrefix = "") {
  const card = document.createElement("article");
  card.className = "card day-card";

  const h = document.createElement("h3");
  h.innerHTML = `<span>${titlePrefix}${dayObj.label} · Day ${dayObj.day}</span><span class="day-meta">${dayCompletion(dayObj)}%</span>`;
  card.appendChild(h);

  const p = getProgressForDay(dayObj);

  dayObj.readings.forEach((r, index) => {
    const id = `m${dayObj.month}-d${dayObj.day}-r${index}`;
    const row = document.createElement("div");
    row.className = "reading" + (p[index] ? " complete" : "");
    row.innerHTML = `
      <input type="checkbox" id="${id}" ${p[index] ? "checked" : ""}>
      <label for="${id}">
        <span class="section-label">${r.section}</span>
        <span class="book">${r.book}</span> <span class="passage">${r.passage}</span>
      </label>
    `;
    row.querySelector("input").addEventListener("change", e => setProgressForDay(dayObj, index, e.target.checked));
    card.appendChild(row);
  });

  return card;
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
    document.getElementById("todaySub").textContent = "You reached the end of the current loaded schedule.";
    document.getElementById("todayPercent").textContent = "✓";
    view.innerHTML = `<article class="card empty">Month 4 is loaded in this first version. Add more months in data.js as needed.</article>`;
  }
}

function weekDates(date) {
  const day = date.getDay();
  const tuesdayOffset = day >= 2 ? 2 - day : -5 - day; // previous Tuesday
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
    if (item.type === "reading" && dayCompletion(item) < 100) {
      unfinished.push({ item, date: new Date(d) });
    }
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
      <small class="help">This first version starts Tuesday, May 5, 2026, with Month 4 of the reading plan. It stores progress only on this device.</small>
      <div class="button-row" style="margin-top:14px">
        <button class="action secondary" id="clearProgress">Reset progress</button>
      </div>
      <small class="help">To install: open this page in Safari or Chrome, then use “Add to Home Screen.”</small>
    </article>
  `;
  document.getElementById("clearProgress").addEventListener("click", () => {
    if (confirm("Reset all reading progress on this device?")) {
      progress = {};
      saveProgress();
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
