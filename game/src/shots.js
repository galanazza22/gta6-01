// Screenshot staging: each ?shot=<name> plays the real game forward from a
// fresh world for a fixed number of steps with a scripted autopilot, then
// freezes the frame so headless Chromium can capture exactly that moment.
// Nothing here edits pixels — every shot is the game itself, rendered live.
import { mulberry32 } from './rng.js';

function autoInput(overrides) {
  return {
    forward: () => !!overrides.forward,
    back: () => !!overrides.back,
    left: () => !!overrides.left,
    right: () => !!overrides.right,
    down: (code) => !!overrides[code],
    takeMouse: () => ({ dx: 0, dy: 0 }),
    takeClick: () => false,
  };
}

const STEP = 1 / 30;

export function stageShot(game, name, seed) {
  const rand = mulberry32(seed || 7);
  void rand;

  if (name === 'start') {
    // Title screen over a slow orbit of the city.
    game.state = 'title';
    game.hud.showTitle(game.save);
    game.hud.hideHud();
    window.__shotReady = true;
    return;
  }

  game.beginPlay();

  if (name === 'chase') {
    // Cover shot: Deke mid-getaway in a red sedan, three stars, police
    // closing in, the docks job live on the HUD. The run stays on the
    // z=40 road (clear of the plaza) so the car is at speed in the frame.
    const car = game.vehicles.makeCar(-70, 36.8, Math.PI / 2, 0xd23b3b, 'parked');
    game.enterCar(car, { silent: true });
    game.missions.start(1);
    game.setWanted(3, 'shot');
    // Clear the chase lane of traffic so the getaway is at full speed.
    for (const t of [...game.vehicles.traffic]) {
      if (Math.abs(t.pos.z - 36.8) < 5 && t.pos.x > -80 && t.pos.x < 110) {
        t.dispose(game.scene);
        game.vehicles.traffic = game.vehicles.traffic.filter((c) => c !== t);
        game.vehicles.all = game.vehicles.all.filter((c) => c !== t);
      }
    }
    // Two units already closing in behind the player for the frame.
    for (const [px, pz] of [[-96, 33.6], [-108, 40]]) {
      const cop = game.vehicles.spawnPoliceCar(px, pz);
      cop.heading = Math.PI / 2;
      cop.speed = 22;
    }
    // And one unit coming the other way in the opposing lane, about to
    // meet the chase head-on, so the pursuit reads in a still frame.
    const interceptor = game.vehicles.spawnPoliceCar(30, 43.2);
    interceptor.heading = -Math.PI / 2;
    interceptor.speed = 24;
    game.player.camYaw = -Math.PI / 2;
    game.inputOverride = autoInput({ forward: true });
    // Freeze just as the interceptor meets the chase head-on, so the
    // pursuit reads in a still frame instead of trailing behind it.
    for (let i = 0; i < 65; i += 1) game.step(STEP);
    game.inputOverride = null;
  } else if (name === 'street') {
    // On foot downtown, first job live, traffic and pedestrians around.
    game.missions.start(0);
    game.player.pos.set(-10, 0, 26);
    game.player.heading = Math.PI;
    game.player.camYaw = 0;
    game.inputOverride = autoInput({ forward: true });
    for (let i = 0; i < 55; i += 1) game.step(STEP);
    game.inputOverride = null;
  } else if (name === 'combat') {
    // Plaza shootout: four rivals, Deke aiming down the sights, one round
    // fired right before the freeze so the tracer is in the frame. Deke
    // stands aimed at the rival at (14, 10) so the shot connects.
    game.missions.start(2);
    game.player.pos.set(2, 0, 30);
    game.player.heading = Math.atan2(14 - 2, 10 - 30);
    game.player.camYaw = game.player.heading + Math.PI;
    game.inputOverride = autoInput({});
    for (let i = 0; i < 50; i += 1) game.step(STEP);
    game.inputOverride = null;
    game.combat.shoot(game.camera, game.player.pos);
    game.hud.setAmmo(game.player.ammo, game.player.reserveAmmo);
  } else if (name === 'coast') {
    // Golden-hour drive up the beach road, ocean on the left, three stars.
    game.setTimeOfDay('sunset');
    game.missions.start(3);
    const car = game.vehicles.makeCar(196, -50, 0, 0xe07b39, 'parked');
    game.enterCar(car, { silent: true });
    // A unit driving down the beach toward the player, in the frame ahead.
    const interceptor = game.vehicles.spawnPoliceCar(202, 130);
    interceptor.heading = Math.PI;
    interceptor.speed = 20;
    game.player.camYaw = Math.PI;
    game.inputOverride = autoInput({ forward: true });
    // Freeze before the interceptor reaches the player, so it reads as a
    // unit closing in ahead instead of a bumper filling the lens.
    for (let i = 0; i < 90; i += 1) game.step(STEP);
    game.inputOverride = null;
  } else {
    game.missions.start(0);
  }

  game.frozen = true;
  window.__shotReady = true;
}
