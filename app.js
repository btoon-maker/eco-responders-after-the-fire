// --------------------
// Storage helpers
// --------------------
function loadSaved(key) { return localStorage.getItem(key) || ""; }
function saveLocal(key, value) { localStorage.setItem(key, value); }
function removeLocal(key) { localStorage.removeItem(key); }

// Keys we want to persist
const SAVE_KEYS = ["p1_original", "p1_revised", "p2_original", "branch_choice", "currentStep"];

// --------------------
// Navigation + Save Place
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

  // If branch exists and we're on step3, show feedback
  if (stepId === "step3") {
    renderBranchFeedback(loadSaved("branch_choice"));
  }
}

// --------------------
// Auto-save for textareas
// --------------------
document.querySelectorAll("textarea[data-save]").forEach((ta) => {
  const key = ta.dataset.save;
  ta.value = loadSaved(key);
  ta.addEventListener("input", () => saveLocal(key, ta.value));
});

// --------------------
// Branch choice feedback
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
// Export notes (still useful for Canvas)
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
// ✅ Two-tier saving
// - Auto-save on device (already happening)
// - Save & Exit gives:
//   1) Short Code (6–8) = SAME DEVICE ONLY
//   2) Transfer Code + QR = WORKS ACROSS DEVICES (no server)
// ============================================================

// --- Short Code (same device) ---
const SHORT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // avoids confusing chars
function makeShortCode(len = 6) {
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += SHORT_ALPHABET[arr[i] % SHORT_ALPHABET.length];
  return out;
}
function shortKey(code) { return `SINS_SHORT_${code}`; }

// --- Transfer Code (across devices) ---
// We compress JSON -> encoded URI component string to keep it as short as possible
function collectState() {
  const state = {};
  for (const k of SAVE_KEYS) state[k] = loadSaved(k);
  return state;
}

function makeTransferCode(state) {
  // Prefix with version for future-proofing
  const json = JSON.stringify(state);
  const packed = LZString.compressToEncodedURIComponent(json);
  return `T1-${packed}`;
}

function decodeTransferCode(code) {
  if (!code.startsWith("T1-")) throw new Error("That doesn't look like a Transfer Code.");
  const packed = code.slice(3);
  const json = LZString.decompressFromEncodedURIComponent(packed);
  if (!json) throw new Error("Could not read that Transfer Code.");
  return JSON.parse(json);
}

function applyState(state) {
  for (const k of SAVE_KEYS) {
    if (typeof state[k] === "string") saveLocal(k, state[k]);
  }

  // Refill textareas currently on screen
  document.querySelectorAll("textarea[data-save]").forEach((ta) => {
    const key = ta.dataset.save;
    ta.value = loadSaved(key);
  });

  // Restore branch feedback if needed
  renderBranchFeedback(loadSaved("branch_choice"));

  // Go to saved place
  const step = loadSaved("currentStep") || "step1";
  showStep(step);
}

// --------------------
// Save & Exit UI outputs + QR
// --------------------
const saveExitBtn = document.getElementById("saveExitBtn");
const saveOutputWrap = document.getElementById("saveOutputWrap");
const shortCodeBox = document.getElementById("shortCodeBox");
const transferCodeBox = document.getElementById("transferCodeBox");
const copyTransferBtn = document.getElementById("copyTransferBtn");
let qrInstance = null;

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function renderQR(text) {
  const qrEl = document.getElementById("qr");
  if (!qrEl) return;
  qrEl.innerHTML = ""; // clear
  qrInstance = new QRCode(qrEl, {
    text,
    width: 180,
    height: 180,
    correctLevel: QRCode.CorrectLevel.M
  });
}

if (saveExitBtn) {
  saveExitBtn.addEventListener("click", async () => {
    const state = collectState();

    // 1) Same-device short code
    const short = makeShortCode(6);
    saveLocal(shortKey(short), JSON.stringify(state));

    // 2) Cross-device transfer code
    const transfer = makeTransferCode(state);

    // Show outputs
    if (saveOutputWrap) saveOutputWrap.classList.remove("hidden");
    if (shortCodeBox) shortCodeBox.textContent = short;
    if (transferCodeBox) transferCodeBox.textContent = transfer;

    // Auto-copy transfer code
    const copied = await copyToClipboard(transfer);

    // Always generate QR
    renderQR(transfer);

    // Friendly message
    alert(
      copied
        ? "Saved! Transfer Code copied.\nIf switching devices, use the Transfer Code or scan the QR."
        : "Saved!\nClipboard was blocked, so use the Copy button or scan the QR."
    );
  });
}

if (copyTransferBtn) {
  copyTransferBtn.addEventListener("click", async () => {
    const transfer = (transferCodeBox?.textContent || "").trim();
    if (!transfer) return alert("No Transfer Code yet. Click Save & Exit first.");
    const ok = await copyToClipboard(transfer);
    alert(ok ? "Transfer Code copied!" : "Clipboard blocked—highlight and copy the Transfer Code manually.");
  });
}

// --------------------
// Resume UI (accepts either Short Code or Transfer Code)
// --------------------
const resumeBtn = document.getElementById("resumeBtn");
const resumeInput = document.getElementById("resumeInput");
const resumeMsg = document.getElementById("resumeMsg");
const clearResumeInputBtn = document.getElementById("clearResumeInputBtn");

function setResumeMsg(text) {
  if (resumeMsg) resumeMsg.textContent = text;
}

if (clearResumeInputBtn && resumeInput) {
  clearResumeInputBtn.addEventListener("click", () => {
    resumeInput.value = "";
    setResumeMsg("");
  });
}

if (resumeBtn && resumeInput) {
  resumeBtn.addEventListener("click", () => {
    const raw = resumeInput.value.trim();

    try {
      if (!raw) throw new Error("Paste a code first.");

      // If it looks like a Transfer Code, use that
      if (raw.startsWith("T1-")) {
        const state = decodeTransferCode(raw);
        applyState(state);
        setResumeMsg("✅ Resumed from Transfer Code.");
        return;
      }

      // Otherwise treat it as a Short Code (same device)
      const code = raw.toUpperCase().replace(/\s+/g, "");
      if (code.length < 6 || code.length > 8) {
        throw new Error("That code is not the right length. Use the Transfer Code or the Short Code (6–8 letters/numbers).");
      }

      const stored = loadSaved(shortKey(code));
      if (!stored) throw new Error("Short Code not found on this device. Use the Transfer Code or QR if you switched devices.");

      const state = JSON.parse(stored);
      applyState(state);
      setResumeMsg("✅ Resumed from Short Code (same device).");
    } catch (err) {
      setResumeMsg(`⚠️ ${err.message}`);
    }
  });
}

// --------------------
// Reset
// --------------------
const resetBtn = document.getElementById("resetBtn");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    const ok = confirm("This will clear saved work on THIS device. Continue?");
    if (!ok) return;

    SAVE_KEYS.forEach(removeLocal);
    // Note: we do not delete all possible short-code entries; that's okay for a prototype.
    location.reload();
  });
}

// --------------------
// Start
// --------------------
const savedStep = loadSaved("currentStep") || "step1";
showStep(savedStep);
renderBranchFeedback(loadSaved("branch_choice"));
