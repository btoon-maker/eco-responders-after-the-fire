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

// --------------------
// Keys we save for this prototype
// --------------------
const SAVE_KEYS = ["p1_original", "p1_revised", "p2_original", "branch_choice", "currentStep"];

// --------------------
// Navigation
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
// Auto-save textareas
// --------------------
document.querySelectorAll("textarea[data-save]").forEach((ta) => {
  const key = ta.dataset.save;
  ta.value = loadSaved(key);
  ta.addEventListener("input", () => saveLocal(key, ta.value));
});

// --------------------
// Branch feedback
// --------------------
function renderBranchFeedback(value) {
  const box = document.getElementById("choice_feedback");
  if (!box) return;

  const messages = {
    weather: "✅ Weather track selected.",
    human: "✅ Human-cause track selected.",
    habitat: "✅ Habitat recovery track selected.",
  };

  if (!value) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  box.classList.remove("hidden");
  box.innerHTML = `<h3 style="margin-top:0;">Choice saved</h3><p style="margin:0;">${messages[value] || "Choice saved."}</p>`;
}

// Choice buttons + Next/Back
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
// Export notes (clipboard/prompt)
// --------------------
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

// ============================================================
// Resume Code (no server)
// ============================================================
// NOTE: The code must contain the saved writing. That’s why it’s longer.
// We keep it copy/paste friendly, not hand-typed.

// Unicode-safe base64 encode/decode
function encodeState(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `SINS1.${b64}`;
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

  // refill boxes
  document.querySelectorAll("textarea[data-save]").forEach((ta) => {
    ta.value = loadSaved(ta.dataset.save);
  });

  // restore choice feedback
  renderBranchFeedback(loadSaved("branch_choice"));

  // jump to saved place
  const step = loadSaved("currentStep") || "step1";
  showStep(step);
}

// ---- Top-right controls ----
const saveExitBtnTop = document.getElementById("saveExitBtnTop");
const resumeInputTop = document.getElementById("resumeInputTop");
const resumeBtnTop = document.getElementById("resumeBtnTop");
const clearResumeTop = document.getElementById("clearResumeTop");
const resumeMsgTop = document.getElementById("resumeMsgTop");

if (clearResumeTop && resumeInputTop && resumeMsgTop) {
  clearResumeTop.addEventListener("click", () => {
    resumeInputTop.value = "";
    resumeMsgTop.textContent = "";
  });
}

if (saveExitBtnTop && resumeMsgTop) {
  saveExitBtnTop.addEventListener("click", async () => {
    const code = encodeState(collectState());

    try {
      await navigator.clipboard.writeText(code);
      resumeMsgTop.textContent = "✅ Saved! Resume Code copied. Paste it somewhere safe.";
    } catch {
      // fallback: show prompt for manual copy
      prompt("Copy this Resume Code and save it somewhere safe:", code);
      resumeMsgTop.textContent = "Saved. Copy the code from the pop-up and keep it safe.";
    }

    // Optional “exit”: scroll to top so the widget is visible
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

if (resumeBtnTop && resumeInputTop && resumeMsgTop) {
  resumeBtnTop.addEventListener("click", () => {
    try {
      const code = resumeInputTop.value.trim();
      const state = decodeState(code);
      applyState(state);
      resumeMsgTop.textContent = "✅ Resumed! Your work is back.";
    } catch (err) {
      resumeMsgTop.textContent = `⚠️ ${err.message}`;
    }
  });
}

// --------------------
// Reset (testing)
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

// Start (device autosave resume)
renderBranchFeedback(loadSaved("branch_choice"));
showStep(loadSaved("currentStep") || "step1");
