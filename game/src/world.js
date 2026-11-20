// Solmar City: a sun-soaked coastal grid city, generated from one seed.
// Roads on a 40-unit grid, concrete block slabs, procedural buildings with
// canvas facades, a central plaza, a beach and a pier on the east side.
// Everything static is built once here; moving things live elsewhere.
import * as THREE from 'three';
import { mulberry32, hashString, range, pick } from './rng.js';
import { buildFacadeLibrary, roadTexture, concreteTexture, sandTexture } from './textures.js';

export const ROAD_COORDS = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
export const CITY_HALF = 200;
export const ROAD_HALF_WIDTH = 7;

function blockCenters() {
  const centers = [];
  for (let i = 0; i < ROAD_COORDS.length - 1; i += 1) {
    centers.push((ROAD_COORDS[i] + ROAD_COORDS[i + 1]) / 2);
  }
  return centers;
}

export function buildWorld(scene, seed) {
  const rand = mulberry32(seed);
  const group = new THREE.Group();
  group.name = 'SolmarCity';
  scene.add(group);
  const colliders = [];
  const facades = buildFacadeLibrary();
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const roofMatLight = new THREE.MeshLambertMaterial({ color: 0x6b6258 });

  // --- Ground: grass-tone base, then concrete block slabs, then roads. ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x8a9a6d }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(40, -0.05, 0);
  ground.receiveShadow = true;
  group.add(ground);

  const centers = blockCenters();
  const slabTex = concreteTexture();
  slabTex.repeat.set(4, 4);
  const slabMat = new THREE.MeshLambertMaterial({ map: slabTex });
  for (const bx of centers) {
    for (const bz of centers) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(25, 0.3, 25), slabMat);
      slab.position.set(bx, 0.1, bz);
      slab.receiveShadow = true;
      group.add(slab);
    }
  }

  const roadTexX = roadTexture(true);
  roadTexX.repeat.set(25, 1);
  const roadTexZ = roadTexture(false);
  roadTexZ.repeat.set(1, 25);
  const roadMatX = new THREE.MeshLambertMaterial({ map: roadTexX });
  const roadMatZ = new THREE.MeshLambertMaterial({ map: roadTexZ });
  for (const c of ROAD_COORDS) {
    const alongX = new THREE.Mesh(new THREE.PlaneGeometry(420, 14), roadMatX);
    alongX.rotation.x = -Math.PI / 2;
    alongX.rotation.z = 0;
    alongX.position.set(0, 0.28, c);
    alongX.receiveShadow = true;
    group.add(alongX);
    const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(14, 420), roadMatZ);
    alongZ.rotation.x = -Math.PI / 2;
    alongZ.position.set(c, 0.28, 0);
    alongZ.receiveShadow = true;
    group.add(alongZ);
  }

  // --- Beach and ocean on the east side. ---
  const sandTex = sandTexture();
  sandTex.repeat.set(6, 24);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 430),
    new THREE.MeshLambertMaterial({ map: sandTex }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(196, 0.3, 0);
  sand.receiveShadow = true;
  group.add(sand);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(280, 560),
    new THREE.MeshLambertMaterial({ color: 0x2e7fa8 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(354, 0.15, 0);
  group.add(ocean);
  const oceanLight = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 560),
    new THREE.MeshLambertMaterial({ color: 0x63b3cf }),
  );
  oceanLight.rotation.x = -Math.PI / 2;
  oceanLight.position.set(244, 0.18, 0);
  group.add(oceanLight);

  // --- Buildings. ---
  const plazaBlocks = new Set(['-20,-20', '-20,20', '20,-20', '20,20']);
  const specialBlocks = new Set(['-140,-140', '100,-100', '-100,140', '140,140']);
  const facadeMats = facades.map(
    (tex) => new THREE.MeshLambertMaterial({ map: tex }),
  );

  function addBuilding(x, z, w, h, d, facadeIndex, roof) {
    const mats = [
      facadeMats[facadeIndex],
      facadeMats[facadeIndex],
      roof || roofMat,
      roofMat,
      facadeMats[facadeIndex],
      facadeMats[facadeIndex],
    ];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
    mesh.position.set(x, 0.25 + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return mesh;
  }

  for (const bx of centers) {
    for (const bz of centers) {
      const key = `${bx},${bz}`;
      if (plazaBlocks.has(key) || specialBlocks.has(key)) continue;
      const blockRand = mulberry32(hashString(`block-${seed}-${key}`));
      const distCenter = Math.hypot(bx, bz);
      const centerBonus = Math.max(0, 1 - distCenter / 230) * 22;
      const count = blockRand() < 0.55 ? 1 : 2;
      if (count === 1) {
        const w = range(blockRand, 15, 21);
        const d = range(blockRand, 15, 21);
        const h = 8 + blockRand() * 14 + centerBonus * blockRand();
        addBuilding(
          bx + range(blockRand, -2, 2),
          bz + range(blockRand, -2, 2),
          w, h, d,
          Math.floor(blockRand() * facadeMats.length),
          blockRand() < 0.5 ? roofMatLight : roofMat,
        );
      } else {
        for (let k = 0; k < 2; k += 1) {
          const horizontal = blockRand() < 0.5;
          const off = k === 0 ? -6 : 6;
          const w = horizontal ? 11 : range(blockRand, 10, 13);
          const d = horizontal ? range(blockRand, 10, 13) : 11;
          const h = 7 + blockRand() * 12 + centerBonus * 0.6 * blockRand();
          addBuilding(
            bx + (horizontal ? off : range(blockRand, -3, 3)),
            bz + (horizontal ? range(blockRand, -3, 3) : off),
            w, h, d,
            Math.floor(blockRand() * facadeMats.length),
            roofMat,
          );
        }
      }
    }
  }

  // --- Landmark buildings (also the mission locations). ---
  // Lena's garage, south-west.
  addBuilding(-140, -140, 22, 7, 14, 3, roofMatLight);
  // Solmar Bank, east-north.
  addBuilding(100, -100, 16, 30, 16, 1, roofMat);
  // Hideout apartments, north-west.
  addBuilding(-100, 140, 18, 16, 14, 5, roofMatLight);
  // General Hospital, north-east.
  addBuilding(140, 140, 20, 22, 16, 7, roofMat);

  // --- Central plaza: the south-west quadrant is an open square with a
  // fountain, benches and a palm ring. The (0,0) crossing stays a normal
  // road intersection so cars can drive through it.
  const plazaMat = new THREE.MeshLambertMaterial({ map: concreteTexture() });
  const plazaDisc = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 0.5, 24), plazaMat);
  plazaDisc.position.set(-20, 0.3, -20);
  plazaDisc.receiveShadow = true;
  group.add(plazaDisc);
  const basin = new THREE.Mesh(
    new THREE.CylinderGeometry(4, 4.6, 1, 20),
    new THREE.MeshLambertMaterial({ color: 0xcfc8b8 }),
  );
  basin.position.set(-20, 0.9, -20);
  basin.castShadow = true;
  group.add(basin);
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 3.6, 0.4, 20),
    new THREE.MeshLambertMaterial({ color: 0x4fb3d9 }),
  );
  water.position.set(-20, 1.25, -20);
  group.add(water);
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.9, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0xe8e2d2 }),
  );
  column.position.set(-20, 3, -20);
  column.castShadow = true;
  group.add(column);
  colliders.push({ minX: -24.6, maxX: -15.4, minZ: -24.6, maxZ: -15.4 });
  for (let i = 0; i < 6; i += 1) {
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.7, 1),
      new THREE.MeshLambertMaterial({ color: 0x8a6a42 }),
    );
    const a = (i / 6) * Math.PI * 2;
    bench.position.set(-20 + Math.cos(a) * 9, 0.7, -20 + Math.sin(a) * 9);
    bench.rotation.y = -a + Math.PI / 2;
    bench.castShadow = true;
    group.add(bench);
  }

  // --- Docks pier on the beach at z = 100. ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7b4f });
  for (let x = 208; x <= 258; x += 6) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 8), pierMat);
    plank.position.set(x, 0.9, 100);
    plank.castShadow = true;
    group.add(plank);
  }
  for (let x = 212; x <= 254; x += 14) {
    for (const dz of [-3.4, 3.4]) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.35, 2.4, 8),
        new THREE.MeshLambertMaterial({ color: 0x6b4e2e }),
      );
      post.position.set(x, 0.2, 100 + dz);
      group.add(post);
    }
  }
  const dockHouse = new THREE.Mesh(
    new THREE.BoxGeometry(8, 5, 7),
    new THREE.MeshLambertMaterial({ color: 0xb0703c }),
  );
  dockHouse.position.set(252, 3.4, 108);
  dockHouse.castShadow = true;
  group.add(dockHouse);
  colliders.push({ minX: 248, maxX: 256, minZ: 104.5, maxZ: 111.5 });

  // --- Palms: instanced trunks + fronds. ---
  const palmSpots = [];
  for (let z = -190; z <= 190; z += 24) palmSpots.push([190, z]);
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + 0.4;
    palmSpots.push([-20 + Math.cos(a) * 11, -20 + Math.sin(a) * 11]);
  }
  for (let i = 0; i < 14; i += 1) {
    palmSpots.push([
      pick(rand, centers) + range(rand, -11, 11),
      pick(rand, centers) + range(rand, -11, 11),
    ]);
  }
  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const frondGeo = new THREE.BoxGeometry(5.4, 0.18, 1.5);
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const fronds = new THREE.InstancedMesh(frondGeo, frondMat, palmSpots.length * 5);
  const dummy = new THREE.Object3D();
  const frondDummy = new THREE.Object3D();
  palmSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 3.5, z);
    dummy.rotation.set(0, rand() * Math.PI, (rand() - 0.5) * 0.16);
    dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    for (let f = 0; f < 5; f += 1) {
      const a = (f / 5) * Math.PI * 2 + rand() * 0.5;
      frondDummy.position.set(x + Math.cos(a) * 2.2, 7.1, z + Math.sin(a) * 2.2);
      frondDummy.rotation.set(0.25, -a, 0);
      frondDummy.rotateY(0);
      frondDummy.rotation.order = 'YXZ';
      frondDummy.rotation.y = -a;
      frondDummy.rotation.x = 0.35;
      frondDummy.updateMatrix();
      fronds.setMatrixAt(i * 5 + f, frondDummy.matrix);
    }
  });
  trunks.castShadow = true;
  fronds.castShadow = true;
  group.add(trunks);
  group.add(fronds);

  // --- Street lamps at every other intersection. ---
  const lampCoords = [];
  for (let i = 0; i < ROAD_COORDS.length; i += 2) {
    for (let j = 0; j < ROAD_COORDS.length; j += 2) {
      lampCoords.push([ROAD_COORDS[i] + 8.5, ROAD_COORDS[j] + 8.5]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampCoords.length);
  const headGeo = new THREE.BoxGeometry(1.2, 0.3, 0.4);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x443311 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampCoords.length);
  lampCoords.forEach(([x, z], i) => {
    dummy.position.set(x, 3, z);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 6.1, z);
    dummy.updateMatrix();
    heads.setMatrixAt(i, dummy.matrix);
  });
  group.add(poles);
  group.add(heads);

  // --- Drifting clouds. ---
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const clouds = [];
  for (let i = 0; i < 10; i += 1) {
    const cloud = new THREE.Mesh(new THREE.BoxGeometry(range(rand, 18, 34), 3, range(rand, 10, 16)), cloudMat);
    cloud.position.set(range(rand, -220, 220), range(rand, 85, 125), range(rand, -220, 220));
    group.add(cloud);
    clouds.push(cloud);
  }

  // --- Collision + road helpers. ---
  function collideCircle(pos, radius) {
    let hit = false;
    for (let i = 0; i < colliders.length; i += 1) {
      const c = colliders[i];
      const nearestX = Math.max(c.minX, Math.min(pos.x, c.maxX));
      const nearestZ = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
      const dx = pos.x - nearestX;
      const dz = pos.z - nearestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) continue;
      hit = true;
      if (distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const push = radius - dist;
        pos.x += (dx / dist) * push;
        pos.z += (dz / dist) * push;
      } else {
        // Centre inside the box: push out along the smallest overlap.
        const pushLeft = pos.x - c.minX + radius;
        const pushRight = c.maxX - pos.x + radius;
        const pushUp = pos.z - c.minZ + radius;
        const pushDown = c.maxZ - pos.z + radius;
        const min = Math.min(pushLeft, pushRight, pushUp, pushDown);
        if (min === pushLeft) pos.x = c.minX - radius;
        else if (min === pushRight) pos.x = c.maxX + radius;
        else if (min === pushUp) pos.z = c.minZ - radius;
        else pos.z = c.maxZ + radius;
      }
    }
    return hit;
  }

  function nearestRoadCoord(value) {
    let best = ROAD_COORDS[0];
    let bestDist = Math.abs(value - best);
    for (const c of ROAD_COORDS) {
      const d = Math.abs(value - c);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  const world = {
    group,
    colliders,
    seed,
    locations: {
      garage: new THREE.Vector3(-140, 0, -118),
      docks: new THREE.Vector3(252, 0, 100),
      plaza: new THREE.Vector3(0, 0, 0),
      bank: new THREE.Vector3(100, 0, -78),
      hideout: new THREE.Vector3(-100, 0, 118),
      hospital: new THREE.Vector3(140, 0, 118),
      beach: new THREE.Vector3(196, 0, -60),
    },
    spawn: new THREE.Vector3(-128, 0, -128),
    collideCircle,
    nearestRoadCoord,
    update(dt) {
      for (const cloud of clouds) {
        cloud.position.x += dt * 1.2;
        if (cloud.position.x > 260) cloud.position.x = -260;
      }
    },
  };
  return world;
}
