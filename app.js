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
// Scene/step navigation
// --------------------
function showStep(stepId) {
  // save place automatically
  saveLocal("currentStep", stepId);

  document.querySelectorAll("section[id^='step']").forEach((sec) => {
    sec.classList.toggle("hidden", sec.id !== stepId);
  });

  // keep revision visible in step2
  if (stepId === "step2") {
    const p1 = loadSaved("p1_original");
    const p1Show = document.getElementById("p1_show");
    if (p1Show) p1Show.textContent = p1 || "(nothing yet)";
  }
}

// --------------------
// Auto-save for all textareas
// --------------------
document.querySelectorAll("textarea[data-save]").forEach((ta) => {
  const key = ta.dataset.save;
  ta.value = loadSaved(key);
  ta.addEventListener("input", () => saveLocal(key, ta.value));
});

// --------------------
// Branch choice feedback (reuse this for resume too)
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
  box.innerHTML = `<h3 style="margin-top:0;">Choice saved</h3><p style="margin:0;">${
    messages[value] || "Choice saved."
  }</p>`;
}

// --------------------
// Next/Back + Choice buttons
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
// Export notes (clipboard/prompt)
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
// ✅ RESUME CODE SYSTEM (Save & Exit + Resume from Code)
// ============================================================

// We store only what we need for this prototype.
// If you add more prompts later, add their keys here.
const SAVE_KEYS = ["p1_original", "p1_revised", "p2_original", "branch_choice", "currentStep"];

// Simple base64 helpers that handle Unicode safely
function encodeState(obj) {
  const json = JSON.stringify(obj);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return `SINS1.${b64}`; // prefix for versioning
}

function decodeState(code) {
  if (!code.startsWith("SINS1.")) throw new Error("That code doesn't look like a valid Resume Code.");
  const b64 = code.slice("SINS1.".length);
  const json = decodeURIComponent(escape(atob(b64)));
  return JSON.parse(json);
}

// Build the state from localStorage
function collectState() {
  const state = {};
  for (const k of SAVE_KEYS) state[k] = loadSaved(k);
  return state;
}

// Apply the state into localStorage + UI
function applyState(state) {
  for (const k of SAVE_KEYS) {
    if (typeof state[k] === "string") saveLocal(k, state[k]);
  }

  // Refill textareas on screen
  document.querySelectorAll("textarea[data-save]").forEach((ta) => {
    const key = ta.dataset.save;
    ta.value = loadSaved(key);
  });

  // Restore branch feedback (if Step 3 is open later)
  renderBranchFeedback(loadSaved("branch_choice"));

  // Jump to saved place
  const step = loadSaved("currentStep") || "step1";
  showStep(step);
}

// Save & Exit button
const saveExitBtn = document.getElementById("saveExitBtn");
if (saveExitBtn) {
  saveExitBtn.addEventListener("click", async () => {
    const state = collectState();
    const code = encodeState(state);

    // Try to copy
    try {
      await navigator.clipboard.writeText(code);
      alert("Resume Code copied! Paste it somewhere safe (Notes, Canvas draft, etc.).");
    } catch {
      // If clipboard blocked, show it in a prompt for manual copy
      prompt("Copy this Resume Code and save it somewhere safe:", code);
    }

    // “Exit” behavior: send them to a simple end state (optional)
    // You can also redirect to a separate goodbye page later.
    showExitScreen();
  });
}

// Optional: “exit screen” (simple + reassuring)
function showExitScreen() {
  // Hide all steps
  document.querySelectorAll("section[id^='step']").forEach((sec) => sec.classList.add("hidden"));

  // Create a simple message panel
  let panel = document.getElementById("exitPanel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "exitPanel";
    panel.className = "card";
    panel.innerHTML = `
      <h2 style="margin-top:0;">Saved!</h2>
      <p class="small">
        Your work is saved. Keep your Resume Code somewhere safe so you can continue later.
      </p>
      <div class="row">
        <button class="btn" id="returnBtn">Return to Lesson</button>
      </div>
    `;
    document.querySelector("main").appendChild(panel);

    panel.querySelector("#returnBtn").addEventListener("click", () => {
      panel.remove();
      const step = loadSaved("currentStep") || "step1";
      showStep(step);
    });
  }
}

// Resume from Code UI
const resumeBtn = document.getElementById("resumeBtn");
const resumeInput = document.getElementById("resumeInput");
const resumeMsg = document.getElementById("resumeMsg");
const clearResumeInputBtn = document.getElementById("clearResumeInputBtn");

if (clearResumeInputBtn && resumeInput && resumeMsg) {
  clearResumeInputBtn.addEventListener("click", () => {
    resumeInput.value = "";
    resumeMsg.textContent = "";
  });
}

if (resumeBtn && resumeInput && resumeMsg) {
  resumeBtn.addEventListener("click", () => {
    try {
      const code = resumeInput.value.trim();
      const state = decodeState(code);
      applyState(state);
      resumeMsg.textContent = "✅ Resume Code accepted. Your work has been restored.";
    } catch (err) {
      resumeMsg.textContent = `⚠️ ${err.message}`;
    }
  });
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
// Start: resume locally if possible
// --------------------
const savedStep = loadSaved("currentStep") || "step1";
showStep(savedStep);

// If they already had a branch choice, restore feedback when they reach step3
// (and also keep it consistent after refresh)
renderBranchFeedback(loadSaved("branch_choice"));
