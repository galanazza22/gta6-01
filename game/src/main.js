// SOLMAR HEAT — an open-world crime game in the spirit of GTA 6.
// Deke owes club owner Marcus Vale $2,000. Fixer Lena Cruz feeds him five
// jobs across Solmar City. Steal cars, outrun the cops, clear the debt.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Vehicles } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { loadSave, writeSave, defaultSave } from './save.js';
import { stageShot } from './shots.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.save = loadSave() || defaultSave();
    this.money = this.save.money;
    this.health = 100;
    this.wanted = 0;
    this.state = 'title';
    this.frozen = false;
    this.shotMode = false;
    this.inputOverride = null;
    this.timeOfDay = 'day';
    this.lastTime = 0;
    this.titleAngle = 0;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d9);
    this.scene.fog = new THREE.Fog(0x9fc3dd, 220, 520);
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);

    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.85);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -110;
    this.sun.shadow.camera.right = 110;
    this.sun.shadow.camera.top = 110;
    this.sun.shadow.camera.bottom = -110;
    this.sun.shadow.camera.near = 10;
    this.sun.shadow.camera.far = 600;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    const params = new URLSearchParams(window.location.search);
    const seed = Number(params.get('seed') || 7);
    this.seed = seed;
    this.world = buildWorld(this.scene, seed);
    this.input = new Input(canvas);
    this.audio = new AudioEngine();
    this.hud = new HUD(document);
    this.player = new Player(this.scene, this.world.spawn);
    this.vehicles = new Vehicles(this.scene, this.world, seed);
    this.peds = new Pedestrians(this.scene, this.world, seed);
    this.police = new Police(this.scene, this.world, this.vehicles, this);
    this.combat = new Combat(this.scene, this);
    this.missions = new Missions(this.scene, this.world, this);

    this.input.onKey = (code) => this.handleKey(code);
    this.input.onClick = () => this.handleClick();
    this.wireButtons();
    window.addEventListener('resize', () => this.resize());

    this.hud.setMoney(this.money);
    this.hud.setHealth(this.health);
    this.hud.setWanted(0);
    this.hud.hideHud();

    if (params.has('shot')) {
      this.shotMode = true;
      stageShot(this, params.get('shot'), seed);
    } else {
      this.state = 'title';
      this.hud.showTitle(this.save);
    }
    window.__game = this;
    window.__ready = true;
  }

  wireButtons() {
    const byId = (id) => document.getElementById(id);
    byId('newgame-btn').addEventListener('click', () => {
      this.resetSave();
      this.startGame();
    });
    byId('continue-btn').addEventListener('click', () => this.startGame());
    byId('resume-btn').addEventListener('click', () => this.togglePause());
    byId('restart-btn').addEventListener('click', () => {
      this.hud.hidePause();
      this.respawn(true);
    });
    byId('quit-btn').addEventListener('click', () => {
      this.persistSave();
      this.state = 'title';
      this.hud.hidePause();
      this.hud.hideHud();
      this.hud.showTitle(this.save);
      this.input.unlock();
    });
    byId('end-respawn-btn').addEventListener('click', () => {
      if (this.state === 'complete') {
        this.hud.hideEnd();
        this.state = 'playing';
        this.missions.active = false;
        this.hud.setObjective('Free roam — Solmar City is yours');
        this.input.lock();
      } else {
        this.respawn(false);
      }
    });
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  resetSave() {
    this.save = defaultSave();
    this.money = 0;
    this.health = 100;
    this.wanted = 0;
    this.player.pos.copy(this.world.spawn);
    this.player.heading = Math.PI;
    this.player.camYaw = Math.PI;
    this.player.ammo = 12;
    this.player.reserveAmmo = 96;
    if (this.player.car) this.exitCar();
    this.police.clearAll();
    this.combat.clearEnemies();
    this.missions.clearBeacon();
    this.persistSave();
  }

  persistSave() {
    this.save.money = this.money;
    this.save.missionIndex = this.missions.index;
    this.save.bestWanted = Math.max(this.save.bestWanted || 0, this.wanted);
    writeSave(this.save);
  }

  startGame() {
    this.audio.init();
    this.input.lock();
    this.beginPlay();
    this.health = 100;
    this.setWanted(0);
    this.hud.setHealth(this.health);
    this.missions.start(this.save.missionIndex);
  }

  beginPlay() {
    this.state = 'playing';
    this.hud.hideTitle();
    this.hud.hidePause();
    this.hud.hideEnd();
    this.hud.showHud();
  }

  setTimeOfDay(mode) {
    this.timeOfDay = mode;
    if (mode === 'sunset') {
      this.scene.background.set(0xdd7a4a);
      this.scene.fog.color.set(0xe08a55);
      this.scene.fog.near = 180;
      this.scene.fog.far = 480;
      this.sun.color.set(0xff9a5c);
      this.sun.intensity = 1.9;
      this.hemi.color.set(0xffb27a);
      this.hemi.groundColor.set(0x6a5a4a);
      this.hemi.intensity = 0.6;
    } else {
      this.scene.background.set(0x87b5d9);
      this.scene.fog.color.set(0x9fc3dd);
      this.scene.fog.near = 220;
      this.scene.fog.far = 520;
      this.sun.color.set(0xfff2d8);
      this.sun.intensity = 2.4;
      this.hemi.color.set(0xbfd9ff);
      this.hemi.groundColor.set(0x8a7a5a);
      this.hemi.intensity = 0.85;
    }
  }

  handleKey(code) {
    if (code === 'KeyM') {
      this.audio.setMuted(!this.audio.muted);
      this.toast(this.audio.muted ? 'Sound off.' : 'Sound on.');
      return;
    }
    if (this.state !== 'playing') return;
    if (code === 'KeyE') this.toggleCar();
    else if (code === 'KeyR') this.reload();
    else if (code === 'KeyP') this.togglePause();
  }

  handleClick() {
    if (this.state !== 'playing' || this.frozen) return;
    if (this.player.onFoot && this.player.armed) {
      this.combat.shoot(this.camera, this.player.pos);
    }
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.hud.showPause();
      this.input.unlock();
      this.persistSave();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.hud.hidePause();
      this.input.lock();
    }
  }

  reload() {
    const player = this.player;
    if (!player.onFoot || player.ammo >= 12 || player.reserveAmmo <= 0) return;
    const need = 12 - player.ammo;
    const take = Math.min(need, player.reserveAmmo);
    player.ammo += take;
    player.reserveAmmo -= take;
    this.audio.blip(520, 0.08, 'square', 0.1);
    this.toast('Reloaded.');
  }

  toggleCar() {
    if (this.player.car) {
      this.exitCar();
      return;
    }
    const car = this.vehicles.nearestCar(this.player.pos, 4.5, null);
    if (car) this.enterCar(car, {});
  }

  enterCar(car, options) {
    const silent = options && options.silent;
    this.player.car = car;
    this.player.onFoot = false;
    this.player.setVisible(false);
    if (car.kind === 'traffic') {
      this.vehicles.traffic = this.vehicles.traffic.filter((c) => c !== car);
    } else if (car.kind === 'parked') {
      this.vehicles.parked = this.vehicles.parked.filter((c) => c !== car);
    } else if (car.kind === 'police') {
      this.vehicles.policeCars = this.vehicles.policeCars.filter((c) => c !== car);
    }
    if (!silent) {
      if (car.kind === 'police') {
        this.addWanted(2, 'stole a police car');
        this.toast('You stole a police car!');
      } else {
        this.addWanted(1, 'stole a car');
        this.save.carsStolen += 1;
        this.toast('Car stolen — the cops are on to you.');
      }
      this.audio.pickup();
    }
    this.hud.setCrosshair(false);
    this.hud.hideAmmo();
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.speed = 0;
    const side = { x: Math.cos(car.heading), z: -Math.sin(car.heading) };
    this.player.pos.set(car.pos.x + side.x * 2.6, 0, car.pos.z + side.z * 2.6);
    this.world.collideCircle(this.player.pos, 0.6);
    this.player.car = null;
    this.player.onFoot = true;
    this.player.setVisible(true);
    this.player.camYaw = car.heading + Math.PI;
    this.hud.setCrosshair(true);
  }

  addWanted(level, reason) {
    void reason;
    if (level > this.wanted) this.setWanted(level);
  }

  setWanted(level) {
    this.wanted = Math.max(0, Math.min(5, level));
    this.hud.setWanted(this.wanted);
    this.audio.setSiren(this.wanted > 0);
    if (this.wanted > (this.save.bestWanted || 0)) this.save.bestWanted = this.wanted;
  }

  damagePlayer(amount, cause) {
    void cause;
    if (this.state !== 'playing') return;
    this.health -= amount;
    this.hud.setHealth(this.health);
    if (this.health <= 0) {
      this.health = 0;
      this.wasted();
    }
  }

  respawn(restartMission) {
    if (this.player.car) this.exitCar();
    this.player.pos.copy(this.world.locations.hospital);
    this.player.heading = Math.PI;
    this.player.camYaw = Math.PI;
    this.health = 100;
    this.hud.setHealth(this.health);
    this.setWanted(0);
    this.police.clearAll();
    this.combat.clearEnemies();
    this.hud.hideEnd();
    this.state = 'playing';
    this.hud.showHud();
    this.input.lock();
    if (restartMission) this.missions.start(this.missions.index);
    else if (this.missions.current && !this.missions.active) this.missions.start(this.missions.index);
  }

  wasted() {
    this.state = 'wasted';
    this.audio.busted();
    this.input.unlock();
    this.setWanted(0);
    this.police.clearAll();
    this.money = Math.max(0, this.money - 200);
    this.hud.setMoney(this.money);
    this.persistSave();
    const btn = document.getElementById('end-respawn-btn');
    btn.textContent = 'Respawn at the hospital';
    this.hud.showEnd('WASTED', 'You woke up at General Hospital. -$200. The story continues — Vale still wants his money.');
  }

  busted() {
    this.state = 'busted';
    this.audio.busted();
    this.input.unlock();
    this.setWanted(0);
    this.police.clearAll();
    this.money = Math.max(0, this.money - 200);
    this.hud.setMoney(this.money);
    this.persistSave();
    const btn = document.getElementById('end-respawn-btn');
    btn.textContent = 'Respawn at the hospital';
    this.hud.showEnd('BUSTED', 'The cops hauled you in. -$200 bail. Lena is already working on the next job.');
  }

  storyComplete() {
    this.state = 'complete';
    this.audio.missionDone();
    this.input.unlock();
    const btn = document.getElementById('end-respawn-btn');
    btn.textContent = 'Keep playing — free roam';
    this.hud.showEnd(
      'DEBT PAID',
      `Marcus Vale is paid off. $${this.money.toLocaleString('en-US')} in your pocket, and Solmar City is yours. Free roam unlocked.`,
    );
  }

  showMissionCard(title, briefing) {
    this.hud.showMissionCard(title, briefing);
  }

  showCenterMessage(text, ms) {
    this.hud.showMessage(text, ms);
  }

  toast(text) {
    this.hud.showToast(text);
  }

  // One fixed simulation step. The render loop calls this every frame, and
  // the screenshot stager calls it directly to play the game forward.
  step(dt) {
    const input = this.inputOverride || this.input;
    const player = this.player;
    const playerPos = player.onFoot ? player.pos : player.car.pos;

    if (player.onFoot) {
      player.update(dt, input, this.world, this.camera);
    } else {
      const hitWall = this.vehicles.drivePlayer(player.car, dt, input);
      if (hitWall && Math.abs(player.car.speed) > 10) {
        this.audio.noiseBurst(0.12, 0.2, 900);
      }
    }
    player.updateCamera(dt, this.camera, player.car);

    this.vehicles.update(dt, player.car);
    const playerSpeed = player.onFoot ? player.speed : Math.abs(player.car.speed);
    this.peds.update(dt, playerPos, playerSpeed);
    this.police.update(dt, playerPos, player.car, playerSpeed);
    this.combat.update(dt, playerPos, !player.onFoot);
    this.missions.update(dt, playerPos, player.car);
    this.world.update(dt);

    // Engine hum and siren follow the driving state.
    const speedNorm = player.onFoot ? 0 : Math.abs(player.car.speed) / 34;
    this.audio.setEngine(speedNorm, input.forward());

    // HUD refresh.
    this.hud.setMoney(this.money);
    this.hud.setHealth(this.health);
    this.hud.setSpeed(player.onFoot ? 0 : player.car.speed * 3.6, !player.onFoot);
    if (player.onFoot) {
      this.hud.setAmmo(player.ammo, player.reserveAmmo);
      this.hud.setCrosshair(true);
    }
    this.hud.updateMinimap(this, dt);

    // Sun shadow frustum follows the player so shadows stay crisp.
    const sunOffset = this.timeOfDay === 'sunset'
      ? new THREE.Vector3(-180, 60, -40)
      : new THREE.Vector3(140, 200, 80);
    this.sun.position.set(playerPos.x + sunOffset.x, sunOffset.y, playerPos.z + sunOffset.z);
    this.sun.target.position.set(playerPos.x, 0, playerPos.z);
    this.sun.target.updateMatrixWorld();
  }

  loop = (time) => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (time - this.lastTime) / 1000 || 0.016);
    this.lastTime = time;
    if (this.frozen) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    if (this.state === 'title') {
      this.titleAngle += dt * 0.04;
      const r = 150;
      this.camera.position.set(
        Math.sin(this.titleAngle) * r,
        55 + Math.sin(this.titleAngle * 0.7) * 8,
        Math.cos(this.titleAngle) * r,
      );
      this.camera.lookAt(0, 8, 0);
      this.world.update(dt);
    } else if (this.state === 'playing') {
      this.step(dt);
    }
    this.renderer.render(this.scene, this.camera);
  };

  start() {
    requestAnimationFrame(this.loop);
  }
}
