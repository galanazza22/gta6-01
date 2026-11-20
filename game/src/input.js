// Keyboard + mouse input with pointer lock. The game reads keys by code
// (KeyW, Space, KeyE ...) so layouts do not matter, and accumulates mouse
// deltas for the third-person camera.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.clicked = false;
    this.locked = false;
    this.onKey = null; // (code) => void, for one-shot keys like E / R / P
    this.onClick = null; // () => void, fired on a mouse press while locked

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.keys.add(event.code);
      if (this.onKey) this.onKey(event.code);
      if (event.code === 'Space') event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
    });
    document.addEventListener('mousemove', (event) => {
      if (!this.locked) return;
      this.mouseDX += event.movementX || 0;
      this.mouseDY += event.movementY || 0;
    });
    document.addEventListener('mousedown', (event) => {
      if (event.button !== 0) return;
      this.mouseDown = true;
      this.clicked = true;
      if (this.locked && this.onClick) this.onClick();
    });
    document.addEventListener('mouseup', (event) => {
      if (event.button === 0) this.mouseDown = false;
    });
  }

  down(code) {
    return this.keys.has(code);
  }

  // Forward held this frame: W or ArrowUp.
  forward() {
    return this.down('KeyW') || this.down('ArrowUp');
  }

  back() {
    return this.down('KeyS') || this.down('ArrowDown');
  }

  left() {
    return this.down('KeyA') || this.down('ArrowLeft');
  }

  right() {
    return this.down('KeyD') || this.down('ArrowRight');
  }

  // Consume the accumulated mouse movement since the last frame.
  takeMouse() {
    const dx = this.mouseDX;
    const dy = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { dx, dy };
  }

  takeClick() {
    const was = this.clicked;
    this.clicked = false;
    return was;
  }

  lock() {
    try {
      const p = this.canvas.requestPointerLock();
      // Headless / gesture-less calls reject asynchronously; swallow it —
      // the game still plays with keys and the camera falls back to follow.
      if (p && p.catch) p.catch(() => {});
    } catch {
      // Pointer lock can fail in an iframe or headless run; the game still
      // plays with keys, and the camera falls back to auto-follow.
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
