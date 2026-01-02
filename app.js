function loadSaved(key) {
  return localStorage.getItem(key) || "";
}
function save(key, value) {
  localStorage.setItem(key, value);
}

function showStep(stepId) {
  document.querySelectorAll("section[id^='step']").forEach(sec => {
    sec.classList.toggle("hidden", sec.id !== stepId);
  });

  // keep revision visible
  if (stepId === "step2") {
    const p1 = loadSaved("p1_original");
    document.getElementById("p1_show").textContent = p1 || "(nothing yet)";
  }
}

// Auto-save for all textareas
document.querySelectorAll("textarea[data-save]").forEach((ta) => {
  const key = ta.dataset.save;
  ta.value = loadSaved(key);

  ta.addEventListener("input", () => save(key, ta.value));
});

// Navigation + choices
document.addEventListener("click", (e) => {
  const next = e.target.closest("[data-next]");
  const prev = e.target.closest("[data-prev]");
  const choice = e.target.closest("[data-choice]");

  if (next) showStep(next.dataset.next);
  if (prev) showStep(prev.dataset.prev);

  if (choice && choice.dataset.choice === "branch") {
    const value = choice.dataset.value;
    save("branch_choice", value);

    const box = document.getElementById("choice_feedback");
    box.classList.remove("hidden");

    const messages = {
      weather: "✅ Weather track selected. Next, we’ll look at wind + humidity and how they affect fire spread.",
      human: "✅ Human-cause track selected. Next, we’ll investigate activities that can ignite fires and prevention strategies.",
      habitat: "✅ Habitat recovery track selected. Next, we’ll examine how plants/animals recover and what supports regrowth."
    };

    box.innerHTML = `<h3 style="margin-top:0;">Choice saved</h3><p style="margin:0;">${messages[value] || "Choice saved."}</p>`;
  }
});

// Export notes for Canvas
document.getElementById("exportBtn").addEventListener("click", async () => {
  const p1_original = loadSaved("p1_original");
  const p1_revised = loadSaved("p1_revised");
  const p2_original = loadSaved("p2_original");
  const branch = loadSaved("branch_choice");

  const text =
`Eco-Responders Notes (Prototype)

Step 1 - First Thinking:
${p1_original || "(blank)"}

Step 1 - Revised Thinking (optional):
${p1_revised || "(blank)"}

Step 2 - Evidence I want:
${p2_original || "(blank)"}

Decision Track:
${branch || "(not selected)"}
`;

  try {
    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard! Paste into Canvas or your Field Journal.");
  } catch {
    prompt("Copy your notes below:", text);
  }
});

// Reset saved responses (for testing)
document.getElementById("resetBtn").addEventListener("click", () => {
  const ok = confirm("This will clear saved responses on this device. Continue?");
  if (!ok) return;

  ["p1_original","p1_revised","p2_original","branch_choice"].forEach(k => localStorage.removeItem(k));
  location.reload();
});

// Start
showStep("step1");
