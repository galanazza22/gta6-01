// Deke on foot: a low-poly figure built from boxes, with a walk-cycle arm
// and leg swing, and the third-person camera that follows him (or his car).
import * as THREE from 'three';

const WALK_SPEED = 6;
const RUN_SPEED = 10.5;

export class Player {
  constructor(scene, spawn) {
    this.pos = spawn.clone();
    this.heading = Math.PI; // facing north (+z is south; start facing the city)
    this.camYaw = Math.PI;
    this.camPitch = 0.32;
    this.speed = 0;
    this.onFoot = true;
    this.car = null;
    this.walkPhase = 0;
    this.armed = true;
    this.ammo = 12;
    this.reserveAmmo = 96;

    const group = new THREE.Group();
    group.name = 'deke';
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98e6a });
    const shirt = new THREE.MeshLambertMaterial({ color: 0x2f6fd0 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a2d34 });
    const shoes = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const hair = new THREE.MeshLambertMaterial({ color: 0x1f1712 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirt);
    torso.position.y = 1.22;
    torso.castShadow = true;
    group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.34), skin);
    head.position.y = 1.82;
    head.castShadow = true;
    group.add(head);
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.36), hair);
    hairTop.position.y = 2.02;
    group.add(hairTop);
    // A white tee stripe so the figure reads at a distance.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.1, 0.36), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    stripe.position.y = 1.32;
    group.add(stripe);

    this.armL = new THREE.Group();
    this.armL.position.set(-0.38, 1.52, 0);
    const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.2), shirt);
    armLMesh.position.y = -0.28;
    armLMesh.castShadow = true;
    this.armL.add(armLMesh);
    group.add(this.armL);
    this.armR = new THREE.Group();
    this.armR.position.set(0.38, 1.52, 0);
    const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.62, 0.2), shirt);
    armRMesh.position.y = -0.28;
    armRMesh.castShadow = true;
    this.armR.add(armRMesh);
    group.add(this.armR);

    this.legL = new THREE.Group();
    this.legL.position.set(-0.17, 0.88, 0);
    const legLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 0.24), pants);
    legLMesh.position.y = -0.42;
    legLMesh.castShadow = true;
    this.legL.add(legLMesh);
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.42), shoes);
    shoeL.position.set(0, -0.82, 0.06);
    this.legL.add(shoeL);
    group.add(this.legL);
    this.legR = new THREE.Group();
    this.legR.position.set(0.17, 0.88, 0);
    const legRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.82, 0.24), pants);
    legRMesh.position.y = -0.42;
    legRMesh.castShadow = true;
    this.legR.add(legRMesh);
    const shoeR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.42), shoes);
    shoeR.position.set(0, -0.82, 0.06);
    this.legR.add(shoeR);
    group.add(this.legR);

    // A simple pistol held in the right hand when armed. Its long axis runs
    // down the arm, so it points forward when the arm is raised to aim.
    this.gun = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.42, 0.14),
      new THREE.MeshLambertMaterial({ color: 0x111111 }),
    );
    this.gun.position.set(0, -0.62, 0.08);
    this.armR.add(this.gun);

    this.mesh = group;
    this.syncMesh();
    scene.add(group);
  }

  syncMesh() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.heading;
  }

  setVisible(visible) {
    this.mesh.visible = visible;
  }

  // On-foot movement, camera-relative: W runs away from the camera.
  update(dt, input, world, camera) {
    const mouse = input.takeMouse();
    this.camYaw -= mouse.dx * 0.0028;
    this.camPitch = Math.max(-0.15, Math.min(0.9, this.camPitch + mouse.dy * 0.0022));

    let moveX = 0;
    let moveZ = 0;
    if (input.forward()) { moveX -= Math.sin(this.camYaw); moveZ -= Math.cos(this.camYaw); }
    if (input.back()) { moveX += Math.sin(this.camYaw); moveZ += Math.cos(this.camYaw); }
    if (input.left()) { moveX -= Math.cos(this.camYaw); moveZ += Math.sin(this.camYaw); }
    if (input.right()) { moveX += Math.cos(this.camYaw); moveZ -= Math.sin(this.camYaw); }
    const moving = moveX !== 0 || moveZ !== 0;
    if (moving) {
      const len = Math.hypot(moveX, moveZ);
      moveX /= len;
      moveZ /= len;
      const running = input.down('ShiftLeft') || input.down('ShiftRight');
      const targetSpeed = running ? RUN_SPEED : WALK_SPEED;
      this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 8);
      this.heading = Math.atan2(moveX, moveZ);
      this.pos.x += moveX * this.speed * dt;
      this.pos.z += moveZ * this.speed * dt;
      this.walkPhase += dt * this.speed * 1.6;
      const swing = Math.sin(this.walkPhase) * 0.55;
      this.legL.rotation.x = swing;
      this.legR.rotation.x = -swing;
      this.armL.rotation.x = -swing * 0.8;
      this.armR.rotation.x = this.armed ? -1.2 : swing * 0.8;
    } else {
      this.speed += (0 - this.speed) * Math.min(1, dt * 10);
      this.legL.rotation.x *= 0.8;
      this.legR.rotation.x *= 0.8;
      this.armL.rotation.x *= 0.8;
      this.armR.rotation.x = this.armed ? -1.2 : this.armR.rotation.x * 0.8;
    }
    world.collideCircle(this.pos, 0.6);
    this.pos.x = Math.max(-175, Math.min(262, this.pos.x));
    this.pos.z = Math.max(-175, Math.min(175, this.pos.z));
    this.syncMesh();
  }

  // Third-person camera: behind the player (or the car), mouse orbit.
  updateCamera(dt, camera, car) {
    const focus = car || null;
    let targetX;
    let targetZ;
    let targetY;
    let yaw;
    let pitch;
    let distance;
    if (focus) {
      targetX = focus.pos.x;
      targetZ = focus.pos.z;
      targetY = 1.6;
      yaw = this.camYaw;
      pitch = 0.24;
      distance = 10.5;
      // When driving, the camera gently swings behind the car's heading.
      const headingDiff = normAngle(focus.heading - (this.camYaw + Math.PI));
      this.camYaw += headingDiff * Math.min(1, dt * 0.9);
    } else {
      targetX = this.pos.x;
      targetZ = this.pos.z;
      targetY = 1.7;
      yaw = this.camYaw;
      pitch = this.camPitch;
      distance = 7.5;
    }
    const cx = targetX + Math.sin(yaw) * Math.cos(pitch) * distance;
    const cz = targetZ + Math.cos(yaw) * Math.cos(pitch) * distance;
    const cy = targetY + Math.sin(pitch) * distance;
    camera.position.set(cx, cy, cz);
    camera.lookAt(targetX, targetY, targetZ);
  }
}

function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
