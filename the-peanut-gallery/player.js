/* ============================================================
   EDIT HERE
   MP3s go in assets/audio as 01.mp3 … 11.mp3.
   A track only becomes playable once its file is really there;
   missing files show as "coming soon" and can't be clicked.
   ============================================================ */
const TRACKS = [
  { n: 1, title: "I'll See You Next Summertime", featured: true },
  { n: 2, title: "Office Jams" },
  { n: 3, title: "Western Eye", featured: true },
  { n: 4, title: "Midnight" },
  { n: 5, title: "Grace" },
  { n: 6, title: "Bubbles Jam" },
  { n: 7, title: "Midnight Funk" },
  { n: 8, title: "Deep Space" },
  { n: 9, title: "British Airways" },
  { n: 10, title: "Lilly's Room" },
  { n: 11, title: "I Close My Eyes" },
];
const AUDIO_DIR = "assets/audio/";
const EPK_PDF = "assets/press/the-peanut-gallery-epk.pdf";
/* ============================================================ */

const pad = (n) => String(n).padStart(2, "0");
const fileFor = (t) => `${AUDIO_DIR}${pad(t.n)}.mp3`;
const fmt = (s) => (isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}` : "0:00");

/* Check which files exist (once, shared by every player on the page) */
const availability = Promise.all(
  TRACKS.map(
    (t) =>
      new Promise((resolve) => {
        const a = new Audio();
        a.preload = "metadata";
        a.onloadedmetadata = () => resolve({ ok: true, duration: a.duration });
        a.onerror = () => resolve({ ok: false });
        a.src = fileFor(t);
      })
  )
);

const players = [];
document.querySelectorAll("[data-player]").forEach(initPlayer);

function initPlayer(root) {
  const list = root.dataset.player === "featured" ? TRACKS.filter((t) => t.featured) : TRACKS;
  const audio = new Audio();
  audio.preload = "metadata";
  const $ = (sel) => root.querySelector(sel);
  const playBtn = $(".play"), prevBtn = $(".prev"), nextBtn = $(".next");
  const seek = $(".seek"), cur = $(".t-cur"), dur = $(".t-dur");
  const nowTitle = $(".now-title"), nowLabel = $(".now-label"), status = $(".status");
  const ol = $(".tracks");
  let ok = [], current = -1;

  // Render the list right away; everything starts as "checking"
  ol.innerHTML = list
    .map(
      (t, i) => `<li><div class="track unavailable" data-i="${i}">
        <span class="n">${pad(t.n)}</span>
        <span class="t ${t.title === "TBD" ? "tbd" : ""}">${t.title}</span>
        <span class="d">…</span></div></li>`
    )
    .join("");

  availability.then((results) => {
    const all = TRACKS.map((t, i) => ({ t, ...results[i] }));
    ok = list.map((t) => all.find((r) => r.t === t));

    ol.innerHTML = list
      .map((t, i) => {
        const r = ok[i];
        const title = `<span class="t ${t.title === "TBD" ? "tbd" : ""}">${t.title}</span>`;
        return r.ok
          ? `<li><button type="button" class="track" data-i="${i}" aria-label="Play ${t.title === "TBD" ? "track " + t.n : t.title}">
               <span class="n">${pad(t.n)}</span>${title}<span class="d">${fmt(r.duration)}</span></button></li>`
          : `<li><div class="track unavailable"><span class="n">${pad(t.n)}</span>${title}<span class="d">coming soon</span></div></li>`;
      })
      .join("");

    const first = ok.findIndex((r) => r.ok);
    if (first === -1) {
      nowTitle.textContent = "Audio coming soon";
      [playBtn, prevBtn, nextBtn, seek].forEach((el) => (el.disabled = true));
      return;
    }
    status.textContent = "";
    load(first, false);
  });

  function playable(from, step) {
    for (let k = 1; k <= list.length; k++) {
      const i = (from + step * k + list.length * k) % list.length;
      if (ok[i] && ok[i].ok) return i;
    }
    return -1;
  }

  function load(i, autoplay) {
    current = i;
    const t = list[i];
    audio.src = fileFor(t);
    nowTitle.textContent = `${pad(t.n)}  ${t.title === "TBD" ? "Untitled (TBD)" : t.title}`;
    ol.querySelectorAll(".track").forEach((el) => el.classList.toggle("active", +el.dataset.i === i));
    ol.querySelectorAll("button.track").forEach((el) =>
      el.toggleAttribute("aria-current", +el.dataset.i === i)
    );
    seek.value = 0;
    seek.style.setProperty("--p", "0%");
    if (autoplay) audio.play().catch(() => {});
  }

  const toggle = () => (audio.paused ? audio.play().catch(() => {}) : audio.pause());

  playBtn.addEventListener("click", toggle);
  prevBtn.addEventListener("click", () => {
    if (audio.currentTime > 3) return (audio.currentTime = 0);
    const i = playable(current, -1);
    if (i > -1) load(i, !audio.paused);
  });
  nextBtn.addEventListener("click", () => {
    const i = playable(current, 1);
    if (i > -1) load(i, !audio.paused);
  });
  ol.addEventListener("click", (e) => {
    const b = e.target.closest("button.track");
    if (!b) return;
    const i = +b.dataset.i;
    i === current ? toggle() : load(i, true);
  });

  audio.addEventListener("play", () => {
    pauseOthers(audio);
    root.classList.add("is-playing");
    playBtn.setAttribute("aria-label", "Pause");
    nowLabel.textContent = "Now playing";
  });
  audio.addEventListener("pause", () => {
    root.classList.remove("is-playing");
    playBtn.setAttribute("aria-label", "Play");
    nowLabel.textContent = "Selected";
  });
  audio.addEventListener("loadedmetadata", () => (dur.textContent = fmt(audio.duration)));
  audio.addEventListener("timeupdate", () => {
    cur.textContent = fmt(audio.currentTime);
    if (audio.duration) {
      const p = (audio.currentTime / audio.duration) * 100;
      seek.value = p;
      seek.style.setProperty("--p", p + "%");
      seek.setAttribute("aria-valuetext", `${fmt(audio.currentTime)} of ${fmt(audio.duration)}`);
    }
  });
  audio.addEventListener("ended", () => {
    const i = playable(current, 1);
    if (i > current) load(i, true);
  });
  seek.addEventListener("input", () => {
    if (audio.duration) audio.currentTime = (seek.value / 100) * audio.duration;
  });

  players.push(audio);
}

/* Only one player plays at a time */
function pauseOthers(active) {
  players.forEach((a) => a !== active && a.pause());
}

/* Download EPK button: enabled only if the PDF actually exists.
   (Needs the site served over http; opening the file directly keeps it disabled.) */
const epkBtn = document.querySelector("[data-epk]");
if (epkBtn) {
  fetch(EPK_PDF, { method: "HEAD" })
    .then((r) => {
      if (!r.ok) return;
      epkBtn.href = EPK_PDF;
      epkBtn.setAttribute("download", "");
      epkBtn.removeAttribute("aria-disabled");
      epkBtn.querySelector(".epk-note")?.remove();
    })
    .catch(() => {});
}

document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
