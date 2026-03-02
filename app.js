const canvas = document.getElementById('pitch');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const clockEl = document.getElementById('clock');
const statusEl = document.getElementById('status');
const homeNameEl = document.getElementById('home-name');
const awayNameEl = document.getElementById('away-name');

const homeInput = document.getElementById('home-input');
const awayInput = document.getElementById('away-input');
const diffInput = document.getElementById('difficulty');
const startBtn = document.getElementById('start-btn');

const keys = new Set();

const field = {
  width: canvas.width,
  height: canvas.height,
  penaltyDepth: 110,
  centerRadius: 60,
};

const game = {
  home: 'HOME',
  away: 'AWAY',
  scoreHome: 0,
  scoreAway: 0,
  seconds: 0,
  duration: 180,
  running: false,
  paused: false,
  difficulty: 1,
  lastTime: 0,
};

const state = {
  players: [],
  ball: null,
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function makePlayer(team, role, x, y, controlled = false) {
  return {
    team,
    role,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: 12,
    speed: controlled ? 145 : 118,
    controlled,
    color: team === 'home' ? '#3b82f6' : '#ef4444',
    stamina: 100,
  };
}

function resetPositions(kickoffTo = 'home') {
  state.players = [
    makePlayer('home', 'striker', field.width * 0.35, field.height * 0.5, true),
    makePlayer('home', 'wing', field.width * 0.22, field.height * 0.25),
    makePlayer('home', 'wing', field.width * 0.22, field.height * 0.75),
    makePlayer('away', 'striker', field.width * 0.65, field.height * 0.5),
    makePlayer('away', 'wing', field.width * 0.78, field.height * 0.25),
    makePlayer('away', 'wing', field.width * 0.78, field.height * 0.75),
  ];

  state.ball = {
    x: field.width / 2 + (kickoffTo === 'home' ? -50 : 50),
    y: field.height / 2,
    vx: 0,
    vy: 0,
    radius: 8,
    owner: null,
  };
}

function kickBall(fromPlayer, power = 320) {
  const ball = state.ball;
  const goalX = fromPlayer.team === 'home' ? field.width : 0;
  const goalY = field.height / 2 + (Math.random() - 0.5) * 120;
  const angle = Math.atan2(goalY - fromPlayer.y, goalX - fromPlayer.x);
  ball.owner = null;
  ball.vx = Math.cos(angle) * power;
  ball.vy = Math.sin(angle) * power;
}

function updatePlayerControl(dt) {
  const p = state.players.find((pl) => pl.controlled);
  if (!p) return;

  let dx = 0;
  let dy = 0;
  if (keys.has('w') || keys.has('arrowup')) dy -= 1;
  if (keys.has('s') || keys.has('arrowdown')) dy += 1;
  if (keys.has('a') || keys.has('arrowleft')) dx -= 1;
  if (keys.has('d') || keys.has('arrowright')) dx += 1;

  const sprint = keys.has('shift') && p.stamina > 10;
  const speed = p.speed * (sprint ? 1.5 : 1);

  if (dx || dy) {
    const mag = Math.hypot(dx, dy) || 1;
    p.vx = (dx / mag) * speed;
    p.vy = (dy / mag) * speed;
    p.stamina = clamp(p.stamina - (sprint ? 26 : 10) * dt, 0, 100);
  } else {
    p.vx *= 0.86;
    p.vy *= 0.86;
    p.stamina = clamp(p.stamina + 13 * dt, 0, 100);
  }

  if (keys.has(' ') && dist(p, state.ball) < 26) {
    kickBall(p, sprint ? 430 : 330);
  }
}

function aiDecision(player, dt) {
  const b = state.ball;
  const isAway = player.team === 'away';
  const bias = isAway ? game.difficulty : 0.95;

  let targetX = b.x;
  let targetY = b.y;

  if (player.role === 'wing') {
    targetY = player.y < field.height / 2 ? field.height * 0.25 : field.height * 0.75;
    targetX = isAway ? field.width * 0.72 : field.width * 0.28;
    if (Math.random() < 0.02) {
      targetX = b.x;
      targetY = b.y;
    }
  }

  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  player.vx += Math.cos(angle) * player.speed * bias * dt * 2.2;
  player.vy += Math.sin(angle) * player.speed * bias * dt * 2.2;

  const vmax = player.speed * (isAway ? 1.05 : 1);
  const vm = Math.hypot(player.vx, player.vy);
  if (vm > vmax) {
    player.vx = (player.vx / vm) * vmax;
    player.vy = (player.vy / vm) * vmax;
  }

  if (dist(player, b) < 24) {
    if (player.team === 'away' && Math.random() < 0.06 * game.difficulty) {
      kickBall(player, 350 + 40 * game.difficulty);
    } else if (player.team === 'home' && !player.controlled && Math.random() < 0.04) {
      kickBall(player, 320);
    }
  }
}

function physics(dt) {
  for (const p of state.players) {
    if (!p.controlled) aiDecision(p, dt);

    p.x = clamp(p.x + p.vx * dt, 22, field.width - 22);
    p.y = clamp(p.y + p.vy * dt, 22, field.height - 22);
    p.vx *= 0.93;
    p.vy *= 0.93;

    if (dist(p, state.ball) < p.radius + state.ball.radius + 2 && !state.ball.owner) {
      state.ball.owner = p;
    }
  }

  const b = state.ball;
  if (b.owner) {
    const direction = b.owner.team === 'home' ? 1 : -1;
    b.x = b.owner.x + direction * 12;
    b.y = b.owner.y;
    b.vx = b.owner.vx;
    b.vy = b.owner.vy;
    if (Math.random() < 0.002) b.owner = null;
  } else {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vx *= 0.986;
    b.vy *= 0.986;

    if (b.y < b.radius || b.y > field.height - b.radius) {
      b.vy *= -0.9;
      b.y = clamp(b.y, b.radius, field.height - b.radius);
    }

    if (b.x < b.radius || b.x > field.width - b.radius) {
      b.vx *= -0.76;
      b.x = clamp(b.x, b.radius, field.width - b.radius);
    }
  }

  checkGoal();
}

function inGoalMouth(y) {
  return y > field.height * 0.35 && y < field.height * 0.65;
}

function checkGoal() {
  const b = state.ball;
  if (b.x < 18 && inGoalMouth(b.y)) {
    game.scoreAway += 1;
    statusEl.textContent = `${game.away} scored!`; 
    updateHud();
    resetPositions('home');
  } else if (b.x > field.width - 18 && inGoalMouth(b.y)) {
    game.scoreHome += 1;
    statusEl.textContent = `${game.home} scored!`;
    updateHud();
    resetPositions('away');
  }
}

function drawField() {
  ctx.fillStyle = '#16a34a';
  ctx.fillRect(0, 0, field.width, field.height);

  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)';
    ctx.fillRect((field.width / 8) * i, 0, field.width / 8, field.height);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, field.width - 16, field.height - 16);

  ctx.beginPath();
  ctx.moveTo(field.width / 2, 8);
  ctx.lineTo(field.width / 2, field.height - 8);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(field.width / 2, field.height / 2, field.centerRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeRect(8, field.height * 0.3, field.penaltyDepth, field.height * 0.4);
  ctx.strokeRect(field.width - field.penaltyDepth - 8, field.height * 0.3, field.penaltyDepth, field.height * 0.4);

  ctx.strokeRect(8, field.height * 0.4, 30, field.height * 0.2);
  ctx.strokeRect(field.width - 38, field.height * 0.4, 30, field.height * 0.2);
}

function drawPlayersAndBall() {
  for (const p of state.players) {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    if (p.controlled) {
      ctx.beginPath();
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 2;
      ctx.arc(p.x, p.y, p.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.beginPath();
  ctx.fillStyle = '#f8fafc';
  ctx.arc(state.ball.x, state.ball.y, state.ball.radius, 0, Math.PI * 2);
  ctx.fill();
}

function updateHud() {
  scoreEl.textContent = `${game.scoreHome} - ${game.scoreAway}`;
  const m = String(Math.floor(game.seconds / 60)).padStart(2, '0');
  const s = String(Math.floor(game.seconds % 60)).padStart(2, '0');
  clockEl.textContent = `${m}:${s}`;
  homeNameEl.textContent = game.home.toUpperCase();
  awayNameEl.textContent = game.away.toUpperCase();
}

function tick(ts) {
  if (!game.running) {
    requestAnimationFrame(tick);
    return;
  }

  const delta = Math.min((ts - game.lastTime) / 1000, 0.032);
  game.lastTime = ts;

  if (!game.paused) {
    game.seconds += delta;
    if (game.seconds >= game.duration) {
      game.running = false;
      const outcome = game.scoreHome === game.scoreAway ? 'Draw!' : game.scoreHome > game.scoreAway ? `${game.home} wins!` : `${game.away} wins!`;
      statusEl.textContent = `Full Time • ${outcome}`;
      startBtn.textContent = 'Play Again';
    } else {
      updatePlayerControl(delta);
      physics(delta);
      if (!statusEl.textContent.includes('scored')) {
        statusEl.textContent = game.paused ? 'Paused' : 'In Play';
      }
    }
  }

  drawField();
  drawPlayersAndBall();
  updateHud();
  requestAnimationFrame(tick);
}

function startGame() {
  game.home = homeInput.value.trim() || 'HOME';
  game.away = awayInput.value.trim() || 'AWAY';
  game.scoreHome = 0;
  game.scoreAway = 0;
  game.seconds = 0;
  game.running = true;
  game.paused = false;
  game.difficulty = Number(diffInput.value);
  game.lastTime = performance.now();
  statusEl.textContent = 'Kick Off';
  startBtn.textContent = 'Restart Match';
  resetPositions('home');
  updateHud();
}

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
    e.preventDefault();
  }

  if (key === 'p' && game.running) {
    game.paused = !game.paused;
    statusEl.textContent = game.paused ? 'Paused' : 'In Play';
  }

  keys.add(key);
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.key.toLowerCase());
});

startBtn.addEventListener('click', startGame);

resetPositions();
drawField();
drawPlayersAndBall();
updateHud();
requestAnimationFrame(tick);
