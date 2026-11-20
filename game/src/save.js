// Save game: money, story progress and best stats, in localStorage.
// A save is what the title screen's Continue button reads.
const SAVE_KEY = 'solmar-heat-save-v1';

export function defaultSave() {
  return {
    money: 0,
    missionIndex: 0,
    storyComplete: false,
    bestWanted: 0,
    carsStolen: 0,
    missionsDone: 0,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return { ...defaultSave(), ...parsed };
  } catch {
    return null;
  }
}

export function writeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable (private mode, blocked cookies): play session-only.
  }
}
