// ======================
// Two-tier saving system
// ======================
// Tier 1: auto-save on device (localStorage keys)
// Tier 2: Save & Exit generates a "Resume Code" carrying the saved state (cross-device)

const SAVE_KEYS = ["p1_original", "p1_revised", "p2_original", "branch_choice", "currentStep"];

// ---------- Local storage helpers ----------
function loadLocal(key) { return localStorage.getItem(key) || ""; }
function saveLocal(key, value) { localStorage.setItem(key, value); }
function clearLocal(key) { localStorage.removeItem(key); }

// ---------- UI: show/hide steps + save place ----------
function showStep(stepId) {
  saveLocal("currentStep", stepId);

  document.querySelectorAll("section[id^='step']").forEach(sec => {
    sec.classList.toggle("hidden", sec.id !== stepId);
  });

  if (stepId === "step2") {
    const p1 = loadLocal("p1_original");
    const p1Show = document.getElementById("p1_show");
    if (p1Show) p1Show.textContent = p1 || "(nothing yet)";
  }

  if (stepId === "step3") {
    renderBranchFeedback(loadLocal("branch_choice"));
  }
}

// ---------- Auto-save for textareas ----------
document.querySelectorAll("textarea[data-save]").forEach(ta => {
  const key = ta.dataset.save;
  ta.value = loadLocal(key);
  ta.addEventListener("input", () => saveLocal(key, ta.value));
});

// ---------- Branch feedback ----------
function renderBranchFeedback(value) {
  const box = document.getElementById("choice_feedback");
  if (!box) return;

  const messages = {
    weather: "✅ Weather track selected.",
    human: "✅ Human-cause track selected.",
    habitat: "✅ Habitat recovery track selected."
  };

  if (!value) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  box.classList.remove("hidden");
  box.innerHTML = `<h3 style="margin-top:0;">Choice saved</h3><p style="margin:0;">${messages[value] || "Choice saved."}</p>`;
}

// ---------- Click handlers for Next/Back + Choices ----------
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

// ---------- Export notes ----------
document.getElementById("exportBtn")?.addEventListener("click", async () => {
  const text = buildNotesText();
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied! Paste into Canvas or your Field Journal.");
  } catch {
    prompt("Copy your notes below:", text);
  }
});

function buildNotesText() {
  const p1_original = loadLocal("p1_original");
  const p1_revised = loadLocal("p1_revised");
  const p2_original = loadLocal("p2_original");
  const branch = loadLocal("branch_choice");
  const currentStep = loadLocal("currentStep") || "step1";

  return `Eco-Responders Notes (Prototype)

Saved Place: ${currentStep}

Step 1 - First Thinking:
${p1_original || "(blank)"}

Step 1 - Revised Thinking:
${p1_revised || "(blank)"}

Step 2 - Evidence I want:
${p2_original || "(blank)"}

Decision Track:
${branch || "(not selected)"}
`;
}

// =====================================================
// Resume Code: compressed, no-server, cross-device
// =====================================================

// We compress JSON using built-in CompressionStream if available.
// If not available, we fall back to base64 (still works, just longer).
async function encodeStateToCode(stateObj) {
  const json = JSON.stringify(stateObj);

  // Try compression (modern Chrome/Edge have this)
  if ("CompressionStream" in window) {
    const cs = new CompressionStream("gzip");
    const input = new Blob([json]).stream().pipeThrough(cs);
    const compressed = await new Response(input).arrayBuffer();
    const b64 = base64UrlFromBytes(new Uint8Array(compressed));
    return "S1." + b64;
  }

  // Fallback (no compression)
  const b64 = base64UrlFromString(json);
  return "S1." + b64;
}

async function decodeCodeToState(code) {
  if (!code.startsWith("S1.")) throw new Error("That Resume Code doesn’t look right.");
  const payload = code.slice(3);

  // Try decompress first (if we have CompressionStream/DecompressionStream)
  if ("DecompressionStream" in window) {
    try {
      const bytes = base64UrlToBytes(payload);
      const ds = new DecompressionStream("gzip");
      const input = new Blob([bytes]).stream().pipeThrough(ds);
      const json = await new Response(input).text();
      return JSON.parse(json);
    } catch {
      // If it wasn't compressed, fall through and try plain JSON decode
    }
  }

  // Plain base64url JSON
  const json = base64UrlToString(payload);
  return JSON.parse(json);
}

// base64url helpers
function base64UrlFromString(str) {
  const b64 = btoa(unescape(encodeURIComponent(str)));
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function base64UrlToString(b64url) {
  let b64 = b64url.replaceAll("-", "+").replaceAll("_", "/");
  while (b64.length % 4) b64 += "=";
  const str = decodeURIComponent(escape(atob(b64)));
  return str;
}
function base64UrlFromBytes(bytes) {
  let bin = "";
  bytes.forEach(b => bin += String.fromCharCode(b));
  const b64 = btoa(bin);
  return b64.replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function base64UrlToBytes(b64url) {
  let b64 = b64url.replaceAll("-", "+").replaceAll("_", "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Kid-friendly nickname (2–3 simple words)
const WORDS = [
  "SUN", "RIVER", "PANDA", "MAPLE", "ROCK", "OWL", "STAR", "FROG", "CLOUD", "PINE",
  "FOX", "MOON", "BEE", "SAND", "WAVE", "LEAF", "SPARK", "RAIN", "MOSS", "TRAIL"
];
function makeNickname() {
  const w1 = WORDS[Math.floor(Math.random() * WORDS.length)];
  const w2 = WORDS[Math.floor(Math.random() * WORDS.length)];
  const w3 = WORDS[Math.floor(Math.random() * WORDS.length)];
  // 2–3 words; choose 2 most of the time
  return Math.random() < 0.7 ? `${w1} ${w2}` : `${w1} ${w2} ${w3}`;
}

// ---------- Save & Exit + Resume UI ----------
const saveExitBtn = document.getElementById("saveExitBtn");
const resumeBtn = document.getElementById("resumeBtn");
const clearResumeBtn = document.getElementById("clearResumeBtn");
const resumeInput = document.getElementById("resumeInput");
const resumeMsg = document.getElementById("resumeMsg");
const resumeNick = document.getElementById("resumeNick");

// Collect state from local storage
function collectState() {
  const state = {};
  for (const k of SAVE_KEYS) state[k] = loadLocal(k);
  return state;
}

// Apply state back into local storage + UI
function applyState(state) {
  for (const k of SAVE_KEYS) {
    if (typeof state[k] === "string") saveLocal(k, state[k]);
  }

  // Refill textareas
  document.querySelectorAll("textarea[data-save]").forEach(ta => {
    ta.value = loadLocal(ta.dataset.save);
  });

  // Jump to saved place
  showStep(loadLocal("currentStep") || "step1");
}

saveExitBtn?.addEventListener("click", async () => {
  // Ensure place is up-to-date
  const current = loadLocal("currentStep") || "step1";
  saveLocal("currentStep", current);

  const state = collectState();
  const code = await encodeStateToCode(state);
  const nick = makeNickname();

  // Show nickname + code (copy-friendly)
  if (resumeNick) {
    resumeNick.classList.remove("hidden");
    resumeNick.textContent = `Resume Words: ${nick}\n\nResume Code:\n${formatCode(code)}`;
  }

  // Copy to clipboard if possible
  try {
    await navigator.clipboard.writeText(code);
    if (resumeMsg) resumeMsg.textContent = "Saved! Resume Code copied. Paste it somewhere safe.";
  } catch {
    if (resumeMsg) resumeMsg.textContent = "Saved! Copy the Resume Code from the box above.";
  }

  // Small “exit” behavior: scroll to top so they see it immediately
  window.scrollTo({ top: 0, behavior: "smooth" });
});

resumeBtn?.addEventListener("click", async () => {
  try {
    const code = (resumeInput?.value || "").trim();
    if (!code) throw new Error("Paste your Resume Code first.");
    const state = await decodeCodeToState(code);
    applyState(state);
    if (resumeMsg) resumeMsg.textContent = "Resumed! You’re back where you left off.";
  } catch (err) {
    if (resumeMsg) resumeMsg.textContent = `⚠️ ${err.message}`;
  }
});

clearResumeBtn?.addEventListener("click", () => {
  if (resumeInput) resumeInput.value = "";
  if (resumeMsg) resumeMsg.textContent = "";
});

// Make the displayed code easier to copy/read (adds breaks)
function formatCode(code) {
  // Keep the real code unchanged (students paste the real one from clipboard).
  // This formatted version is just for display readability.
  return chunk(code, 32).join("\n");
}
function chunk(str, size) {
  const out = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out;
}

// ---------- Reset ----------
document.getElementById("resetBtn")?.addEventListener("click", () => {
  const ok = confirm("Reset clears all saved work on this device. Continue?");
  if (!ok) return;
  SAVE_KEYS.forEach(clearLocal);
  location.reload();
});

// ---------- Start: resume on device if possible ----------
showStep(loadLocal("currentStep") || "step1");
renderBranchFeedback(loadLocal("branch_choice"));
