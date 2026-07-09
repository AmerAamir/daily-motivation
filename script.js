(() => {
  "use strict";

  const playfield = document.getElementById("playfield");
  const chaosFill = document.getElementById("chaosFill");
  const chaosText = document.getElementById("chaosText");
  const countText = document.getElementById("countText");
  const highText = document.getElementById("highText");
  const panicButton = document.getElementById("panic");
  const resetButton = document.getElementById("reset");
  const summonTenButton = document.getElementById("summonTen");
  const eventToast = document.getElementById("eventToast");
  const mayorBanner = document.getElementById("mayorBanner");
  const cursorAura = document.getElementById("cursorAura");
  const seedPill = document.getElementById("seedPill");

  const params = new URLSearchParams(window.location.search);
  const seed = params.get("seed") || createSeed();
  const rng = mulberry32(hashString(seed));
  const gremlins = [];

  const names = [
    "Crumblo", "Snarf", "Mochi", "Blip", "Kevin II", "Gorb", "Pickle", "Womp",
    "Dingus", "Noodle", "Mittens", "Professor Bite", "Lint", "Grubbo", "Zaz", "Beefy"
  ];
  const personalities = [
    "deeply unemployed", "emotionally crunchy", "forbidden intern", "tiny landlord",
    "aggressively polite", "tax-season goblin", "spicy optimist", "meeting enjoyer",
    "feral consultant", "cosmic toddler", "certified nuisance", "haunted accountant"
  ];
  const badHabits = [
    "licks pixels", "eats buttons", "steals focus", "prints invoices", "hoards crumbs",
    "renames files", "sends calendar invites", "chews gradients", "whispers CSS", "claps off-beat"
  ];
  const behaviors = ["chase", "avoid", "bounce", "duplicate", "eat"];
  const colors = ["#b8ff3d", "#38dcff", "#ff3d8b", "#ffb000", "#b18cff", "#7cffc4", "#ff7b54", "#f7ff5c"];
  const eventNames = [
    "Gravity flipped. HR is investigating.",
    "Everyone got huge. Nobody signed the waiver.",
    "A mayor has been elected by suspicious crumbs.",
    "Disco mode. Compliance hates this.",
    "Corporate mode. Tiny ties. Large consequences.",
    "Cursor cursed. Good luck, captain.",
    "Buttons are running away from responsibility."
  ];

  const cursor = { x: innerWidth / 2, y: innerHeight / 2, active: false };
  const world = {
    width: innerWidth,
    height: innerHeight,
    gravity: 0.018,
    frozenUntil: 0,
    nextEventAt: performance.now() + randomRange(10000, 16000),
    chaosHigh: Number(localStorage.getItem("cursorGremlinsHighChaos") || 0),
    runawayUntil: 0,
    mayorId: null
  };

  seedPill.textContent = `Seed: ${seed}`;
  updateHUD();

  window.addEventListener("resize", () => {
    world.width = innerWidth;
    world.height = innerHeight;
  });

  window.addEventListener("pointermove", (event) => {
    cursor.x = event.clientX;
    cursor.y = event.clientY;
    cursor.active = true;
    cursorAura.style.transform = `translate(${cursor.x - cursorAura.offsetWidth / 2}px, ${cursor.y - cursorAura.offsetHeight / 2}px)`;
    repelRunawayButtons();
  }, { passive: true });

  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".gremlin")) return;
    spawnGremlin(event.clientX, event.clientY);
  });

  summonTenButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const centerX = world.width / 2;
    const centerY = Math.min(world.height * 0.62, 520);
    for (let i = 0; i < 10; i += 1) {
      spawnGremlin(centerX + randomRange(-140, 140), centerY + randomRange(-90, 90));
    }
    toast("Ten gremlins have entered the group chat.");
  });

  panicButton.addEventListener("click", (event) => {
    event.stopPropagation();
    world.frozenUntil = performance.now() + 850;
    gremlins.forEach((gremlin) => {
      const angle = randomRange(0, Math.PI * 2);
      const force = randomRange(7, 15);
      gremlin.vx = Math.cos(angle) * force;
      gremlin.vy = Math.sin(angle) * force;
      gremlin.element.classList.remove("nibbling");
    });
    toast("PANIC! All gremlins briefly forgot their passwords.");
  });

  resetButton.addEventListener("click", (event) => {
    event.stopPropagation();
    gremlins.splice(0).forEach((gremlin) => gremlin.element.remove());
    clearModes();
    world.mayorId = null;
    mayorBanner.classList.remove("show");
    updateHUD();
    toast("Reset complete. The crumbs deny everything.");
  });

  function spawnGremlin(x = randomRange(40, world.width - 80), y = randomRange(80, world.height - 120), parent) {
    if (gremlins.length >= 180) {
      toast("The gremlin union says 180 is plenty.");
      return;
    }

    const behavior = parent && parent.behavior === "duplicate" && rng() > 0.35
      ? randomChoice(behaviors.filter((item) => item !== "duplicate"))
      : randomChoice(behaviors);

    const gremlin = {
      id: cryptoRandomId(),
      name: randomChoice(names),
      personality: randomChoice(personalities),
      habit: randomChoice(badHabits),
      behavior,
      color: randomChoice(colors),
      x: clamp(x, 10, world.width - 70),
      y: clamp(y, 10, world.height - 70),
      vx: randomRange(-3.2, 3.2),
      vy: randomRange(-3.2, 3.2),
      rotation: randomRange(-12, 12),
      spin: randomRange(-1.6, 1.6),
      size: randomRange(0.86, 1.2),
      nextNibbleAt: performance.now() + randomRange(1200, 5200),
      element: document.createElement("div")
    };

    gremlin.element.className = "gremlin";
    gremlin.element.style.setProperty("--grem-color", gremlin.color);
    gremlin.element.style.scale = gremlin.size;
    gremlin.element.title = `${gremlin.name}: ${gremlin.personality}. Bad habit: ${gremlin.habit}. Behavior: ${gremlin.behavior}.`;
    gremlin.element.innerHTML = `
      <span class="face"><span class="eye"></span><span class="eye"></span></span>
      <span class="mouth"></span>
      <span class="label">${escapeHtml(gremlin.name)} · ${escapeHtml(gremlin.behavior)}</span>
    `;

    gremlin.element.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      duplicateGremlin(gremlin);
    });

    playfield.appendChild(gremlin.element);
    gremlins.push(gremlin);
    updateHUD();
    return gremlin;
  }

  function duplicateGremlin(gremlin) {
    if (gremlin.behavior === "duplicate" || rng() > 0.45) {
      spawnGremlin(gremlin.x + randomRange(-28, 28), gremlin.y + randomRange(-28, 28), gremlin);
      toast(`${gremlin.name} committed mitosis without approval.`);
    } else {
      gremlin.vx += randomRange(-6, 6);
      gremlin.vy += randomRange(-8, -2);
      toast(`${gremlin.name} squeaked and rejected the duplicate request.`);
    }
  }

  function tick(now) {
    const frozen = now < world.frozenUntil;

    for (let i = 0; i < gremlins.length; i += 1) {
      const gremlin = gremlins[i];
      if (!frozen) updateGremlin(gremlin, now);
      renderGremlin(gremlin);
    }

    if (now > world.nextEventAt && gremlins.length > 0) {
      triggerRandomEvent();
      world.nextEventAt = now + randomRange(14000, 24000);
    }

    requestAnimationFrame(tick);
  }

  function updateGremlin(gremlin, now) {
    const dx = cursor.x - (gremlin.x + 29);
    const dy = cursor.y - (gremlin.y + 26);
    const distance = Math.max(18, Math.hypot(dx, dy));
    const nx = dx / distance;
    const ny = dy / distance;
    const cursorPull = document.body.classList.contains("cursed") ? 1.6 : 1;

    if (gremlin.behavior === "chase") {
      gremlin.vx += nx * 0.13 * cursorPull;
      gremlin.vy += ny * 0.13 * cursorPull;
    } else if (gremlin.behavior === "avoid" && distance < 220) {
      gremlin.vx -= nx * 0.25 * cursorPull;
      gremlin.vy -= ny * 0.25 * cursorPull;
    } else if (gremlin.behavior === "bounce") {
      gremlin.vx += randomRange(-0.08, 0.08);
      gremlin.vy += randomRange(-0.08, 0.08);
    } else if (gremlin.behavior === "eat") {
      moveTowardNearestMorsel(gremlin);
      if (now > gremlin.nextNibbleAt) {
        nibbleUI(gremlin);
        gremlin.nextNibbleAt = now + randomRange(2600, 6800);
      }
    } else if (gremlin.behavior === "duplicate") {
      gremlin.vx += Math.sin(now / 430 + gremlin.id.length) * 0.045;
      gremlin.vy += Math.cos(now / 510 + gremlin.id.length) * 0.045;
    }

    gremlin.vy += world.gravity;
    gremlin.vx *= 0.992;
    gremlin.vy *= 0.992;

    const maxSpeed = 7.5;
    const speed = Math.hypot(gremlin.vx, gremlin.vy);
    if (speed > maxSpeed) {
      gremlin.vx = (gremlin.vx / speed) * maxSpeed;
      gremlin.vy = (gremlin.vy / speed) * maxSpeed;
    }

    gremlin.x += gremlin.vx;
    gremlin.y += gremlin.vy;
    gremlin.rotation += gremlin.spin;

    bounceOffWalls(gremlin);
  }

  function moveTowardNearestMorsel(gremlin) {
    const morsels = Array.from(document.querySelectorAll(".ui-morsel:not(.eaten)"));
    if (!morsels.length) return;

    let nearest = null;
    let nearestDistance = Infinity;
    for (const morsel of morsels) {
      const rect = morsel.getBoundingClientRect();
      const mx = rect.left + rect.width / 2;
      const my = rect.top + rect.height / 2;
      const dist = Math.hypot(mx - gremlin.x, my - gremlin.y);
      if (dist < nearestDistance) {
        nearest = { x: mx, y: my };
        nearestDistance = dist;
      }
    }

    if (nearest) {
      gremlin.vx += ((nearest.x - gremlin.x) / Math.max(80, nearestDistance)) * 0.08;
      gremlin.vy += ((nearest.y - gremlin.y) / Math.max(80, nearestDistance)) * 0.08;
    }
  }

  function nibbleUI(gremlin) {
    const morsels = Array.from(document.querySelectorAll(".ui-morsel:not(.eaten)"));
    if (!morsels.length) return;
    const target = randomChoice(morsels);
    target.classList.add("eaten");
    gremlin.element.classList.add("nibbling");
    makeCrumbs(target.getBoundingClientRect());
    setTimeout(() => {
      target.classList.remove("eaten");
      gremlin.element.classList.remove("nibbling");
    }, randomRange(1400, 2600));
  }

  function makeCrumbs(rect) {
    for (let i = 0; i < 7; i += 1) {
      const crumb = document.createElement("span");
      crumb.className = "crumb";
      crumb.textContent = randomChoice(["✦", "•", "*", "crumb", "✹"]);
      crumb.style.left = `${randomRange(rect.left, rect.right)}px`;
      crumb.style.top = `${randomRange(rect.top, rect.bottom)}px`;
      document.body.appendChild(crumb);
      setTimeout(() => crumb.remove(), 1200);
    }
  }

  function bounceOffWalls(gremlin) {
    const right = world.width - 58;
    const bottom = world.height - 58;
    if (gremlin.x < 0) {
      gremlin.x = 0;
      gremlin.vx = Math.abs(gremlin.vx) * 0.92;
    } else if (gremlin.x > right) {
      gremlin.x = right;
      gremlin.vx = -Math.abs(gremlin.vx) * 0.92;
    }

    if (gremlin.y < 0) {
      gremlin.y = 0;
      gremlin.vy = Math.abs(gremlin.vy) * 0.92;
    } else if (gremlin.y > bottom) {
      gremlin.y = bottom;
      gremlin.vy = -Math.abs(gremlin.vy) * 0.88;
      gremlin.vx += randomRange(-0.45, 0.45);
    }
  }

  function renderGremlin(gremlin) {
    gremlin.element.style.setProperty("--x", `${gremlin.x}px`);
    gremlin.element.style.setProperty("--y", `${gremlin.y}px`);
    gremlin.element.style.setProperty("--r", `${gremlin.rotation}deg`);
  }

  function triggerRandomEvent() {
    const eventIndex = Math.floor(randomRange(0, eventNames.length));
    toast(eventNames[eventIndex]);

    if (eventIndex === 0) {
      temporaryClass("gravity-flip", 5200);
      world.gravity *= -1;
      setTimeout(() => { world.gravity *= -1; }, 5200);
    } else if (eventIndex === 1) {
      temporaryClass("huge-mode", 5600);
    } else if (eventIndex === 2) {
      electMayor();
    } else if (eventIndex === 3) {
      temporaryClass("disco", 7000);
    } else if (eventIndex === 4) {
      temporaryClass("corporate", 7200);
    } else if (eventIndex === 5) {
      temporaryClass("cursed", 6600);
      gremlins.forEach((gremlin) => {
        gremlin.vx += randomRange(-5, 5);
        gremlin.vy += randomRange(-5, 5);
      });
    } else {
      world.runawayUntil = performance.now() + 8200;
      document.querySelectorAll(".runaway").forEach((button) => button.classList.add("running"));
      setTimeout(() => {
        world.runawayUntil = 0;
        document.querySelectorAll(".runaway").forEach((button) => {
          button.classList.remove("running");
          button.style.transform = "";
        });
      }, 8200);
    }
  }

  function electMayor() {
    gremlins.forEach((gremlin) => gremlin.element.classList.remove("mayor"));
    const mayor = randomChoice(gremlins);
    if (!mayor) return;
    mayor.element.classList.add("mayor");
    world.mayorId = mayor.id;
    mayorBanner.textContent = `Mayor ${mayor.name} promises fewer crumbs and more chaos.`;
    mayorBanner.classList.add("show");
    setTimeout(() => mayorBanner.classList.remove("show"), 5200);
  }

  function repelRunawayButtons() {
    if (performance.now() > world.runawayUntil) return;
    document.querySelectorAll(".runaway").forEach((button) => {
      const rect = button.getBoundingClientRect();
      const bx = rect.left + rect.width / 2;
      const by = rect.top + rect.height / 2;
      const dx = bx - cursor.x;
      const dy = by - cursor.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      if (distance < 180) {
        const shove = (180 - distance) * 0.42;
        button.style.transform = `translate(${(dx / distance) * shove}px, ${(dy / distance) * shove}px) rotate(${shove / 9}deg)`;
      }
    });
  }

  function updateHUD() {
    const chaos = Math.min(100, Math.round((gremlins.length / 100) * 100));
    world.chaosHigh = Math.max(world.chaosHigh, chaos);
    localStorage.setItem("cursorGremlinsHighChaos", String(world.chaosHigh));
    chaosFill.style.width = `${chaos}%`;
    chaosText.textContent = `${chaos}%`;
    countText.textContent = `${gremlins.length} ${gremlins.length === 1 ? "gremlin" : "gremlins"} loose`;
    highText.textContent = `High chaos: ${world.chaosHigh}%`;
  }

  function toast(message) {
    eventToast.textContent = message;
    eventToast.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => eventToast.classList.remove("show"), 2600);
  }

  function temporaryClass(className, duration) {
    document.body.classList.add(className);
    setTimeout(() => document.body.classList.remove(className), duration);
  }

  function clearModes() {
    ["gravity-flip", "huge-mode", "disco", "corporate", "cursed"].forEach((className) => {
      document.body.classList.remove(className);
    });
    world.gravity = Math.abs(world.gravity);
    world.runawayUntil = 0;
  }

  function randomChoice(list) {
    return list[Math.floor(rng() * list.length)];
  }

  function randomRange(min, max) {
    return min + rng() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hashString(input) {
    let hash = 2166136261;
    for (let i = 0; i < input.length; i += 1) {
      hash ^= input.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seedValue) {
    return function random() {
      let t = seedValue += 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createSeed() {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return `gremlin-${array[0].toString(36)}`;
  }

  function cryptoRandomId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    }[char]));
  }

  toast("Click anywhere. The gremlins are legally your problem now.");
  requestAnimationFrame(tick);
})();
