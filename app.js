// --------------------
// Storage helpers
// --------------------
function loadSaved(key) {
  return localStorage.getItem(key) || "";
}
function saveLocal(key, value) {
  localStorage.setItem(key, value);
}
function removeLocal(key) {
  localStorage.removeItem(key);
}

// Keys we want to include in the resume payload
const SAVE_KEYS = ["p1_original", "p1_revised", "p2_original", "branch_choice", "currentStep"];

// --------------------
// Step navigation
// --------------------
function showStep(stepId) {
  saveLocal("currentStep", stepId);

  document.querySelectorAll("section[id^='step']").forEach((sec) => {
    sec.classList.toggle("hidden", sec.id !== stepId);
  });

  if (stepId === "step2") {
    const p1 = loadSaved("p1_original");
    const p1Show = document.getElementById("p1_show");
    if (p1Show) p1Show.textContent = p1 || "(nothing yet)";
  }
}

// --------------------
// Auto-save all textareas with data-save
// --------------------
document.querySelectorAll("textarea[data-save]").forEach((ta) => {
  const key = ta.dataset.save;
  ta.value = loadSaved(key);
  ta.addEventListener("input", () => saveLocal(key, ta.value));
});

// --------------------
// Choice feedback
// --------------------
function renderBranchFeedback(value) {
  const box = document.getElementById("choice_feedback");
  if (!box) return;

  const messages = {
    weather: "✅ Weather track selected. Next, we’ll look at wind + humidity and how they affect fire spread.",
    human: "✅ Human-cause track selected. Next, we’ll investigate activities that can ignite fires and prevention strategies.",
    habitat: "✅ Habitat recovery track selected. Next, we’ll examine how plants/animals recover and what supports regrowth.",
  };

  if (!value) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  box.classList.remove("hidden");
  box.innerHTML = `<h3 style="margin-top:0;">Choice saved</h3><p style="margin:0;">${messages[value] || "Choice saved."}</p>`;
}

// --------------------
// Buttons: Next/Back + choice
// --------------------
document.addEventListener("click", (e) => {
  const next = e.target.closest("[data-next]");
  const prev = e.target.closest("[data-prev]");
  const choice = e.target.closest("[data-choice]");

  if (next) showStep(next.dataset.next);
  if (prev) showStep(prev.dataset.prev);

  if (choice && choice.dataset.choice === "branch") {
    const value = choice.dataset.value;
    saveLocal("branch_choice", value);
    renderBranchFeedback(value);
  }
});

// --------------------
// Export notes (clipboard/prompt fallback)
// --------------------
const exportBtn = document.getElementById("exportBtn");
if (exportBtn) {
  exportBtn.addEventListener("click", async () => {
    const text = buildNotesText();
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied to clipboard! Paste into Canvas or your Field Journal.");
    } catch {
      prompt("Copy your notes below:", text);
    }
  });
}

function buildNotesText() {
  const p1_original = loadSaved("p1_original");
  const p1_revised = loadSaved("p1_revised");
  const p2_original = loadSaved("p2_original");
  const branch = loadSaved("branch_choice");
  const currentStep = loadSaved("currentStep") || "step1";

  return `Eco-Responders Notes (Prototype)

Saved Place:
${currentStep}

Step 1 - First Thinking:
${p1_original || "(blank)"}

Step 1 - Revised Thinking (optional):
${p1_revised || "(blank)"}

Step 2 - Evidence I want:
${p2_original || "(blank)"}

Decision Track:
${branch || "(not selected)"}
`;
}

// ============================================================
// ✅ Resume Code + QR (no server)
// ============================================================

// Encode/decode (Unicode-safe Base64)
function encodeState(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `SINS1.${b64}`; // version prefix
}
function decodeState(code) {
  if (!code.startsWith("SINS1.")) throw new Error("That code doesn't look like a valid Resume Code.");
  const b64 = code.slice("SINS1.".length);
  const json = decodeURIComponent(escape(atob(b64)));
  return JSON.parse(json);
}

function collectState() {
  const state = {};
  for (const k of SAVE_KEYS) state[k] = loadSaved(k);
  return state;
}

function applyState(state) {
  for (const k of SAVE_KEYS) {
    if (typeof state[k] === "string") saveLocal(k, state[k]);
  }

  // Refill UI textareas
  document.querySelectorAll("textarea[data-save]").forEach((ta) => {
    const key = ta.dataset.save;
    ta.value = loadSaved(key);
  });

  renderBranchFeedback(loadSaved("branch_choice"));

  const step = loadSaved("currentStep") || "step1";
  showStep(step);
}

// ----- Kid Code (short label only; NOT used for restore) -----
function kidCodeFromResumeCode(resumeCode) {
  // 6-char label derived from the resume code for “receipt” purposes
  // Not reversible; just helps students confirm they saved.
  let hash = 0;
  for (let i = 0; i < resumeCode.length; i++) {
    hash = (hash * 31 + resumeCode.charCodeAt(i)) >>> 0;
  }
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing 0/O/1/I
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[(hash + i * 17) % alphabet.length];
    hash = (hash >>> 1) ^ (hash << 1);
  }
  return out;
}

// ----- Modal controls -----
const backdrop = document.getElementById("saveModalBackdrop");
const modal = document.getElementById("saveModal");
const qrDiv = document.getElementById("qr");
const resumeCodeBox = document.getElementById("resumeCodeBox");
const resumeLinkBox = document.getElementById("resumeLinkBox");
const kidCodeEl = document.getElementById("kidCode");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const closeSaveModalBtn = document.getElementById("closeSaveModalBtn");

function openSaveModal() {
  backdrop.style.display = "block";
  modal.style.display = "block";
}
function closeSaveModal() {
  backdrop.style.display = "none";
  modal.style.display = "none";
  if (qrDiv) qrDiv.innerHTML = "";
}

if (backdrop) backdrop.addEventListener("click", closeSaveModal);
if (closeSaveModalBtn) closeSaveModalBtn.addEventListener("click", closeSaveModal);

// Save & Exit (top-right widget)
const saveExitBtnTop = document.getElementById("saveExitBtnTop");
if (saveExitBtnTop) {
  saveExitBtnTop.addEventListener("click", async () => {
    const state = collectState();
    const resumeCode = encodeState(state);

    // Build a resume link that auto-restores from the URL hash
    const baseUrl = window.location.origin + window.location.pathname;
    const resumeUrl = `${baseUrl}#resume=${encodeURIComponent(resumeCode)}`;

    // Fill modal fields
    resumeCodeBox.value = resumeCode;
    resumeLinkBox.value = resumeUrl;
    kidCodeEl.textContent = kidCodeFromResumeCode(resumeCode);

    // Copy automatically (and also show it)
    try {
      await navigator.clipboard.writeText(resumeCode);
      setTopMsg("✅ Saved. Resume Code copied.", true);
    } catch {
      setTopMsg("✅ Saved. Copy the code from the popup.", true);
    }

    // QR code encodes the resume URL (best cross-device UX)
    if (qrDiv) {
      qrDiv.innerHTML = "";
      // qrcode library is loaded in index.html
      // eslint-disable-next-line no-undef
      new QRCode(qrDiv, { text: resumeUrl, width: 144, height: 144 });
    }

    // Copy button in modal
    if (copyCodeBtn) {
      copyCodeBtn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(resumeCode);
          alert("Resume Code copied!");
        } catch {
          prompt("Copy this Resume Code:", resumeCode);
        }
      };
    }

    openSaveModal();

    // Optional: “exit feel” — send them back to step 1 view (or keep them)
    // showStep(loadSaved("currentStep") || "step1");
  });
}

// ----- Resume from Code (top-right) -----
const resumeInputTop = document.getElementById("resumeInputTop");
const resumeBtnTop = document.getElementById("resumeBtnTop");
const clearResumeTop = document.getElementById("clearResumeTop");
const resumeMsgTop = document.getElementById("resumeMsgTop");

function setTopMsg(text, strong = false) {
  if (!resumeMsgTop) return;
  resumeMsgTop.innerHTML = strong ? `<strong>${text}</strong>` : text;
}

if (clearResumeTop && resumeInputTop) {
  clearResumeTop.addEventListener("click", () => {
    resumeInputTop.value = "";
    setTopMsg("");
  });
}

if (resumeBtnTop && resumeInputTop) {
  resumeBtnTop.addEventListener("click", () => {
    try {
      const code = resumeInputTop.value.trim();
      const state = decodeState(code);
      applyState(state);
      setTopMsg("✅ Resumed!", true);
    } catch (err) {
      setTopMsg(`⚠️ ${err.message}`);
    }
  });
}

// Auto-resume from URL hash (QR flow)
function tryResumeFromHash() {
  const hash = window.location.hash || "";
  const match = hash.match(/resume=([^&]+)/);
  if (!match) return false;

  try {
    const code = decodeURIComponent(match[1]);
    const state = decodeState(code);
    applyState(state);
    setTopMsg("✅ Resumed from QR/link.", true);

    // Clean the URL so the code isn't visible after resuming
    history.replaceState(null, "", window.location.pathname);
    return true;
  } catch (err) {
    setTopMsg(`⚠️ Could not resume: ${err.message}`);
    return false;
  }
}

// --------------------
// Reset (for testing)
// --------------------
const resetBtn = document.getElementById("resetBtn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    const ok = confirm("This will clear saved responses AND saved place on this device. Continue?");
    if (!ok) return;

    SAVE_KEYS.forEach(removeLocal);
    location.reload();
  });
}

// --------------------
// Start
// --------------------
const resumedFromHash = tryResumeFromHash();

if (!resumedFromHash) {
  const savedStep = loadSaved("currentStep") || "step1";
  showStep(savedStep);
  renderBranchFeedback(loadSaved("branch_choice"));
}
