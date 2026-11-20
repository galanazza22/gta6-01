// The wanted system: crimes add heat, heat spawns police, police chase and
// ram the player's car or chase on foot. Lose them by staying out of sight
// or reaching a hideout; get caught on foot at high heat and it is over.
import * as THREE from 'three';
import { mulberry32, range } from './rng.js';

export class Police {
  constructor(scene, world, vehicles, game) {
    this.scene = scene;
    this.world = world;
    this.vehicles = vehicles;
    this.game = game;
    this.rand = mulberry32(4242);
    this.cops = []; // on-foot officers {mesh, pos, heading, speed, grabTimer}
    this.bustedTimer = 0;
    this.decayTimer = 0;
  }

  wantedCount() {
    const w = this.game.wanted;
    if (w <= 0) return 0;
    if (w <= 2) return 1;
    if (w === 3) return 2;
    return 3;
  }

  // How many police cars should be out right now.
  syncPoliceCars(playerPos) {
    const want = this.wantedCount();
    while (this.vehicles.policeCars.length < want) {
      const angle = this.rand() * Math.PI * 2;
      const dist = 55 + this.rand() * 30;
      let x = playerPos.x + Math.sin(angle) * dist;
      let z = playerPos.z + Math.cos(angle) * dist;
      x = Math.max(-160, Math.min(160, x));
      z = Math.max(-160, Math.min(160, z));
      const car = this.vehicles.spawnPoliceCar(x, z);
      car.heading = Math.atan2(playerPos.x - x, playerPos.z - z);
      car.speed = 10;
    }
    while (this.vehicles.policeCars.length > want) {
      this.vehicles.removePoliceCar(this.vehicles.policeCars[0]);
    }
    // Foot cops join the chase from 3 stars up.
    const wantCops = this.game.wanted >= 3 ? Math.min(2, this.game.wanted - 2) : 0;
    while (this.cops.length < wantCops) this.spawnCop(playerPos);
    while (this.cops.length > wantCops) {
      const cop = this.cops.pop();
      this.scene.remove(cop.mesh);
    }
  }

  spawnCop(playerPos) {
    const group = new THREE.Group();
    const navy = new THREE.MeshLambertMaterial({ color: 0x1c2f57 });
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98e6a });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), navy);
    torso.position.y = 1.22;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.34), skin);
    head.position.y = 1.82;
    group.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.38), navy);
    cap.position.y = 2.02;
    group.add(cap);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), navy);
    legL.position.set(-0.16, 0.44, 0);
    group.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.22), navy);
    legR.position.set(0.16, 0.44, 0);
    group.add(legR);
    const angle = this.rand() * Math.PI * 2;
    const pos = new THREE.Vector3(
      playerPos.x + Math.sin(angle) * 30,
      0,
      playerPos.z + Math.cos(angle) * 30,
    );
    group.position.copy(pos);
    this.scene.add(group);
    this.cops.push({ mesh: group, pos, heading: 0, speed: 0, grabTimer: 0, phase: 0 });
  }

  // Police cars steer toward the player and ram; foot cops run the player down.
  update(dt, playerPos, playerCar, playerSpeed) {
    if (this.game.wanted <= 0) {
      this.syncPoliceCars(playerPos);
      return;
    }
    this.syncPoliceCars(playerPos);
    for (const car of this.vehicles.policeCars) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      car.stuckTimer = car.stuckTimer || 0;
      car.reverseTimer = car.reverseTimer || 0;
      // Wedged on a building corner: back out with a turn, then resume.
      if (car.reverseTimer > 0) {
        car.reverseTimer -= dt;
        car.speed = -9;
        car.heading += 1.5 * dt;
        const rf = car.forwardVector();
        car.pos.x += rf.x * car.speed * dt;
        car.pos.z += rf.z * car.speed * dt;
        this.world.collideCircle(car.pos, 2.3);
        car.syncMesh();
        continue;
      }
      const desired = Math.atan2(dx, dz);
      let diff = desired - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const targetSpeed = dist > 60 ? 30 : dist > 12 ? 26 : 18;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
      const f = car.forwardVector();
      car.pos.x += f.x * car.speed * dt;
      car.pos.z += f.z * car.speed * dt;
      const hitWall = this.world.collideCircle(car.pos, 2.3);
      if (hitWall) car.speed *= 0.6;
      if (car.speed < 3) car.stuckTimer += dt;
      else car.stuckTimer = 0;
      if (car.stuckTimer > 1.2) {
        car.reverseTimer = 0.9;
        car.stuckTimer = 0;
      }
      // Ramming the player's car shoves it and slows it.
      if (playerCar && dist < 4.6) {
        const push = 4.6 - dist;
        const nx = dx / (dist || 1);
        const nz = dz / (dist || 1);
        playerCar.pos.x += nx * push * 0.6;
        playerCar.pos.z += nz * push * 0.6;
        playerCar.speed *= 0.92;
        car.speed *= 0.85;
        this.game.damagePlayer(2 * dt * 10, 'rammed');
      }
      car.syncMesh();
    }
    for (const cop of this.cops) {
      const dx = playerPos.x - cop.pos.x;
      const dz = playerPos.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      cop.heading = Math.atan2(dx, dz);
      const speed = dist > 2 ? 7.5 : 0;
      cop.pos.x += Math.sin(cop.heading) * speed * dt;
      cop.pos.z += Math.cos(cop.heading) * speed * dt;
      cop.phase += dt * speed * 2;
      cop.mesh.rotation.y = cop.heading;
      cop.mesh.position.copy(cop.pos);
      cop.mesh.position.y = Math.abs(Math.sin(cop.phase)) * 0.08;
      // A cop that holds the player on foot busts them.
      if (!playerCar && dist < 1.8 && this.game.wanted >= 2) {
        cop.grabTimer += dt;
        if (cop.grabTimer > 1.4) this.game.busted();
      } else {
        cop.grabTimer = 0;
      }
      // A cop that catches the player punches them.
      if (!playerCar && dist < 1.8 && this.game.wanted < 2) {
        this.game.damagePlayer(6 * dt, 'punched');
      }
    }
    // Wanted decays when no police can see the player.
    this.decayTimer += dt;
    if (this.decayTimer > 5) {
      this.decayTimer = 0;
      let seen = false;
      for (const car of this.vehicles.policeCars) {
        if (Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z) < 45) seen = true;
      }
      for (const cop of this.cops) {
        if (Math.hypot(cop.pos.x - playerPos.x, cop.pos.z - playerPos.z) < 30) seen = true;
      }
      if (!seen && this.game.wanted > 0) {
        this.game.setWanted(this.game.wanted - 1);
        if (this.game.wanted === 0) this.game.toast('You lost the cops.');
      }
    }
  }

  clearAll() {
    for (const car of [...this.vehicles.policeCars]) this.vehicles.removePoliceCar(car);
    for (const cop of this.cops) this.scene.remove(cop.mesh);
    this.cops = [];
  }
}
