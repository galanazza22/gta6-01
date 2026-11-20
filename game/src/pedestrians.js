// Pedestrians: low-poly walkers strolling the sidewalks. They pick a
// sidewalk line, walk to a random corner, then pick another. A gunshot or a
// speeding car nearby makes them run away from the scare.
import * as THREE from 'three';
import { mulberry32, range, pick } from './rng.js';
import { ROAD_COORDS } from './world.js';

const SHIRTS = [0xe07b39, 0x3aa655, 0xc96fd0, 0xe8e8e8, 0xd23b3b, 0x2f6fd0, 0xe8b93a, 0x7a5fd0];
const PANTS = [0x2a2d34, 0x4a3a2a, 0x33455e, 0x5e3345];

export class Pedestrians {
  constructor(scene, world, seed) {
    this.scene = scene;
    this.world = world;
    this.rand = mulberry32(seed + 900);
    this.peds = [];
    for (let i = 0; i < 22; i += 1) this.spawnPed(true);
  }

  makePedMesh() {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(this.rand, SHIRTS) });
    const pants = new THREE.MeshLambertMaterial({ color: pick(this.rand, PANTS) });
    const skin = new THREE.MeshLambertMaterial({ color: pick(this.rand, [0xc98e6a, 0x8a5a3b, 0xe8b88a, 0x6b4423]) });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.66, 0.3), shirt);
    torso.position.y = 1.18;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.3), skin);
    head.position.y = 1.72;
    head.castShadow = true;
    group.add(head);
    const legL = new THREE.Group();
    legL.position.set(-0.15, 0.84, 0);
    const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.2), pants);
    legLMesh.position.y = -0.4;
    legL.add(legLMesh);
    group.add(legL);
    const legR = new THREE.Group();
    legR.position.set(0.15, 0.84, 0);
    const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.78, 0.2), pants);
    legRMesh.position.y = -0.4;
    legR.add(legRMesh);
    group.add(legR);
    return { group, legL, legR };
  }

  pickSidewalkTarget() {
    const road = pick(this.rand, ROAD_COORDS);
    const along = range(this.rand, -160, 160);
    const side = this.rand() < 0.5 ? -9.6 : 9.6;
    if (this.rand() < 0.5) return { x: along, z: road + side };
    return { x: road + side, z: along };
  }

  spawnPed(anywhere) {
    const { group, legL, legR } = this.makePedMesh();
    const target = this.pickSidewalkTarget();
    const ped = {
      mesh: group,
      legL,
      legR,
      pos: new THREE.Vector3(target.x, 0, target.z),
      target: this.pickSidewalkTarget(),
      speed: range(this.rand, 1.2, 2.2),
      phase: this.rand() * Math.PI * 2,
      scared: 0,
      dead: false,
    };
    if (!anywhere) {
      // Fresh spawns appear at the map edge, walking in.
      ped.pos.set(range(this.rand, -160, 160), 0, this.rand() < 0.5 ? -165 : 165);
    }
    ped.mesh.position.copy(ped.pos);
    this.scene.add(group);
    this.peds.push(ped);
    return ped;
  }

  // A scare (gunshot, near-miss car) at (x, z) sends nearby peds running.
  scare(x, z, radius) {
    for (const ped of this.peds) {
      const d = Math.hypot(ped.pos.x - x, ped.pos.z - z);
      if (d < radius) {
        ped.scared = 3 + this.rand() * 2;
        const away = Math.atan2(ped.pos.x - x, ped.pos.z - z);
        ped.target = {
          x: ped.pos.x + Math.sin(away) * 40,
          z: ped.pos.z + Math.cos(away) * 40,
        };
      }
    }
  }

  update(dt, playerPos, playerSpeed) {
    for (const ped of this.peds) {
      if (ped.dead) continue;
      if (ped.scared > 0) ped.scared -= dt;
      const dx = ped.target.x - ped.pos.x;
      const dz = ped.target.z - ped.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 1.5) {
        ped.target = this.pickSidewalkTarget();
        continue;
      }
      const speed = ped.scared > 0 ? 6.5 : ped.speed;
      const nx = dx / dist;
      const nz = dz / dist;
      ped.pos.x += nx * speed * dt;
      ped.pos.z += nz * speed * dt;
      ped.phase += dt * speed * 2.2;
      const swing = Math.sin(ped.phase) * 0.5;
      ped.legL.rotation.x = swing;
      ped.legR.rotation.x = -swing;
      ped.mesh.rotation.y = Math.atan2(nx, nz);
      ped.mesh.position.copy(ped.pos);
      // A speeding car that clips a pedestrian knocks them down.
      if (playerSpeed > 8) {
        const pd = Math.hypot(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z);
        if (pd < 2.2) this.knockDown(ped);
      }
    }
    // Keep the crowd topped up; respawn the fallen after a while.
    const alive = this.peds.filter((p) => !p.dead).length;
    if (alive < 18 && this.rand() < dt * 0.5) this.spawnPed(false);
  }

  knockDown(ped) {
    ped.dead = true;
    ped.mesh.rotation.x = -Math.PI / 2;
    ped.mesh.position.y = 0.3;
    setTimeout(() => {
      this.scene.remove(ped.mesh);
      this.peds = this.peds.filter((p) => p !== ped);
    }, 6000);
  }

  // Nearest pedestrian to a point, for crime detection.
  nearest(pos, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const ped of this.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z);
      if (d < bestDist) {
        bestDist = d;
        best = ped;
      }
    }
    return best;
  }
}
