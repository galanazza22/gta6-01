// Cars: a box-built car mesh, arcade driving physics for the player, and
// traffic AI that follows the road grid, turns at intersections and queues
// behind the car ahead. Every car in the city is stealable.
import * as THREE from 'three';
import { mulberry32, range, pick } from './rng.js';
import { ROAD_COORDS } from './world.js';
import { CAR_PAINTS as PAINTS } from './textures.js';

const CAR_LENGTH = 4.2;
const CAR_WIDTH = 2.0;

export class Car {
  constructor(scene, options) {
    const { x, z, heading, color, kind } = options;
    this.kind = kind || 'traffic';
    this.heading = heading || 0;
    this.speed = 0;
    this.steer = 0;
    this.pos = new THREE.Vector3(x, 0, z);
    this.ai = null; // traffic state, set by the manager
    this.dead = false;

    const group = new THREE.Group();
    group.name = `car-${this.kind}`;
    const paint = new THREE.MeshLambertMaterial({ color });
    const glass = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
    const dark = new THREE.MeshLambertMaterial({ color: 0x14161a });

    const body = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH, 0.7, CAR_LENGTH), paint);
    body.position.y = 0.62;
    body.castShadow = true;
    group.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 2.1), glass);
    cabin.position.set(0, 1.22, -0.25);
    cabin.castShadow = true;
    group.add(cabin);
    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH + 0.08, 0.25, 0.3), dark);
    bumperF.position.set(0, 0.42, CAR_LENGTH / 2);
    group.add(bumperF);
    const bumperB = bumperF.clone();
    bumperB.position.z = -CAR_LENGTH / 2;
    group.add(bumperB);

    // Headlights and taillights.
    const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0x555533 });
    const tailMat = new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x550000 });
    for (const sx of [-0.65, 0.65]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
      head.position.set(sx, 0.72, CAR_LENGTH / 2 + 0.02);
      group.add(head);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
      tail.position.set(sx, 0.72, -CAR_LENGTH / 2 - 0.02);
      group.add(tail);
    }

    // Police light bar.
    if (this.kind === 'police') {
      const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), dark);
      barBase.position.set(0, 1.62, -0.25);
      group.add(barBase);
      this.lightRed = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.2, 0.42),
        new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xaa0000 }),
      );
      this.lightRed.position.set(-0.28, 1.64, -0.25);
      group.add(this.lightRed);
      this.lightBlue = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.2, 0.42),
        new THREE.MeshLambertMaterial({ color: 0x2266ff, emissive: 0x0022aa }),
      );
      this.lightBlue.position.set(0.28, 1.64, -0.25);
      group.add(this.lightBlue);
    }

    // Wheels: cylinders spun on their sides; the front pair also yaws.
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    this.wheels = [];
    this.frontWheels = [];
    for (const [wx, wz, front] of [[-0.95, 1.35, true], [0.95, 1.35, true], [-0.95, -1.35, false], [0.95, -1.35, false]]) {
      const pivot = new THREE.Group();
      pivot.position.set(wx, 0.38, wz);
      const wheel = new THREE.Mesh(wheelGeo, dark);
      wheel.castShadow = true;
      pivot.add(wheel);
      group.add(pivot);
      this.wheels.push(wheel);
      if (front) this.frontWheels.push(pivot);
    }

    this.mesh = group;
    this.syncMesh();
    scene.add(group);
  }

  forwardVector() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  syncMesh() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016;
    for (const wheel of this.wheels) wheel.rotation.x += spin;
    for (const pivot of this.frontWheels) pivot.rotation.y = this.steer * 0.5;
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.dead = true;
  }
}

export class Vehicles {
  constructor(scene, world, seed) {
    this.scene = scene;
    this.world = world;
    this.rand = mulberry32(seed + 500);
    this.traffic = [];
    this.parked = [];
    this.policeCars = [];
    this.all = [];
    this.spawnTraffic(18);
    this.spawnParked(10);
  }

  makeCar(x, z, heading, color, kind) {
    const car = new Car(this.scene, { x, z, heading, color, kind });
    this.all.push(car);
    return car;
  }

  spawnTraffic(count) {
    for (let i = 0; i < count; i += 1) {
      const axis = this.rand() < 0.5 ? 'x' : 'z';
      const road = pick(this.rand, ROAD_COORDS);
      const dir = this.rand() < 0.5 ? 1 : -1;
      const along = range(this.rand, -160, 160);
      const lane = dir > 0 ? -3.2 : 3.2;
      const x = axis === 'x' ? along : road + (axis === 'z' && dir > 0 ? lane : -lane);
      const z = axis === 'x' ? road + (dir > 0 ? lane : -lane) : along;
      const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : dir > 0 ? 0 : Math.PI;
      const car = this.makeCar(x, z, heading, pick(this.rand, PAINTS), 'traffic');
      car.ai = {
        axis,
        road,
        dir,
        speed: range(this.rand, 7, 11),
        targetSpeed: range(this.rand, 8, 12),
      };
      car.speed = car.ai.speed;
      this.traffic.push(car);
    }
  }

  spawnParked(count) {
    for (let i = 0; i < count; i += 1) {
      const axis = this.rand() < 0.5 ? 'x' : 'z';
      const road = pick(this.rand, ROAD_COORDS);
      const along = range(this.rand, -150, 150);
      const side = this.rand() < 0.5 ? -8.6 : 8.6;
      const x = axis === 'x' ? along : road + side;
      const z = axis === 'x' ? road + side : along;
      const heading = axis === 'x' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : side > 0 ? 0 : Math.PI;
      const car = this.makeCar(x, z, heading, pick(this.rand, PAINTS), 'parked');
      car.speed = 0;
      this.parked.push(car);
    }
  }

  spawnPoliceCar(x, z) {
    const car = this.makeCar(x, z, 0, 0xf2f2f2, 'police');
    car.ai = { axis: 'x', road: 0, dir: 1, speed: 0, targetSpeed: 26 };
    this.policeCars.push(car);
    return car;
  }

  removePoliceCar(car) {
    car.dispose(this.scene);
    this.policeCars = this.policeCars.filter((c) => c !== car);
    this.all = this.all.filter((c) => c !== car);
  }

  nearestCar(pos, maxDist, exclude) {
    let best = null;
    let bestDist = maxDist;
    for (const car of this.all) {
      if (car === exclude || car.dead) continue;
      const d = Math.hypot(car.pos.x - pos.x, car.pos.z - pos.z);
      if (d < bestDist) {
        bestDist = d;
        best = car;
      }
    }
    return best;
  }

  // Arcade driving for the player's car. Returns true when a wall was hit.
  drivePlayer(car, dt, input) {
    const accel = 17;
    const maxForward = 34;
    const maxReverse = 12;
    const fwd = input.forward();
    const back = input.back();
    if (fwd) car.speed += accel * dt;
    if (back) car.speed -= (car.speed > 0.5 ? 26 : 12) * dt;
    if (!fwd && !back) {
      car.speed -= car.speed * 0.7 * dt;
      if (Math.abs(car.speed) < 0.2) car.speed = 0;
    }
    if (input.down('Space')) {
      // Handbrake: hard drag, sharper turn.
      car.speed -= car.speed * 2.2 * dt;
    }
    car.speed = Math.max(-maxReverse, Math.min(maxForward, car.speed));
    const steerInput = (input.left() ? 1 : 0) - (input.right() ? 1 : 0);
    const steerTarget = steerInput * 0.55 * (input.down('Space') ? 1.5 : 1);
    car.steer += (steerTarget - car.steer) * Math.min(1, dt * 8);
    const speedFactor = Math.min(1, Math.abs(car.speed) / 10);
    car.heading += car.steer * speedFactor * dt * (car.speed >= 0 ? 1 : -1) * 1.9;
    const f = car.forwardVector();
    car.pos.x += f.x * car.speed * dt;
    car.pos.z += f.z * car.speed * dt;
    const hitWall = this.world.collideCircle(car.pos, 2.3);
    if (hitWall) {
      car.speed *= 0.55;
      if (Math.abs(car.speed) > 6) car.steer *= 0.5;
    }
    // Shove out of other cars instead of ghosting through them.
    for (const other of this.all) {
      if (other === car || other.dead) continue;
      const dx = car.pos.x - other.pos.x;
      const dz = car.pos.z - other.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 4.4) {
        const push = 4.4 - d;
        car.pos.x += (dx / d) * push;
        car.pos.z += (dz / d) * push;
        car.speed *= 0.94;
      }
    }
    // Keep the car inside the playable map (beach road included).
    car.pos.x = Math.max(-175, Math.min(262, car.pos.x));
    car.pos.z = Math.max(-175, Math.min(175, car.pos.z));
    car.syncMesh();
    return hitWall;
  }

  // Traffic AI: follow the grid, turn at intersections, queue behind cars.
  updateTraffic(dt, playerCar) {
    for (const car of this.traffic) {
      if (car.dead) continue;
      const ai = car.ai;
      // Car ahead on the same lane?
      let blocked = false;
      for (const other of this.all) {
        if (other === car || other.dead) continue;
        const dx = other.pos.x - car.pos.x;
        const dz = other.pos.z - car.pos.z;
        const f = car.forwardVector();
        const ahead = dx * f.x + dz * f.z;
        const side = Math.abs(dx * f.z - dz * f.x);
        if (ahead > 0 && ahead < 11 && side < 2.4) {
          blocked = true;
          break;
        }
      }
      const want = blocked ? 0 : ai.targetSpeed;
      car.speed += (want - car.speed) * Math.min(1, dt * 1.5);
      const f = car.forwardVector();
      car.pos.x += f.x * car.speed * dt;
      car.pos.z += f.z * car.speed * dt;
      // At an intersection, sometimes turn onto the cross road.
      const along = ai.axis === 'x' ? car.pos.x : car.pos.z;
      const cross = this.world.nearestRoadCoord(ai.axis === 'x' ? car.pos.z : car.pos.x);
      const crossDist = Math.abs((ai.axis === 'x' ? car.pos.z : car.pos.x) - cross);
      if (crossDist < 2.5 && this.rand() < dt * 0.35 && Math.abs(along) < 158) {
        const newDir = this.rand() < 0.5 ? 1 : -1;
        const newAxis = ai.axis === 'x' ? 'z' : 'x';
        const lane = newDir > 0 ? -3.2 : 3.2;
        if (newAxis === 'x') {
          car.pos.z = cross + lane;
          car.heading = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.pos.x = cross + lane;
          car.heading = newDir > 0 ? 0 : Math.PI;
        }
        ai.axis = newAxis;
        ai.road = cross;
        ai.dir = newDir;
      }
      // U-turn at the city edge instead of driving into the sea, swapping
      // to the opposite lane so the car stays on its own side.
      if (along > 162 || along < -162) {
        ai.dir *= -1;
        car.heading += Math.PI;
        const lane = ai.dir > 0 ? -3.2 : 3.2;
        if (ai.axis === 'x') {
          car.pos.x = Math.max(-160, Math.min(160, car.pos.x));
          car.pos.z = ai.road + lane;
        } else {
          car.pos.z = Math.max(-160, Math.min(160, car.pos.z));
          car.pos.x = ai.road + lane;
        }
      }
      car.syncMesh();
    }
    // Gentle separation so traffic cars never overlap each other.
    for (let i = 0; i < this.all.length; i += 1) {
      for (let j = i + 1; j < this.all.length; j += 1) {
        const a = this.all[i];
        const b = this.all[j];
        if (a.dead || b.dead) continue;
        if (a === playerCar || b === playerCar) continue;
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.01 && d < 4.4) {
          const push = (4.4 - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.pos.x -= nx * push;
          a.pos.z -= nz * push;
          b.pos.x += nx * push;
          b.pos.z += nz * push;
        }
      }
    }
  }

  update(dt, playerCar) {
    this.updateTraffic(dt, playerCar);
    // Police light bars flash.
    const phase = Math.floor(performance.now() / 180) % 2 === 0;
    for (const car of this.policeCars) {
      if (car.lightRed && car.lightBlue) {
        car.lightRed.material.emissive.setHex(phase ? 0xdd0000 : 0x220000);
        car.lightBlue.material.emissive.setHex(phase ? 0x000022 : 0x0033dd);
      }
    }
  }
}
