// =====================
// Keys we save
// =====================
const SAVE_KEYS = ["p1_original", "p1_revised", "p2_original", "branch_choice", "currentStep"];

// =====================
// Local storage helpers
// =====================
function loadSaved(key) {
  return localStorage.getItem(key) || "";
}
function saveLocal(key, value) {
  localStorage.setItem(key, value);
}
function removeLocal(key) {
  localStorage.removeItem(key);
}

// =====================
// Navigation / save place
// =====================
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

// =====================
// Auto-save textareas
// =====================
document.querySelectorAll("textarea[data-save]").forEach((ta) => {
  const key = ta.dataset.save;
  ta.value = loadSaved(key);
  ta.addEventListener("input", () => saveLocal(key, ta.value));
});

// =====================
// Branch feedback
// =====================
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

// =====================
// Next/Back + choices
// =====================
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

// =====================
// Export notes (still useful)
// =====================
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

// =====================================================
// Resume Code (no server): store progress inside the code
// - We compress JSON -> URL-safe string
// - QR encodes a full resume URL (lesson + code)
// =====================================================
function collectState() {
  const state = {};
  for (const k of SAVE_KEYS) state[k] = loadSaved(k);
  return state;
}

function encodeStateToCode(stateObj) {
  const json = JSON.stringify(stateObj);
  // compress to URL-safe string
  const compressed = LZString.compressToEncodedURIComponent(json);
  // version prefix so you can change formats later safely
  return `R1.${compressed}`;
}

function decodeCodeToState(code) {
  const trimmed = (code || "").trim();

  // Accept: full URL, or just hash, or just code
  // If it's a URL with #r=..., extract r
  let raw = trimmed;

  try {
    const url = new URL(trimmed);
    raw = url.hash || ""; // includes leading '#'
  } catch {
    // not a full URL, continue
  }

  // If it contains #r= or r=, extract
  if (raw.includes("r=")) {
    const hash = raw.startsWith("#") ? raw.slice(1) : raw;
    const params = new URLSearchParams(hash);
    raw = params.get("r") || trimmed;
  }

  // Now raw should be the code (R1.xxx or xxx)
  const codeOnly = raw.startsWith("R1.") ? raw : raw.trim();

  if (!codeOnly.startsWith("R1.")) {
    throw new Error("That doesn’t look like a valid Resume Code.");
  }

  const payload = codeOnly.slice(3);
  const json = LZString.decompressFromEncodedURIComponent(payload);

  if (!json) throw new Error("Resume Code could not be read (maybe it was cut off).");

  return JSON.parse(json);
}

function applyState(state) {
  for (const k of SAVE_KEYS) {
    if (typeof state[k] === "string") saveLocal(k, state[k]);
  }

  // Refill any visible fields
  document.querySelectorAll("textarea[data-save]").forEach((ta) => {
    const key = ta.dataset.save;
    ta.value = loadSaved(key);
  });

  renderBranchFeedback(loadSaved("branch_choice"));

  const step = loadSaved("currentStep") || "step1";
  showStep(step);
}

// Build a resume URL that includes lesson + resume code in the hash
function buildResumeUrl(codeOnly) {
  const base = `${location.origin}${location.pathname}`;
  const params = new URLSearchParams();
  params.set("r", codeOnly);
  return `${base}#${params.toString()}`;
}

// =====================
// Top-right panel controls
// =====================
const saveExitBtnTop = document.getElementById("saveExitBtnTop");
const resetBtnTop = document.getElementById("resetBtnTop");
const resumeInputTop = document.getElementById("resumeInputTop");
const resumeBtnTop = document.getElementById("resumeBtnTop");
const clearResumeInputBtnTop = document.getElementById("clearResumeInputBtnTop");
const resumeMsgTop = document.getElementById("resumeMsgTop");

// Modal elements
const backdrop = document.getElementById("saveModalBackdrop");
const closeModalBtn = document.getElementById("closeModalBtn");
const qrBox = document.getElementById("qrBox");
const resumeCodeBox = document.getElementById("resumeCodeBox");
const resumeLinkBox = document.getElementById("resumeLinkBox");
const copyCodeBtn = document.getElementById("copyCodeBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");

function openModal() {
  backdrop.classList.add("show");
}
function closeModal() {
  backdrop.classList.remove("show");
}

if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
if (backdrop) backdrop.addEventListener("click", (e) => {
  if (e.target === backdrop) closeModal();
});

// Save & Exit: generate code + link + QR + copy
if (saveExitBtnTop) {
  saveExitBtnTop.addEventListener("click", async () => {
    const state = collectState();
    const code = encodeStateToCode(state);
    const resumeUrl = buildResumeUrl(code);

    // Fill modal text
    resumeCodeBox.textContent = code;
    resumeLinkBox.textContent = resumeUrl;

    // Build QR (lesson + resume code)
    qrBox.innerHTML = "";
    // qrcodejs renders into the element
    new QRCode(qrBox, {
      text: resumeUrl,
      width: 210,
      height: 210,
      correctLevel: QRCode.CorrectLevel.M
    });

    openModal();

    // Auto-copy the resume URL (best chance to work)
    try {
      await navigator.clipboard.writeText(resumeUrl);
      if (resumeMsgTop) resumeMsgTop.textContent = "✅ Saved. Resume link copied!";
    } catch {
      if (resumeMsgTop) resumeMsgTop.textContent = "Saved! If copy didn’t work, use the Copy buttons in the popup.";
    }
  });
}

// Copy buttons in modal
if (copyCodeBtn) {
  copyCodeBtn.addEventListener("click", async () => {
    const code = resumeCodeBox.textContent.trim();
    try {
      await navigator.clipboard.writeText(code);
      alert("Resume Code copied!");
    } catch {
      prompt("Copy this Resume Code:", code);
    }
  });
}

if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", async () => {
    const link = resumeLinkBox.textContent.trim();
    try {
      await navigator.clipboard.writeText(link);
      alert("Resume Link copied!");
    } catch {
      prompt("Copy this Resume Link:", link);
    }
  });
}

// Resume from pasted code/link/url
if (resumeBtnTop) {
  resumeBtnTop.addEventListener("click", () => {
    try {
      const text = (resumeInputTop.value || "").trim();
      const state = decodeCodeToState(text);
      applyState(state);
      if (resumeMsgTop) resumeMsgTop.textContent = "✅ Resumed! Your work was restored.";
    } catch (err) {
      if (resumeMsgTop) resumeMsgTop.textContent = `⚠️ ${err.message}`;
    }
  });
}

if (clearResumeInputBtnTop) {
  clearResumeInputBtnTop.addEventListener("click", () => {
    resumeInputTop.value = "";
    if (resumeMsgTop) resumeMsgTop.textContent = "";
  });
}

// Reset on this device
if (resetBtnTop) {
  resetBtnTop.addEventListener("click", () => {
    const ok = confirm("This clears saved work on THIS device. Continue?");
    if (!ok) return;

    SAVE_KEYS.forEach(removeLocal);
    // also clear URL resume hash if present
    history.replaceState(null, "", `${location.origin}${location.pathname}`);
    location.reload();
  });
}

// =====================
// Auto-resume from URL hash (#r=...)
// This is what makes QR cross-device work with no server.
// =====================
function tryResumeFromHash() {
  const hash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
  if (!hash) return false;

  const params = new URLSearchParams(hash);
  const code = params.get("r");
  if (!code) return false;

  try {
    const state = decodeCodeToState(code);
    applyState(state);
    if (resumeMsgTop) resumeMsgTop.textContent = "✅ Resumed from QR/link!";
    return true;
  } catch {
    return false;
  }
}

// =====================
// Start
// 1) Try resume from QR/link hash
// 2) Else resume locally (same device)
// =====================
const resumedFromHash = tryResumeFromHash();
if (!resumedFromHash) {
  const savedStep = loadSaved("currentStep") || "step1";
  showStep(savedStep);
  renderBranchFeedback(loadSaved("branch_choice"));
}
