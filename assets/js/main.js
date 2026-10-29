const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Hero story, on a loop: cloud server feeds devices over Wi-Fi -> connection drops and
// devices lose their intelligence -> the model is compressed -> a small copy is ported
// onto each device -> devices work again with no Wi-Fi.
const PHASES = [
  { id: "online", ms: 4200, step: "01 //", label: "CLOUD-DEPENDENT AI" },
  { id: "lost", ms: 2600, step: "02 //", label: "CONNECTION LOST" },
  { id: "compress", ms: 2200, step: "03 //", label: "COMPRESSING THE MODEL" },
  { id: "port", ms: 2400, step: "04 //", label: "PORTING TO DEVICES" },
  { id: "edge", ms: 4600, step: "05 //", label: "ON-DEVICE INTELLIGENCE" },
];
const MINI_FLIGHT_MS = 1100;
const MINI_STAGGER_MS = 260;

function initStage() {
  const stage = document.getElementById("stage");
  if (!stage) return;
  const stepEl = document.getElementById("stage-step");
  const labelEl = document.getElementById("stage-label");
  const devices = [...stage.querySelectorAll(".device")];
  const minis = [...stage.querySelectorAll(".mini")];
  let timers = [];

  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const setDevice = (el, state) => {
    el.classList.remove("is-cloud", "is-offline", "is-edge");
    el.classList.add(state);
  };
  // Park the small models back on the server, invisibly and without animating.
  const parkMinis = () =>
    minis.forEach((m) => {
      m.classList.add("is-instant");
      m.style.opacity = 0;
      m.style.setProperty("--px", 50);
      m.style.setProperty("--py", 19);
      void m.offsetWidth;
      m.classList.remove("is-instant");
    });
  const landMini = (m) => {
    m.style.opacity = 1;
    m.style.setProperty("--px", +getComputedStyle(m).getPropertyValue("--tx") + 4.5);
    m.style.setProperty("--py", 66);
  };

  function enter(phase) {
    stage.dataset.phase = phase.id;
    stepEl.textContent = phase.step;
    labelEl.textContent = phase.label;
    if (phase.id === "online") {
      parkMinis();
      devices.forEach((d) => setDevice(d, "is-cloud"));
    } else if (phase.id === "lost") {
      devices.forEach((d, i) => later(() => setDevice(d, "is-offline"), 300 + i * 140));
    } else if (phase.id === "port") {
      minis.forEach((m, i) => {
        later(() => landMini(m), i * MINI_STAGGER_MS);
        later(() => setDevice(devices[i], "is-edge"), i * MINI_STAGGER_MS + MINI_FLIGHT_MS);
      });
    }
  }

  if (reduceMotion) {
    // Show the end state: every device running its own model.
    stage.dataset.phase = "edge";
    stepEl.textContent = PHASES[4].step;
    labelEl.textContent = PHASES[4].label;
    devices.forEach((d) => setDevice(d, "is-edge"));
    minis.forEach(landMini);
    return;
  }

  let index = 0;
  function run() {
    enter(PHASES[index]);
    later(() => {
      index = (index + 1) % PHASES.length;
      run();
    }, PHASES[index].ms);
  }
  run();

  // Restart from the beginning whenever the tab becomes visible again.
  document.addEventListener("visibilitychange", () => {
    timers.forEach(clearTimeout);
    timers = [];
    if (!document.hidden) {
      index = 0;
      run();
    }
  });
}

function initThemeSwitch() {
  const buttons = document.querySelectorAll("[data-theme-choice]");
  const apply = (theme) => {
    document.documentElement.dataset.theme = theme;
    buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeChoice === theme)));
    try { localStorage.setItem("theme", theme); } catch (e) {}
  };
  buttons.forEach((b) => b.addEventListener("click", () => apply(b.dataset.themeChoice)));
  apply(document.documentElement.dataset.theme || "cyan");
}

function initEdgeMap() {
  const mount = document.getElementById("edge-diagram");
  if (!mount || !window.LoopDiagram) return;
  LoopDiagram.create(mount, {
    title: "A server-scale model deployed to a quadruped, ground robot, UAV, laptop and phone",
    hub: { label: "Frontier model", sublabel: "Server-scale", x: 0, y: 0, w: 200, h: 70 },
    nodes: [
      { id: "quad", label: "Quadruped", x: 520, y: 120 },
      { id: "ugv", label: "Ground robot", x: 420, y: 250 },
      { id: "uav", label: "UAV", x: 300, y: 160 },
      { id: "laptop", label: "Laptop", x: 220, y: 330 },
      { id: "phone", label: "Phone", x: 140, y: 210 },
    ],
    travelMs: 1000,
    holdMs: 650,
  });
}

function initReveal() {
  const items = document.querySelectorAll("[data-reveal]");
  if (reduceMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10% 0px" }
  );
  items.forEach((el) => io.observe(el));
}

// Cards glow toward the cursor.
function initCardGlow() {
  document.querySelectorAll(".card").forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${e.clientX - rect.left}px`);
      card.style.setProperty("--my", `${e.clientY - rect.top}px`);
    });
  });
}

initStage();
initThemeSwitch();
initEdgeMap();
initReveal();
initCardGlow();
