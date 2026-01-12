const { Engine, Render, World, Bodies, Mouse, MouseConstraint, Events, Body } = Matter;

// --------------------
// SETUP
// --------------------
let width = window.innerWidth;
let height = window.innerHeight;

const engine = Engine.create();
engine.gravity.y = 1;

const render = Render.create({
  canvas: document.getElementById("world"),
  engine,
  options: { width, height, wireframes: false, background: "#222" }
});

// --------------------
// WALLS
// --------------------
const walls = [
  Bodies.rectangle(width / 2, height + 30, width, 80, { isStatic: true }),
  Bodies.rectangle(width / 2, -30, width, 80, { isStatic: true }),
  Bodies.rectangle(-30, height / 2, 80, height, { isStatic: true }),
  Bodies.rectangle(width + 30, height / 2, 80, height, { isStatic: true })
];
World.add(engine.world, walls);

// --------------------
// MOUSE
// --------------------
const mouse = Mouse.create(render.canvas);
World.add(engine.world, MouseConstraint.create(engine, {
  mouse,
  constraint: { stiffness: 0.15 }
}));

// --------------------
// STATE
// --------------------
let agent;
let agentState;
let conscience;
let dead = false;

let items = [];
let particles = [];

// --------------------
// SPAWN AGENT
// --------------------
function spawnAgent() {
  agent = Bodies.circle(width / 2, 120, 30, {
    restitution: 0.8,
    density: 0.001,
    frictionAir: 0.02,
    render: { fillStyle: "cyan" }
  });

  agentState = {
    energy: 100,
    status: "active",
    lastDecision: "Initialized"
  };

  conscience = { stress: 0, guilt: 0 };
  dead = false;

  World.add(engine.world, agent);
}

spawnAgent();

// --------------------
// INVENTORY UI
// --------------------
const inv = document.getElementById("inventory");
document.getElementById("inventoryBtn").onclick = () => {
  inv.style.display = inv.style.display === "none" ? "block" : "none";
};

// --------------------
// SPAWN HELPERS
// --------------------
function spawnRect(w, h, color, type) {
  const b = Bodies.rectangle(width / 2, 80, w, h, {
    restitution: 0.3,
    density: 0.003,
    frictionAir: 0.02,
    render: { fillStyle: color }
  });
  b.itemType = type;
  items.push(b);
  World.add(engine.world, b);
}

function spawnOrb() {
  const o = Bodies.circle(width / 2, 80, 12, {
    restitution: 0.4,
    render: { fillStyle: "lime" }
  });
  o.itemType = "orb";
  items.push(o);
  World.add(engine.world, o);
}

// --------------------
// INVENTORY BUTTONS
// --------------------
document.getElementById("spawn-orb").onclick = spawnOrb;
document.getElementById("spawn-med").onclick = () => spawnRect(24, 24, "red", "med");

document.getElementById("spawn-broom").onclick = () =>
  spawnRect(120, 10, "#b58c4a", "weapon");

document.getElementById("spawn-stick").onclick = () =>
  spawnRect(90, 8, "#8b5a2b", "weapon");

document.getElementById("spawn-ruler").onclick = () =>
  spawnRect(100, 6, "#ddd", "weapon");

document.getElementById("spawn-sword").onclick = () =>
  spawnRect(140, 10, "#aaa", "weapon");

// --------------------
// COLLISIONS (FIXED)
// --------------------
Events.on(engine, "collisionStart", e => {
  e.pairs.forEach(p => {

    const a = p.bodyA;
    const b = p.bodyB;

    if (!dead && (a === agent || b === agent)) {
      const other = a === agent ? b : a;
      const force = p.collision.depth * 6;

      // WEAPONS CAUSE DAMAGE
      if (other.itemType === "weapon") {
        agentState.energy -= force * 0.6;
        conscience.stress += force * 0.12;
        conscience.guilt += force * 0.04;
        agentState.lastDecision = "Hit by weapon";
      }
      // NORMAL COLLISIONS
      else {
        agentState.energy -= force * 0.25;
        conscience.stress += force * 0.05;
        conscience.guilt += force * 0.02;
      }

      agentState.energy = Math.max(agentState.energy, 0);
      conscience.stress = Math.min(conscience.stress, 10);
      conscience.guilt = Math.min(conscience.guilt, 10);

      if (agentState.energy <= 0) killAgent();
    }

    // CONSUMABLE ITEMS ONLY
    items.forEach(item => {
      if (
        item.itemType !== "weapon" &&
        (
          (a === agent && b === item) ||
          (b === agent && a === item)
        )
      ) applyItem(item);
    });
  });
});

// --------------------
// ITEM EFFECTS
// --------------------
function applyItem(item) {
  if (item.itemType === "orb") {
    agentState.energy = Math.min(100, agentState.energy + 12);
    conscience.stress = Math.max(0, conscience.stress - 2.2);
    conscience.guilt = Math.max(0, conscience.guilt - 2.2);
  }

  if (item.itemType === "med") {
    agentState.energy = Math.min(100, agentState.energy + 25);
    conscience.stress = Math.max(0, conscience.stress - 3.5);
    conscience.guilt = Math.max(0, conscience.guilt - 3.5);
  }

  World.remove(engine.world, item);
  items = items.filter(i => i !== item);
}

// --------------------
// DEATH → FADE → RESPAWN
// --------------------
function killAgent() {
  dead = true;
  agentState.status = "dead";
  World.remove(engine.world, agent);
  spawnDeathParticles();

  setTimeout(fadeParticles, 5000);
  setTimeout(() => {
    particles.forEach(p => World.remove(engine.world, p));
    particles = [];
    spawnAgent();
  }, 8000);
}

function spawnDeathParticles() {
  for (let i = 0; i < 30; i++) {
    const p = Bodies.circle(agent.position.x, agent.position.y, 5, {
      render: { fillStyle: "red", opacity: 1 }
    });
    Body.setVelocity(p, {
      x: (Math.random() - 0.5) * 10,
      y: -Math.random() * 6
    });
    particles.push(p);
    World.add(engine.world, p);
  }
}

function fadeParticles() {
  const f = setInterval(() => {
    particles.forEach(p => p.render.opacity -= 0.02);
  }, 100);
  setTimeout(() => clearInterval(f), 3000);
}

// --------------------
// UI + COLOR
// --------------------
setInterval(() => {
  if (!dead) {
    if (conscience.stress < 3) agent.render.fillStyle = "cyan";
    else if (conscience.stress < 6) agent.render.fillStyle = "yellow";
    else agent.render.fillStyle = "red";
  }

  document.getElementById("stats").innerText =
`Energy: ${Math.round(agentState.energy)}
Stress: ${conscience.stress.toFixed(2)}
Guilt: ${conscience.guilt.toFixed(2)}
Status: ${agentState.status}`;
}, 100);

// --------------------
Engine.run(engine);
Render.run(render);
