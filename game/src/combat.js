// Combat: the player's pistol (hitscan with a tracer and muzzle flash),
// rival gang members who shoot back, and hit feedback.
import * as THREE from 'three';
import { mulberry32, range } from './rng.js';

export class Combat {
  constructor(scene, game) {
    this.scene = scene;
    this.game = game;
    this.rand = mulberry32(777);
    this.enemies = []; // {mesh, pos, health, shootTimer, phase, dead}
    this.tracers = []; // {line, life}
    this.flash = null;
    this.flashLife = 0;
    this.raycaster = new THREE.Raycaster();
  }

  spawnEnemy(x, z) {
    const group = new THREE.Group();
    const red = new THREE.MeshLambertMaterial({ color: 0xb03030 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x222226 });
    const skin = new THREE.MeshLambertMaterial({ color: pickSkin(this.rand) });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), red);
    torso.position.y = 1.22;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.34), skin);
    head.position.y = 1.82;
    group.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.38), dark);
    cap.position.y = 2.02;
    group.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), dark);
    legL.position.set(-0.16, 0.44, 0);
    group.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), dark);
    legR.position.set(0.16, 0.44, 0);
    group.add(legR);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.4), dark);
    gun.position.set(0.4, 1.3, 0.2);
    group.add(gun);
    const pos = new THREE.Vector3(x, 0, z);
    group.position.copy(pos);
    this.scene.add(group);
    const enemy = {
      mesh: group,
      pos,
      health: 100,
      shootTimer: 1 + this.rand() * 1.5,
      phase: this.rand() * Math.PI * 2,
      strafeDir: this.rand() < 0.5 ? 1 : -1,
      dead: false,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  clearEnemies() {
    for (const enemy of this.enemies) this.scene.remove(enemy.mesh);
    this.enemies = [];
  }

  aliveCount() {
    return this.enemies.filter((e) => !e.dead).length;
  }

  // Fire the pistol from the camera through the crosshair.
  shoot(camera, playerPos) {
    const player = this.game.player;
    if (player.ammo <= 0) {
      this.game.audio.blip(180, 0.08, 'square', 0.1);
      this.game.toast('Out of ammo — press R to reload.');
      return;
    }
    player.ammo -= 1;
    this.game.audio.gunshot();
    this.game.peds.scare(playerPos.x, playerPos.z, 40);
    this.game.addWanted(1, 'shots fired');
    this.raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    this.raycaster.far = 120;
    const targets = this.enemies.filter((e) => !e.dead).map((e) => e.mesh);
    const hits = this.raycaster.intersectObjects(targets, true);
    // The tracer runs from Deke's gun to the impact point, so it crosses
    // the frame diagonally instead of running straight away from the lens.
    const fwdX = Math.sin(player.heading);
    const fwdZ = Math.cos(player.heading);
    const muzzle = new THREE.Vector3(playerPos.x + fwdX * 0.8, 1.35, playerPos.z + fwdZ * 0.8);
    let end;
    if (hits.length > 0) {
      end = hits[0].point.clone();
      let obj = hits[0].object;
      while (obj.parent && obj.parent !== this.scene) obj = obj.parent;
      const enemy = this.enemies.find((e) => !e.dead && e.mesh === obj);
      if (enemy) {
        enemy.health -= 34;
        this.game.audio.hit();
        if (enemy.health <= 0) {
          enemy.dead = true;
          enemy.mesh.rotation.x = -Math.PI / 2;
          enemy.mesh.position.y = 0.3;
          this.game.toast('Rival down.');
        }
      }
    } else {
      end = this.raycaster.ray.at(90, new THREE.Vector3());
    }
    this.addTracer(muzzle, end);
    this.muzzleFlash(muzzle);
  }

  // A tracer is a thin glowing bar stretched from muzzle to impact, so the
  // shot reads in a still frame (a 1px line would not).
  addTracer(from, to) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, len),
      new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.95 }),
    );
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.lookAt(to);
    this.scene.add(mesh);
    this.tracers.push({ line: mesh, life: 0.09 });
  }

  muzzleFlash(position) {
    if (!this.flash) {
      this.flash = new THREE.PointLight(0xffc860, 0, 14);
      this.scene.add(this.flash);
    }
    this.flash.position.copy(position).add(new THREE.Vector3(0, -0.3, 0));
    this.flash.intensity = 60;
    this.flashLife = 0.06;
  }

  // Enemies strafe and shoot at the player with loose aim.
  update(dt, playerPos, playerInCar) {
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const dx = playerPos.x - enemy.pos.x;
      const dz = playerPos.z - enemy.pos.z;
      const dist = Math.hypot(dx, dz);
      enemy.phase += dt;
      // Strafe sideways, keep facing the player.
      const strafe = Math.sin(enemy.phase * 0.9) * enemy.strafeDir;
      enemy.pos.x += Math.cos(Math.atan2(dx, dz)) * strafe * dt * 1.4;
      enemy.pos.z -= Math.sin(Math.atan2(dx, dz)) * strafe * dt * 1.4;
      enemy.mesh.rotation.y = Math.atan2(dx, dz);
      enemy.mesh.position.copy(enemy.pos);
      enemy.mesh.position.y = Math.abs(Math.sin(enemy.phase * 2)) * 0.05;
      if (dist < 55 && !playerInCar) {
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0) {
          enemy.shootTimer = 1.2 + this.rand() * 1.2;
          const hitChance = dist < 12 ? 0.4 : dist < 25 ? 0.25 : 0.12;
          const from = enemy.pos.clone().setY(1.4);
          const to = playerPos.clone().setY(1.2);
          to.x += range(this.rand, -1.5, 1.5);
          to.z += range(this.rand, -1.5, 1.5);
          this.addTracer(from, to);
          this.game.audio.noiseBurst(0.1, 0.18, 1400);
          if (this.rand() < hitChance) {
            this.game.damagePlayer(7, 'shot');
            this.game.audio.blip(140, 0.15, 'sawtooth', 0.15);
          }
        }
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i -= 1) {
      const tracer = this.tracers[i];
      tracer.life -= dt;
      tracer.line.material.opacity = Math.max(0, tracer.life / 0.09) * 0.9;
      if (tracer.life <= 0) {
        this.scene.remove(tracer.line);
        this.tracers.splice(i, 1);
      }
    }
    if (this.flash && this.flashLife > 0) {
      this.flashLife -= dt;
      if (this.flashLife <= 0) this.flash.intensity = 0;
    }
  }
}

function pickSkin(rand) {
  return [0xc98e6a, 0x8a5a3b, 0xe8b88a, 0x6b4423][Math.floor(rand() * 4)];
}
