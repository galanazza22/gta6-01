// The HUD: DOM overlays (wanted stars, money, health, objective, messages)
// plus a 2D canvas minimap drawn from the live world state.
export class HUD {
  constructor(document) {
    this.doc = document;
    this.el = {};
    for (const id of [
      'hud', 'objective', 'objective-text', 'wanted', 'money', 'health-fill',
      'health-text', 'speed', 'ammo', 'message', 'toast', 'crosshair',
      'mission-card', 'mission-title', 'mission-briefing', 'minimap',
      'title-screen', 'pause-screen', 'end-screen', 'end-title', 'end-text',
      'continue-btn', 'newgame-btn', 'resume-btn', 'restart-btn', 'quit-btn',
      'save-note', 'hint',
    ]) {
      this.el[id] = document.getElementById(id);
    }
    this.map = this.el.minimap.getContext('2d');
    this.messageTimer = null;
    this.toastTimer = null;
    this.mapTimer = 0;
  }

  setObjective(text) {
    this.el['objective-text'].textContent = text;
    this.el.objective.style.display = 'block';
  }

  hideObjective() {
    this.el.objective.style.display = 'none';
  }

  setMoney(amount) {
    this.el.money.textContent = `$${amount.toLocaleString('en-US')}`;
  }

  setWanted(stars) {
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      html += `<span class="star${i < stars ? ' on' : ''}">★</span>`;
    }
    this.el.wanted.innerHTML = html;
  }

  setHealth(health) {
    const pct = Math.max(0, Math.min(100, health));
    this.el['health-fill'].style.width = `${pct}%`;
    this.el['health-fill'].style.background = pct > 50 ? '#37c24a' : pct > 25 ? '#e8a13a' : '#d23b3b';
    this.el['health-text'].textContent = `${Math.ceil(pct)}`;
  }

  setSpeed(kmh, inCar) {
    this.el.speed.textContent = inCar ? `${Math.round(Math.abs(kmh))} km/h` : '';
  }

  setAmmo(ammo, reserve) {
    this.el.ammo.textContent = `${ammo} / ${reserve}`;
    this.el.ammo.style.display = 'block';
  }

  hideAmmo() {
    this.el.ammo.style.display = 'none';
  }

  setCrosshair(visible) {
    this.el.crosshair.style.display = visible ? 'block' : 'none';
  }

  showMessage(text, ms) {
    this.el.message.textContent = text;
    this.el.message.style.display = 'block';
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      this.el.message.style.display = 'none';
    }, ms || 2400);
  }

  showToast(text) {
    this.el.toast.textContent = text;
    this.el.toast.style.display = 'block';
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.el.toast.style.display = 'none';
    }, 3400);
  }

  showMissionCard(title, briefing) {
    this.el['mission-title'].textContent = title;
    this.el['mission-briefing'].textContent = briefing;
    this.el['mission-card'].style.display = 'block';
    setTimeout(() => {
      this.el['mission-card'].style.display = 'none';
    }, 5200);
  }

  showTitle(save) {
    this.el['title-screen'].style.display = 'flex';
    this.el['continue-btn'].style.display = save ? 'inline-block' : 'none';
    this.el['save-note'].textContent = save
      ? `Continue: mission ${Math.min(save.missionIndex + 1, 5)} of 5 · $${save.money.toLocaleString('en-US')}`
      : 'No save yet — a new story starts in Solmar City.';
  }

  hideTitle() {
    this.el['title-screen'].style.display = 'none';
  }

  showPause() {
    this.el['pause-screen'].style.display = 'flex';
  }

  hidePause() {
    this.el['pause-screen'].style.display = 'none';
  }

  showEnd(title, text) {
    this.el['end-title'].textContent = title;
    this.el['end-text'].textContent = text;
    this.el['end-screen'].style.display = 'flex';
  }

  hideEnd() {
    this.el['end-screen'].style.display = 'none';
  }

  showHud() {
    this.el.hud.style.display = 'block';
  }

  hideHud() {
    this.el.hud.style.display = 'none';
  }

  // Minimap: roads, blocks, player arrow, cars, police, mission marker.
  drawMinimap(game) {
    const ctx = this.map;
    const S = 180;
    const scale = S / 480;
    const toMap = (x, z) => [(x + 240) * scale, (z + 240) * scale];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(12, 20, 26, 0.82)';
    ctx.fillRect(0, 0, S, S);
    // Ocean strip on the east edge.
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect((215 + 240) * scale, 0, (480 - 455) * scale + 30, S);
    // Blocks.
    ctx.fillStyle = '#5d6657';
    for (let bx = -140; bx <= 140; bx += 40) {
      for (let bz = -140; bz <= 140; bz += 40) {
        const [mx, mz] = toMap(bx - 12.5, bz - 12.5);
        ctx.fillRect(mx, mz, 25 * scale, 25 * scale);
      }
    }
    // Roads.
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = 14 * scale;
    for (const c of [-160, -120, -80, -40, 0, 40, 80, 120, 160]) {
      const [x1, y1] = toMap(-200, c);
      const [x2, y2] = toMap(200, c);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = toMap(c, -200);
      const [x4, y4] = toMap(c, 200);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }
    // Mission marker: pulsing yellow diamond.
    if (game.missions.targetPos) {
      const [mx, mz] = toMap(game.missions.targetPos.x, game.missions.targetPos.z);
      const pulse = 4 + Math.sin(performance.now() / 200) * 1.5;
      ctx.fillStyle = '#ffd23a';
      ctx.beginPath();
      ctx.moveTo(mx, mz - pulse);
      ctx.lineTo(mx + pulse, mz);
      ctx.lineTo(mx, mz + pulse);
      ctx.lineTo(mx - pulse, mz);
      ctx.closePath();
      ctx.fill();
    }
    // Traffic: small yellow dots.
    ctx.fillStyle = '#e8b93a';
    for (const car of game.vehicles.traffic) {
      const [mx, mz] = toMap(car.pos.x, car.pos.z);
      ctx.fillRect(mx - 1, mz - 1, 2.5, 2.5);
    }
    // Police: flashing blue dots.
    const flash = Math.floor(performance.now() / 250) % 2 === 0;
    ctx.fillStyle = flash ? '#4488ff' : '#ff4444';
    for (const car of game.vehicles.policeCars) {
      const [mx, mz] = toMap(car.pos.x, car.pos.z);
      ctx.beginPath();
      ctx.arc(mx, mz, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Enemies: red dots.
    ctx.fillStyle = '#ff4444';
    for (const enemy of game.combat.enemies) {
      if (enemy.dead) continue;
      const [mx, mz] = toMap(enemy.pos.x, enemy.pos.z);
      ctx.beginPath();
      ctx.arc(mx, mz, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player: white arrow pointing along the heading.
    const [px, pz] = toMap(game.player.pos.x, game.player.pos.z);
    const heading = game.player.car ? game.player.car.heading : game.player.heading;
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(0, 2.5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, S - 2, S - 2);
  }

  updateMinimap(game, dt) {
    this.mapTimer += dt;
    if (this.mapTimer > 0.12) {
      this.mapTimer = 0;
      this.drawMinimap(game);
    }
  }
}
