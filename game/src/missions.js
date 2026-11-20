// The story: Deke owes club owner Marcus Vale $2,000. Fixer Lena Cruz
// feeds him jobs across Solmar City. Five missions, each with a beacon in
// the world, a HUD objective and a payout. Finish all five to clear the debt.
import * as THREE from 'three';

const MISSIONS = [
  {
    id: 'pickup',
    title: 'The Pickup',
    reward: 300,
    briefing: 'Lena: "Deke, I need wheels with no questions attached. Grab any car on the street and bring it to my garage."',
    objective: 'Steal a car and drive it to Lena\'s garage',
    target: 'garage',
  },
  {
    id: 'hotwheels',
    title: 'Hot Wheels',
    reward: 500,
    briefing: 'Lena: "That sedan is hot. The cops are already looking for it. Get it to the docks at the pier — fast, and don\'t stop for anyone."',
    objective: 'Deliver the car to the docks pier — the cops are coming',
    target: 'docks',
    wanted: 2,
  },
  {
    id: 'streetheat',
    title: 'Street Heat',
    reward: 600,
    briefing: 'Lena: "Vale\'s rivals are muscling in on the plaza. Four of them, packing heat. Clear them out, on foot."',
    objective: 'Take out the 4 rivals at the plaza',
    target: 'plaza',
    enemies: 4,
  },
  {
    id: 'getaway',
    title: 'The Getaway',
    reward: 700,
    briefing: 'Lena: "You\'re burned — three stars and every unit in the city is rolling. Lose them, then lay low at the hideout."',
    objective: 'Lose the cops, then reach the hideout',
    target: 'hideout',
    wanted: 3,
  },
  {
    id: 'bigscore',
    title: 'The Big Score',
    reward: 1500,
    briefing: 'Lena: "Last one, Deke. The bank on Marlin Avenue. Walk in, grab the cash, and get to the hideout. Vale\'s debt dies tonight."',
    objective: 'Rob the bank, then escape to the hideout',
    target: 'bank',
    wanted: 4,
    escapeTarget: 'hideout',
  },
];

export class Missions {
  constructor(scene, world, game) {
    this.scene = scene;
    this.world = world;
    this.game = game;
    this.index = 0;
    this.active = false;
    this.stage = 'go'; // go | escape | done
    this.targetPos = null;
    this.beacon = null;
    this.beaconLight = null;
    this.timer = 0;
    this.grabTimer = 0;
  }

  get current() {
    return MISSIONS[this.index] || null;
  }

  get storyComplete() {
    return this.index >= MISSIONS.length;
  }

  start(index) {
    this.index = index;
    this.stage = 'go';
    this.active = true;
    this.timer = 0;
    this.grabTimer = 0;
    const mission = this.current;
    if (!mission) {
      this.active = false;
      return;
    }
    this.setTarget(this.world.locations[mission.target]);
    if (mission.enemies) {
      this.game.combat.clearEnemies();
      const spots = [
        [-12, -10], [12, -12], [-14, 12], [14, 10],
      ];
      for (let i = 0; i < mission.enemies; i += 1) {
        const [ox, oz] = spots[i % spots.length];
        this.game.combat.spawnEnemy(
          this.world.locations.plaza.x + ox,
          this.world.locations.plaza.z + oz,
        );
      }
    }
    if (mission.wanted) this.game.setWanted(mission.wanted, 'mission heat');
    this.game.showMissionCard(mission.title, mission.briefing);
    this.game.hud.setObjective(mission.objective);
  }

  setTarget(pos) {
    this.targetPos = pos.clone();
    this.clearBeacon();
    const geo = new THREE.CylinderGeometry(1.6, 1.6, 60, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd23a,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.beacon = new THREE.Mesh(geo, mat);
    this.beacon.position.set(pos.x, 30, pos.z);
    this.scene.add(this.beacon);
    this.beaconLight = new THREE.PointLight(0xffd23a, 40, 40);
    this.beaconLight.position.set(pos.x, 4, pos.z);
    this.scene.add(this.beaconLight);
    const ringGeo = new THREE.RingGeometry(2.2, 3, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd23a,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });
    this.ring = new THREE.Mesh(ringGeo, ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(pos.x, 0.4, pos.z);
    this.scene.add(this.ring);
  }

  clearBeacon() {
    if (this.beacon) this.scene.remove(this.beacon);
    if (this.beaconLight) this.scene.remove(this.beaconLight);
    if (this.ring) this.scene.remove(this.ring);
    this.beacon = null;
    this.beaconLight = null;
    this.ring = null;
  }

  completeMission() {
    const mission = this.current;
    if (!mission) return;
    this.game.money += mission.reward;
    this.game.save.missionsDone += 1;
    this.game.audio.missionDone();
    this.game.showCenterMessage(`MISSION PASSED — +$${mission.reward}`, 2600);
    this.game.toast(`${mission.title} complete. $${mission.reward} earned.`);
    this.clearBeacon();
    this.game.combat.clearEnemies();
    this.active = false;
    this.index += 1;
    this.game.save.missionIndex = this.index;
    this.game.persistSave();
    if (this.storyComplete) {
      this.game.save.storyComplete = true;
      this.game.persistSave();
      this.game.storyComplete();
    } else {
      setTimeout(() => this.start(this.index), 2200);
    }
  }

  update(dt, playerPos, playerCar) {
    if (!this.active || !this.current || !this.targetPos) return;
    if (this.beacon) this.beacon.rotation.y += dt * 0.8;
    if (this.ring) {
      const s = 1 + Math.sin(this.timer * 3) * 0.12;
      this.ring.scale.set(s, s, 1);
    }
    this.timer += dt;
    const mission = this.current;
    const dist = Math.hypot(playerPos.x - this.targetPos.x, playerPos.z - this.targetPos.z);

    if (mission.id === 'pickup') {
      if (dist < 6 && playerCar) this.completeMission();
      return;
    }
    if (mission.id === 'hotwheels') {
      if (dist < 7 && playerCar) this.completeMission();
      return;
    }
    if (mission.id === 'streetheat') {
      if (this.game.combat.aliveCount() === 0) this.completeMission();
      return;
    }
    if (mission.id === 'getaway') {
      if (this.game.wanted === 0 && dist < 8) this.completeMission();
      return;
    }
    if (mission.id === 'bigscore') {
      if (this.stage === 'go') {
        if (dist < 5 && !playerCar) {
          // On foot at the bank: grabbing the cash takes a few seconds.
          this.grabTimer += dt;
          this.game.hud.setObjective('Grabbing the cash… stay in the vault!');
          if (this.grabTimer > 3) {
            this.stage = 'escape';
            this.game.toast('Cash grabbed! Get to the hideout!');
            this.game.audio.pickup();
            this.setTarget(this.world.locations[mission.escapeTarget]);
            this.game.hud.setObjective('Escape to the hideout');
          }
        } else {
          this.grabTimer = 0;
        }
        return;
      }
      if (dist < 8) this.completeMission();
    }
  }
}
