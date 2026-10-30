(() => {
  "use strict";

  const STORE_KEY = "catchphrase.league.v1";
  const PREFS_KEY = "catchphrase.prefs.v1";
  const NO_REPEAT_DAYS = 60; // a player won't see the same phrase again within this window
  const FILLER_CELLS = 34;   // how many phrases whizz past before the reel lands

  const PHRASES = window.PHRASES;
  const byId = new Map(PHRASES.map((p) => [p.id, p]));
  const KIND_LABEL = { jargon: "Corporate jargon", vocab: "Niche vocab", law: "Law / principle" };

  const $ = (id) => document.getElementById(id);
  const el = {
    reel: $("reel"), strip: $("strip"), select: $("playerSelect"), spin: $("spinBtn"), lever: $("lever"),
    result: $("result"), resultKind: $("resultKind"), resultPhrase: $("resultPhrase"), resultDef: $("resultDef"),
    claim: $("claimBtn"), dateline: $("dateline"), table: $("table"), empty: $("empty"),
    addForm: $("addForm"), nameInput: $("nameInput"), sound: $("soundBtn"),
    copyLink: $("copyLinkBtn"), exportBtn: $("exportBtn"), importInput: $("importInput"), shareNote: $("shareNote"),
    confetti: $("confetti"),
  };

  // ── Storage ─────────────────────────────────────────────────────────
  function load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
  }

  const emptyLeague = () => ({ version: 1, players: [], days: {} });
  let league = normalise(load(STORE_KEY, null)) || emptyLeague();
  let prefs = Object.assign({ selected: null, sound: true }, load(PREFS_KEY, {}));

  function normalise(data) {
    if (!data || !Array.isArray(data.players) || typeof data.days !== "object") return null;
    return { version: 1, players: data.players, days: data.days || {} };
  }
  const persist = () => save(STORE_KEY, league);
  const persistPrefs = () => save(PREFS_KEY, prefs);

  // ── Dates ───────────────────────────────────────────────────────────
  function dayKey(d = new Date()) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  function shiftDay(key, delta) {
    const [y, m, d] = key.split("-").map(Number);
    return dayKey(new Date(y, m - 1, d + delta));
  }
  let today = dayKey();

  // ── Seeded randomness, so a day's draw is stable ────────────────────
  function hash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    return h1 >>> 0;
  }
  function rng(seed) {
    let a = seed;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── League logic ────────────────────────────────────────────────────
  const dayOf = (key) => (league.days[key] ||= {});
  const entryFor = (pid, key = today) => league.days[key]?.[pid];

  function assignPhrase(player) {
    const todays = dayOf(today);
    const takenToday = new Set(Object.values(todays).map((e) => e.p));
    const recent = new Set();
    for (let i = 1; i <= NO_REPEAT_DAYS; i++) {
      const e = entryFor(player.id, shiftDay(today, -i));
      if (e) recent.add(e.p);
    }
    let pool = PHRASES.filter((p) => !takenToday.has(p.id) && !recent.has(p.id));
    if (!pool.length) pool = PHRASES.filter((p) => !takenToday.has(p.id));
    if (!pool.length) pool = PHRASES;
    const pick = pool[Math.floor(rng(hash(`${today}|${player.id}`))() * pool.length)];
    todays[player.id] = { p: pick.id, done: false };
    persist();
    return todays[player.id];
  }

  function stats(pid) {
    let points = 0;
    for (const day of Object.values(league.days)) if (day[pid]?.done) points++;

    // Streak counts back from today; an unscored today doesn't break it yet.
    let streak = 0;
    let key = entryFor(pid)?.done ? today : shiftDay(today, -1);
    while (entryFor(pid, key)?.done) { streak++; key = shiftDay(key, -1); }

    const week = [];
    for (let i = 6; i >= 0; i--) {
      const e = entryFor(pid, shiftDay(today, -i));
      // Today isn't a miss until the day is over.
      week.push(e ? (e.done ? "hit" : i === 0 ? "pending" : "miss") : "");
    }
    return { points, streak, week };
  }

  function addPlayer(name) {
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) return;
    if (league.players.some((p) => p.name.toLowerCase() === clean.toLowerCase())) {
      flashNote(`${clean} is already in the league.`);
      return;
    }
    const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    league.players.push({ id, name: clean });
    persist();
    prefs.selected = id;
    persistPrefs();
    renderAll();
  }

  function removePlayer(pid) {
    const p = league.players.find((x) => x.id === pid);
    if (!p || !confirm(`Remove ${p.name} from the league? Their points will be lost.`)) return;
    league.players = league.players.filter((x) => x.id !== pid);
    for (const day of Object.values(league.days)) delete day[pid];
    persist();
    if (prefs.selected === pid) prefs.selected = league.players[0]?.id || null;
    persistPrefs();
    renderAll();
  }

  function toggleClaim(pid) {
    const e = entryFor(pid);
    if (!e) return;
    e.done = !e.done;
    persist();
    if (e.done) { celebrate(); sound.win(); }
    renderAll();
  }

  // ── Sound (tiny WebAudio blips, no files) ──────────────────────────
  const sound = (() => {
    let ctx;
    const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
    function blip(freq, dur, type = "square", gain = 0.04, when = 0) {
      if (!prefs.sound) return;
      try {
        const c = ac();
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = type;
        o.frequency.value = freq;
        g.gain.setValueAtTime(gain, c.currentTime + when);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + when + dur);
        o.connect(g).connect(c.destination);
        o.start(c.currentTime + when);
        o.stop(c.currentTime + when + dur);
      } catch { /* audio unavailable */ }
    }
    return {
      tick: () => blip(900, 0.03, "square", 0.025),
      land: () => { blip(523, 0.12, "triangle", 0.08); blip(784, 0.25, "triangle", 0.08, 0.1); },
      win: () => [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.18, "triangle", 0.08, i * 0.09)),
    };
  })();

  // ── Reel ────────────────────────────────────────────────────────────
  let spinning = false;

  function cell(phrase, extraClass = "") {
    const div = document.createElement("div");
    div.className = `cell ${extraClass}`.trim();
    if (phrase) {
      div.textContent = phrase.text;
      div.dataset.kind = phrase.kind;
    }
    return div;
  }
  function idleCell(text) {
    const div = cell(null, "idle");
    div.textContent = text;
    return div;
  }
  const randomPhrase = () => PHRASES[Math.floor(Math.random() * PHRASES.length)];
  const rowHeight = () => el.strip.firstElementChild?.offsetHeight || 84;

  function showStatic(phraseId) {
    el.strip.style.transition = "none";
    el.strip.style.transform = "translateY(0)";
    el.reel.classList.remove("win");
    if (phraseId) {
      el.strip.replaceChildren(cell(randomPhrase()), cell(byId.get(phraseId), "target"), cell(randomPhrase()));
    } else {
      el.strip.replaceChildren(idleCell("★ ★ ★"), idleCell("Pull to spin"), idleCell("★ ★ ★"));
    }
  }

  function spin() {
    if (spinning) return;
    const player = league.players.find((p) => p.id === prefs.selected);
    if (!player) {
      el.nameInput.focus();
      flashNote("Add a player first.");
      return;
    }
    const entry = entryFor(player.id) || assignPhrase(player);
    const target = byId.get(entry.p);

    spinning = true;
    setBusy(true);
    pullLever();
    el.reel.classList.remove("win");
    el.result.hidden = true;

    // Keep the three visible cells at the top so the reel doesn't jump, then add fillers.
    const visible = Array.from(el.strip.children).slice(-3).map((c) => c.cloneNode(true));
    visible.forEach((c) => c.classList.remove("target"));
    const cells = [...visible];
    for (let i = 0; i < FILLER_CELLS; i++) cells.push(cell(randomPhrase()));
    const targetIndex = cells.length;
    cells.push(cell(target, "target"), cell(randomPhrase()));

    el.strip.style.transition = "none";
    el.strip.style.transform = `translateY(-${Math.max(0, visible.length - 3) * rowHeight()}px)`;
    el.strip.replaceChildren(...cells);
    void el.strip.offsetHeight; // commit the start position

    const h = rowHeight();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 600 : 3600 + Math.random() * 600;
    el.strip.classList.add("blur");
    el.strip.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.72, 0.18, 1.02)`;
    el.strip.style.transform = `translateY(-${(targetIndex - 1) * h}px)`;

    // Click as each row passes the payline, and drop the motion blur as it slows.
    let lastRow = 0;
    const started = performance.now();
    (function frame(now) {
      if (!spinning) return;
      const y = -new DOMMatrixReadOnly(getComputedStyle(el.strip).transform).m42;
      const row = Math.floor(y / h);
      if (row !== lastRow) { lastRow = row; sound.tick(); }
      if (now - started > duration * 0.55) el.strip.classList.remove("blur");
      requestAnimationFrame(frame);
    })(started);

    const finish = () => {
      if (!spinning) return;
      spinning = false;
      el.strip.removeEventListener("transitionend", finish);
      // Trim the strip back to three cells so the next spin starts cleanly.
      el.strip.style.transition = "none";
      el.strip.replaceChildren(...cells.slice(targetIndex - 1, targetIndex + 2));
      el.strip.style.transform = "translateY(0)";
      el.strip.classList.remove("blur");
      el.reel.classList.add("win");
      sound.land();
      setBusy(false);
      renderAll();
    };
    el.strip.addEventListener("transitionend", finish);
    setTimeout(finish, duration + 300); // safety net if transitionend never fires
  }

  function pullLever() {
    el.lever.classList.add("pulled");
    setTimeout(() => el.lever.classList.remove("pulled"), 260);
  }

  function setBusy(busy) {
    el.spin.disabled = busy;
    el.lever.disabled = busy;
    el.select.disabled = busy;
  }

  // ── Rendering ───────────────────────────────────────────────────────
  function h(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    node.append(...children.filter((c) => c != null));
    return node;
  }

  function renderSelect() {
    el.select.replaceChildren(
      ...(league.players.length
        ? league.players.map((p) => h("option", { value: p.id }, p.name))
        : [h("option", { value: "" }, "No players yet")])
    );
    if (!league.players.some((p) => p.id === prefs.selected)) prefs.selected = league.players[0]?.id || null;
    el.select.value = prefs.selected || "";
  }

  function renderMachine() {
    const pid = prefs.selected;
    const entry = pid && entryFor(pid);
    el.spin.textContent = entry ? "Replay" : "Spin";
    el.spin.title = entry ? "You've already spun today — this replays your phrase" : "Spin for today's phrase";

    if (!entry) {
      el.result.hidden = true;
      return;
    }
    const phrase = byId.get(entry.p);
    el.result.hidden = false;
    el.resultKind.textContent = KIND_LABEL[phrase.kind];
    el.resultKind.dataset.kind = phrase.kind;
    el.resultPhrase.textContent = `“${phrase.text}”`;
    el.resultDef.textContent = phrase.def;
    el.claim.textContent = entry.done ? "✓ Point claimed — tap to undo" : "I said it in a meeting! (+1)";
    el.claim.classList.toggle("done", entry.done);
  }

  function renderDateline() {
    const spun = league.players.filter((p) => entryFor(p.id)).length;
    const scored = league.players.filter((p) => entryFor(p.id)?.done).length;
    const date = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
    el.dateline.textContent = league.players.length
      ? `${date} · ${spun}/${league.players.length} spun · ${scored} scored today`
      : date;
  }

  function renderTable() {
    const rows = league.players
      .map((p) => ({ p, s: stats(p.id), e: entryFor(p.id) }))
      .sort((a, b) => b.s.points - a.s.points || a.p.name.localeCompare(b.p.name));

    let rank = 0, prevPoints = null;
    el.table.replaceChildren(...rows.map(({ p, s, e }, i) => {
      if (s.points !== prevPoints) { rank = i + 1; prevPoints = s.points; }
      const phrase = e && byId.get(e.p);
      const select = () => selectPlayer(p.id);

      return h("li", {
        class: `row${p.id === prefs.selected ? " selected" : ""}`,
        tabindex: "0",
        onclick: select,
        onkeydown: (ev) => { if (ev.key === "Enter" && ev.target === ev.currentTarget) select(); },
      },
        h("span", { class: `rank r${rank}` }, String(rank)),
        h("span", { class: "name", title: p.name }, p.name),
        h("span", { class: "points" }, String(s.points), h("small", {}, s.points === 1 ? "pt" : "pts")),
        h("span", { class: `today${e?.done ? " scored" : ""}` },
          phrase ? h("b", {}, phrase.text) : "Hasn't spun today"),
        h("span", { class: "meta" },
          s.streak > 1 ? h("span", { title: `${s.streak}-day streak` }, `🔥${s.streak}`) : null,
          h("span", { class: "dots", title: "Last 7 days" }, ...s.week.map((w) => h("span", { class: `dot ${w}` })))),
        h("div", { class: "row-actions" },
          e
            ? h("button", {
                type: "button",
                class: `tick${e.done ? " done" : ""}`,
                "aria-pressed": String(e.done),
                onclick: (ev) => { ev.stopPropagation(); toggleClaim(p.id); },
              }, e.done ? "✓ Said it" : "☐ Said it?")
            : h("span", { class: "today" }, "Select & spin →"),
          h("button", {
            type: "button",
            class: "remove",
            "aria-label": `Remove ${p.name}`,
            onclick: (ev) => { ev.stopPropagation(); removePlayer(p.id); },
          }, "remove"))
      );
    }));
    el.empty.hidden = league.players.length > 0;
  }

  function renderAll() {
    renderSelect();
    renderMachine();
    renderTable();
    renderDateline();
  }

  function selectPlayer(pid) {
    if (spinning) return;
    prefs.selected = pid;
    persistPrefs();
    showStatic(entryFor(pid)?.p);
    renderAll();
  }

  // ── Confetti ────────────────────────────────────────────────────────
  function celebrate() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#f5c542", "#c8102e", "#2ecc71", "#c9a2f2", "#7fd6d1", "#fff"];
    const bits = [];
    for (let i = 0; i < 90; i++) {
      const b = document.createElement("i");
      b.style.left = `${Math.random() * 100}vw`;
      b.style.background = colors[i % colors.length];
      b.style.setProperty("--dx", `${(Math.random() - 0.5) * 200}px`);
      b.style.setProperty("--rot", `${Math.random() * 1080 - 540}deg`);
      b.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
      b.style.animationDelay = `${Math.random() * 0.3}s`;
      bits.push(b);
    }
    el.confetti.append(...bits);
    setTimeout(() => bits.forEach((b) => b.remove()), 3800);
  }

  // ── Share / backup ──────────────────────────────────────────────────
  let noteTimer;
  function flashNote(msg) {
    el.shareNote.textContent = msg;
    el.shareNote.closest("details").open = true;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => (el.shareNote.textContent = ""), 4000);
  }

  const encode = (obj) => btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
  const decode = (str) => JSON.parse(decodeURIComponent(escape(atob(str))));

  function replaceLeague(data, source) {
    const next = normalise(data);
    if (!next) { flashNote(`That ${source} doesn't look like a Catchphrase league.`); return false; }
    if (league.players.length && !confirm(`Replace this browser's league with the one from the ${source}?`)) return false;
    league = next;
    persist();
    showStatic(null);
    renderAll();
    flashNote(`League loaded from ${source}.`);
    return true;
  }

  el.copyLink.addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}#league=${encode(league)}`;
    try {
      await navigator.clipboard.writeText(url);
      flashNote("League link copied. Opening it elsewhere loads this league.");
    } catch {
      prompt("Copy this link:", url);
    }
  });

  el.exportBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(league, null, 2)], { type: "application/json" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `catchphrase-league-${today}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  el.importInput.addEventListener("change", async () => {
    const file = el.importInput.files[0];
    el.importInput.value = "";
    if (!file) return;
    try { replaceLeague(JSON.parse(await file.text()), "backup file"); }
    catch { flashNote("Couldn't read that file."); }
  });

  function importFromHash() {
    const m = location.hash.match(/^#league=(.+)$/);
    if (!m) return;
    history.replaceState(null, "", location.pathname + location.search);
    try { replaceLeague(decode(m[1]), "link"); }
    catch { flashNote("That league link is broken."); }
  }

  // ── Wire up ─────────────────────────────────────────────────────────
  el.addForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    addPlayer(el.nameInput.value);
    el.nameInput.value = "";
    showStatic(entryFor(prefs.selected)?.p);
  });
  el.select.addEventListener("change", () => selectPlayer(el.select.value));
  el.spin.addEventListener("click", spin);
  el.lever.addEventListener("click", spin);
  el.claim.addEventListener("click", () => prefs.selected && toggleClaim(prefs.selected));
  el.sound.addEventListener("click", () => {
    prefs.sound = !prefs.sound;
    persistPrefs();
    el.sound.textContent = prefs.sound ? "🔊" : "🔇";
    el.sound.setAttribute("aria-pressed", String(prefs.sound));
  });
  el.sound.textContent = prefs.sound ? "🔊" : "🔇";
  el.sound.setAttribute("aria-pressed", String(prefs.sound));

  // Roll over to a new day if the page is left open past midnight.
  setInterval(() => {
    const now = dayKey();
    if (now !== today && !spinning) {
      today = now;
      showStatic(entryFor(prefs.selected)?.p);
      renderAll();
    }
  }, 30_000);

  importFromHash();
  renderAll();
  showStatic(entryFor(prefs.selected)?.p);
})();
