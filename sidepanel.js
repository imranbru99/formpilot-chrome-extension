const DEFAULT_SETTINGS = {
  waitSeconds: 4.5,
  stopWords: [
    "verification",
    "verify",
    "captcha",
    "recaptcha",
    "attention check",
    "security check",
    "are you a human",
    "are you human",
    "enter the code",
    "enter the word",
    "type the",
    "select exactly",
    "select the option that",
    "basic question",
    "basic math",
    "trap question",
    "confirm you",
    "what is",
    "how many",
  ],
};

let isRunning = false;
let loopTimeout = null;
let settings = { ...DEFAULT_SETTINGS, stopWords: [...DEFAULT_SETTINGS.stopWords] };

const statusEl = document.getElementById("status");
const statusText = document.getElementById("statusText");
const runBtn = document.getElementById("runBtn");
const stopBtn = document.getElementById("stopBtn");
const fillBtn = document.getElementById("fillBtn");
const waitInput = document.getElementById("waitSeconds");
const wordChips = document.getElementById("wordChips");
const wordInput = document.getElementById("wordInput");
const addWordBtn = document.getElementById("addWordBtn");
const toggleSettings = document.getElementById("toggleSettings");
const settingsBody = document.getElementById("settingsBody");
const resetSettings = document.getElementById("resetSettings");
const savedToast = document.getElementById("savedToast");

let saveTimer = null;

function setStatus(message, type = "") {
  statusText.textContent = message;
  statusEl.className = "status" + (type ? ` is-${type}` : "");
}

function setRunningUI(running) {
  isRunning = running;
  runBtn.disabled = running;
  fillBtn.disabled = running;
  stopBtn.disabled = !running;
  waitInput.disabled = running;
  wordInput.disabled = running;
  addWordBtn.disabled = running;
  resetSettings.disabled = running;

  if (running) {
    runBtn.classList.add("is-running");
    runBtn.innerHTML = '<span class="spinner"></span> Running…';
  } else {
    runBtn.classList.remove("is-running");
    runBtn.textContent = "Start loop";
  }
}

function showSaved() {
  savedToast.classList.add("show");
  clearTimeout(showSaved._t);
  showSaved._t = setTimeout(() => savedToast.classList.remove("show"), 1200);
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  settings = {
    waitSeconds: Number(stored.waitSeconds) || DEFAULT_SETTINGS.waitSeconds,
    stopWords: Array.isArray(stored.stopWords) && stored.stopWords.length
      ? stored.stopWords.map((w) => String(w).trim()).filter(Boolean)
      : [...DEFAULT_SETTINGS.stopWords],
  };
  waitInput.value = settings.waitSeconds;
  renderChips();
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSettings, 250);
}

async function saveSettings() {
  const wait = Math.min(60, Math.max(1, parseFloat(waitInput.value) || DEFAULT_SETTINGS.waitSeconds));
  waitInput.value = wait;
  settings.waitSeconds = wait;
  settings.stopWords = [...settings.stopWords];
  await chrome.storage.sync.set({
    waitSeconds: settings.waitSeconds,
    stopWords: settings.stopWords,
  });
  showSaved();
}

function renderChips() {
  wordChips.innerHTML = "";
  settings.stopWords.forEach((word, index) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    const label = document.createElement("span");
    label.textContent = word;
    label.title = word;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${word}`);
    remove.textContent = "×";
    remove.disabled = isRunning;
    remove.addEventListener("click", () => {
      settings.stopWords.splice(index, 1);
      renderChips();
      scheduleSave();
    });
    chip.append(label, remove);
    wordChips.appendChild(chip);
  });
}

function addStopWord() {
  const raw = wordInput.value.trim().toLowerCase();
  if (!raw) return;
  if (settings.stopWords.some((w) => w.toLowerCase() === raw)) {
    wordInput.value = "";
    setStatus("That stop word is already in the list.", "warn");
    return;
  }
  settings.stopWords.push(raw);
  wordInput.value = "";
  renderChips();
  scheduleSave();
  setStatus(`Added stop word: “${raw}”`, "ok");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function inject(func, args = []) {
  const tab = await getActiveTab();
  if (!tab?.id) return null;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func,
      args,
    });
    return result?.result ?? null;
  } catch {
    return null;
  }
}

/** Injected into the page — receives settings from the side panel */
async function pageFillAndScan(config) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const pause = () => sleep(rand(60, 140));
  const textOf = (el) => (el?.innerText || el?.textContent || "").trim();
  const lower = (s) => (s || "").toLowerCase();

  const avoidOption = /(none of the above|^none$|^other$|^others$|prefer not|n\/a)/i;
  const stopWords = (config?.stopWords || []).map((w) => String(w).trim().toLowerCase()).filter(Boolean);

  const sentences = [
    "I found this straightforward and relevant to my experience.",
    "Overall the options made sense and were easy to follow.",
    "Based on what I usually do, this feels like a fair answer.",
    "I would say this matches how I typically approach similar situations.",
    "The question was clear and I answered according to my preference.",
    "In my day-to-day life this is something I notice fairly often.",
    "I am generally satisfied with how things work for me here.",
    "This reflects my honest opinion after thinking it through briefly.",
    "From my perspective the process felt simple and familiar.",
    "I selected what seemed most accurate for my current habits.",
    "Nothing unusual stood out while I was reviewing this part.",
    "I appreciate surveys that keep questions short and practical.",
  ];

  const pickSentence = () => sentences[rand(0, sentences.length - 1)];

  const isVisible = (el) => {
    if (!el || el.disabled || el.readOnly) return false;
    const s = getComputedStyle(el);
    return el.offsetWidth > 0 && el.offsetHeight > 0 && s.display !== "none" && s.visibility !== "hidden";
  };

  const fire = (el, types = ["input", "change"]) => {
    types.forEach((t) => el.dispatchEvent(new Event(t, { bubbles: true })));
  };

  const clickEl = (el) => {
    ["mouseover", "mousedown", "mouseup", "click"].forEach((type) => {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    });
  };

  const callInline = (code) => {
    if (!code) return false;
    let any = false;
    for (const call of code.split(";").map((s) => s.trim()).filter(Boolean)) {
      const m = call.match(/^([$\w]+)\((.*)\)$/);
      if (!m) continue;
      const fn = window[m[1]];
      if (typeof fn !== "function") continue;
      const argsStr = m[2].trim();
      const args = !argsStr
        ? []
        : argsStr.split(",").map((raw) => {
            const s = raw.trim();
            if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) return s.slice(1, -1);
            if (/^[+-]?\d+(\.\d+)?$/.test(s)) return Number(s);
            if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
            return window[s];
          });
      try {
        fn.apply(window, args);
        any = true;
      } catch {}
    }
    return any;
  };

  const pageText = lower(document.body?.innerText || "").slice(0, 12000);
  const matchedWord = stopWords.find((w) => w && pageText.includes(w));

  const trapNodes = document.querySelectorAll(
    '[id*="trap" i], [name*="trap" i], [id*="attention" i], [name*="attention" i], [id*="verify" i], [name*="verify" i], [id*="captcha" i], [class*="captcha" i], img[src*="trap" i], img[src*="captcha" i]'
  );

  if (trapNodes.length > 0 || matchedWord) {
    const reason = matchedWord
      ? `Stop word found: “${matchedWord}” — paused for you.`
      : "Verification / trap element detected — paused for you.";
    return { count: 0, stop: true, reason };
  }

  let count = 0;

  document.querySelectorAll("select").forEach((select) => {
    try {
      if (!isVisible(select)) return;
      const label = document.querySelector(`label[for="${select.id}"]`);
      const ctx = lower(label?.innerText || select.getAttribute("aria-label") || select.name || select.id || "");
      if (/language/.test(ctx)) return;

      const opts = Array.from(select.options).filter((opt) => {
        const t = lower(opt.text);
        if (opt.disabled || opt.value === "" || opt.value === "-1") return false;
        if (t.includes("select") || t.includes("choose") || t.includes("please")) return false;
        return !avoidOption.test(t);
      });
      if (!opts.length) return;
      select.value = opts[rand(0, opts.length - 1)].value;
      fire(select);
      count++;
    } catch {}
  });

  const radioGroups = {};
  document.querySelectorAll("input[type='radio']").forEach((r, i) => {
    const key = r.name || r.id || `__radio_${i}`;
    (radioGroups[key] ||= []).push(r);
  });

  Object.values(radioGroups).forEach((group) => {
    try {
      if (group.some((r) => r.closest("tr[id^='statementrow_'], tr[id$='_row'], .matrix, .answerMatrix"))) return;
      const enabled = group.filter((r) => {
        if (!isVisible(r) && !r.closest("label")) return false;
        if (r.disabled) return false;
        const label = document.querySelector(`label[for="${r.id}"]`);
        return !avoidOption.test(lower(label?.innerText || r.value || ""));
      });
      if (!enabled.length) return;
      const r = enabled[rand(0, enabled.length - 1)];
      r.checked = true;
      fire(r);
      count++;
    } catch {}
  });

  document.querySelectorAll("input[type='checkbox']").forEach((cb) => {
    try {
      if (cb.disabled) return;
      if (cb.closest("tr[id^='statementrow_'], tr[id$='_row'], .matrix, .answerMatrix")) return;
      const lbl = document.querySelector(`label[for="${cb.id}"]`);
      const txt = lower(lbl?.innerText || cb.closest("label")?.innerText || "");
      if (avoidOption.test(txt)) return;
      cb.checked = Math.random() < 0.55;
      fire(cb);
      count++;
    } catch {}
  });

  document.querySelectorAll("input[type='range']").forEach((rng) => {
    try {
      if (rng.disabled) return;
      let min = parseFloat(rng.min);
      let max = parseFloat(rng.max);
      let step = parseFloat(rng.step);
      if (Number.isNaN(min)) min = 0;
      if (Number.isNaN(max)) max = 100;
      if (Number.isNaN(step) || step <= 0) step = 1;
      const steps = Math.max(1, Math.floor((max - min) / step));
      rng.value = String(min + rand(0, steps) * step);
      fire(rng);
      count++;
    } catch {}
  });

  document
    .querySelectorAll('input[type="text"], input[type="email"], input[type="search"], input[type="tel"], input[type="url"], input:not([type]), textarea')
    .forEach((el) => {
      try {
        if (!isVisible(el)) return;
        const nameHint = lower(el.name + " " + el.id + " " + (el.placeholder || "") + " " + (el.getAttribute("aria-label") || ""));
        if (/password|captcha|otp|code|verify|token/.test(nameHint)) return;

        let value = pickSentence();
        if (el.type === "email" || /email/.test(nameHint)) value = `user${rand(100, 9999)}@example.com`;
        else if (el.type === "tel" || /phone|mobile|tel/.test(nameHint)) value = `555${rand(1000000, 9999999)}`;
        else if (el.type === "number" || el.inputMode === "numeric") value = String(rand(1, 99));
        else if (el.tagName === "TEXTAREA" || (el.maxLength && el.maxLength > 80)) value = `${pickSentence()} ${pickSentence()}`;

        if (el.maxLength > 0 && value.length > el.maxLength) value = value.slice(0, el.maxLength);
        el.focus();
        el.value = value;
        fire(el);
        count++;
      } catch {}
    });

  document.querySelectorAll('input[type="number"]').forEach((el) => {
    try {
      if (!isVisible(el)) return;
      let min = el.min !== "" ? parseFloat(el.min) : 1;
      let max = el.max !== "" ? parseFloat(el.max) : 100;
      if (Number.isNaN(min)) min = 1;
      if (Number.isNaN(max)) max = 100;
      el.value = String(rand(Math.ceil(min), Math.floor(max)));
      fire(el);
      count++;
    } catch {}
  });

  const rows = Array.from(
    document.querySelectorAll("tr[id^='statementrow_'], tr[id$='_row']:has(td.input_cell.clickable), .matrix, .answerMatrix")
  );

  for (const row of rows) {
    try {
      const rowLabel = row.querySelector("th, td.answer-text, .matrix__question > span");
      if (rowLabel && avoidOption.test(textOf(rowLabel))) continue;

      const clickables = Array.from(
        row.querySelectorAll(
          "td.input_cell.clickable, td[onclick]:not([onclick='']), td:has(img[role='radio']), td:has(input[type='radio']), td:has(input[type='checkbox']), .matrix__answer"
        )
      )
        .filter((td) => !td.querySelector("input[type='range'], input[type='text'], textarea"))
        .filter((td) => !avoidOption.test(textOf(td)));

      if (!clickables.length) continue;

      const multi = row.querySelector(".answer--multi-choice, input[type='checkbox']");
      let cells = multi ? clickables.filter(() => Math.random() < 0.5) : [clickables[rand(0, clickables.length - 1)]];
      if (!cells.length) cells = [clickables[rand(0, clickables.length - 1)]];

      for (const cell of cells) {
        cell.scrollIntoView({ block: "center", inline: "nearest" });
        if (!callInline(cell.getAttribute("onclick"))) {
          clickEl(cell.querySelector(".graphical_select, svg, img, a") || cell);
        }
        const hidden = cell.querySelector("input[type='radio'], input[type='checkbox']");
        if (hidden) {
          hidden.checked = true;
          fire(hidden, ["change"]);
        }
        const graphical = cell.querySelector("[role='radio'], [role='checkbox'], [aria-checked]");
        if (graphical) graphical.setAttribute("aria-checked", "true");
        count++;
        await pause();
      }
    } catch {}
  }

  for (const carousel of document.querySelectorAll("fieldset.carousel")) {
    try {
      const totalEl = carousel.querySelector(".carousel-total");
      const indexEl = carousel.querySelector(".carousel-index");
      if (!totalEl || !indexEl) continue;
      let total = parseInt(totalEl.innerText, 10);
      let current = parseInt(indexEl.innerText, 10);
      while (current <= total) {
        const buttons = Array.from(carousel.querySelectorAll(".carousel-buttons .ui-btn"));
        if (!buttons.length) break;
        const btn = buttons[rand(0, buttons.length - 1)];
        clickEl(btn);
        btn.querySelector("button")?.click();
        count++;
        if (current >= total) break;
        await sleep(1200);
        const next = parseInt(carousel.querySelector(".carousel-index")?.innerText, 10);
        current = next > current ? next : current + 1;
      }
    } catch {}
  }

  const dropZones = Array.from(document.querySelectorAll(".yui3-dd-drop[istarget='true']"));
  document.querySelectorAll(".yui3-dd-draggable").forEach((card) => {
    try {
      if (!dropZones.length) return;
      const zone = dropZones[rand(0, dropZones.length - 1)];
      zone.appendChild(card);
      card.style.position = "static";
      const cellIndex = zone.getAttribute("cellindex");
      if (cellIndex) {
        const hiddenRadio = document.querySelector(`input[type="radio"][value="${cellIndex}"]`);
        if (hiddenRadio) {
          hiddenRadio.checked = true;
          fire(hiddenRadio, ["change"]);
        }
      }
      count++;
    } catch {}
  });

  const genericOptions = document.querySelectorAll(
    '[role="radio"]:not([aria-checked="true"]), [role="option"]:not([aria-selected="true"]), .answer-option, .option, .choice, li[data-value], label.answer'
  );
  const seenGroups = new WeakSet();
  genericOptions.forEach((opt) => {
    try {
      if (!isVisible(opt) && opt.offsetParent === null) return;
      const group = opt.closest("ul, ol, fieldset, [role='radiogroup'], .answers, .options, .choices") || opt.parentElement;
      if (group && seenGroups.has(group)) return;
      if (avoidOption.test(textOf(opt))) return;
      if (group) {
        const siblings = Array.from(
          group.querySelectorAll('[role="radio"], [role="option"], .answer-option, .option, .choice, li[data-value], label.answer')
        ).filter((s) => isVisible(s) || s.offsetParent !== null);
        const pick = siblings[rand(0, Math.max(0, siblings.length - 1))];
        if (pick) {
          clickEl(pick);
          seenGroups.add(group);
          count++;
        }
      } else {
        clickEl(opt);
        count++;
      }
    } catch {}
  });

  return { count, stop: false, reason: "" };
}

async function clickSubmit() {
  return inject(() => {
    const buttons = Array.from(
      document.querySelectorAll(
        'button, input[type="submit"], input[type="button"], input[type="image"], a.button, a.btn, .btn, .button, [role="button"]'
      )
    );
    const submitBtn = buttons.find((b) => {
      if (b.offsetWidth === 0 && b.offsetHeight === 0) return false;
      if (b.disabled) return false;
      const txt = (b.innerText || b.value || b.textContent || b.alt || b.title || "").toLowerCase();
      return /\b(submit|next|continue|proceed|done)\b|>>|›|→/.test(txt);
    });
    if (!submitBtn) return false;
    submitBtn.click();
    return true;
  });
}

async function runFill() {
  const result = await inject(pageFillAndScan, [{ stopWords: settings.stopWords }]);
  if (!result) return { count: 0, stop: true, reason: "Could not reach this page. Try a normal website tab." };
  return result;
}

toggleSettings.addEventListener("click", () => {
  const open = settingsBody.classList.toggle("open");
  toggleSettings.textContent = open ? "Hide" : "Show";
});

waitInput.addEventListener("change", scheduleSave);
waitInput.addEventListener("input", scheduleSave);
addWordBtn.addEventListener("click", addStopWord);
wordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addStopWord();
  }
});

resetSettings.addEventListener("click", async () => {
  settings = {
    waitSeconds: DEFAULT_SETTINGS.waitSeconds,
    stopWords: [...DEFAULT_SETTINGS.stopWords],
  };
  waitInput.value = settings.waitSeconds;
  renderChips();
  await chrome.storage.sync.set(settings);
  showSaved();
  setStatus("Settings reset to defaults.", "ok");
});

fillBtn.addEventListener("click", async () => {
  if (isRunning) return;
  setStatus("Filling form…", "active");
  const { count, stop, reason } = await runFill();
  if (stop) {
    setStatus(reason, "warn");
    return;
  }
  setStatus(`Filled ${count} field${count === 1 ? "" : "s"}.`, "ok");
});

runBtn.addEventListener("click", () => {
  if (isRunning) return;
  setRunningUI(true);
  runLoop();
});

stopBtn.addEventListener("click", () => {
  if (loopTimeout) clearTimeout(loopTimeout);
  loopTimeout = null;
  setRunningUI(false);
  setStatus("Stopped.", "danger");
});

async function runLoop() {
  if (!isRunning) return;

  setStatus("Filling form…", "active");
  const { count, stop, reason } = await runFill();
  if (!isRunning) return;

  if (stop) {
    setRunningUI(false);
    setStatus(reason, "warn");
    return;
  }

  setStatus(`Filled ${count} — submitting…`, "active");
  const clicked = await clickSubmit();
  if (!isRunning) return;

  if (!clicked) {
    setRunningUI(false);
    setStatus("No Next / Submit button found — stopped.", "warn");
    return;
  }

  const waitMs = Math.round((settings.waitSeconds || 4.5) * 1000);
  setStatus(`Waiting ${settings.waitSeconds}s for next page…`, "active");
  loopTimeout = setTimeout(() => runLoop(), waitMs);
}

loadSettings();
