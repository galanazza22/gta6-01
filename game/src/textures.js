// Canvas-generated textures. No image files ship with the game: every
// facade, road marking and ground pattern is painted at runtime.
import * as THREE from 'three';
import { mulberry32 } from './rng.js';

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return [canvas, canvas.getContext('2d')];
}

// A building facade: flat colour, a grid of windows, some lit warm, some
// dark, plus a slightly darker ground floor with a shopfront band.
export function facadeTexture(seed, baseColor) {
  const rand = mulberry32(seed);
  const [canvas, ctx] = makeCanvas(128, 256);
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 128, 256);
  // Subtle vertical shading so the face is not perfectly flat.
  const shade = ctx.createLinearGradient(0, 0, 128, 0);
  shade.addColorStop(0, 'rgba(0,0,0,0.18)');
  shade.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  shade.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 128, 256);
  const cols = 4 + Math.floor(rand() * 3);
  const rows = 6 + Math.floor(rand() * 6);
  const cellW = 128 / cols;
  const cellH = 224 / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const lit = rand();
      ctx.fillStyle = lit < 0.22 ? '#ffd98a' : lit < 0.3 ? '#9fd8ff' : '#20242e';
      ctx.fillRect(
        c * cellW + cellW * 0.22,
        8 + r * cellH + cellH * 0.2,
        cellW * 0.56,
        cellH * 0.6,
      );
    }
  }
  // Ground floor: darker band with a bright shopfront strip.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 232, 128, 24);
  ctx.fillStyle = pickShopColor(rand);
  ctx.fillRect(10, 236, 108, 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function pickShopColor(rand) {
  const colors = ['#ff5a5a', '#ffb347', '#4dd0e1', '#ba68c8', '#81c784', '#fff176'];
  return colors[Math.floor(rand() * colors.length)];
}

// Asphalt with a dashed centre line. horizontal=true draws the dashes along
// the canvas X axis (for roads running along X, tiled 25x1); false draws
// them along Y (for roads running along Z, tiled 1x25).
export function roadTexture(horizontal) {
  const [canvas, ctx] = horizontal ? makeCanvas(256, 128) : makeCanvas(128, 256);
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = '#33363d';
  ctx.fillRect(0, 0, W, H);
  // Speckle so the asphalt is not a flat slab.
  const rand = mulberry32(99);
  for (let i = 0; i < 900; i += 1) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(rand() * W, rand() * H, 2, 2);
  }
  ctx.fillStyle = '#e8e8e8';
  if (horizontal) {
    // Edge lines.
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 4, W, 3);
    ctx.fillRect(0, H - 7, W, 3);
    // Dashed centre line along X.
    ctx.fillStyle = '#f5c542';
    for (let x = 0; x < W; x += 64) ctx.fillRect(x + 8, H / 2 - 2, 32, 4);
  } else {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(4, 0, 3, H);
    ctx.fillRect(W - 7, 0, 3, H);
    ctx.fillStyle = '#f5c542';
    for (let y = 0; y < H; y += 64) ctx.fillRect(W / 2 - 2, y + 8, 4, 32);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Pale concrete with expansion joints, for sidewalks and the plaza.
export function concreteTexture() {
  const [canvas, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#b9b3a4';
  ctx.fillRect(0, 0, 128, 128);
  const rand = mulberry32(7);
  for (let i = 0; i < 500; i += 1) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(rand() * 128, rand() * 128, 2, 2);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 126, 126);
  ctx.beginPath();
  ctx.moveTo(64, 0);
  ctx.lineTo(64, 128);
  ctx.moveTo(0, 64);
  ctx.lineTo(128, 64);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Warm sand with a few speckles, for the beach strip.
export function sandTexture() {
  const [canvas, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#e8d5a4';
  ctx.fillRect(0, 0, 128, 128);
  const rand = mulberry32(21);
  for (let i = 0; i < 700; i += 1) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(160,120,60,0.15)';
    ctx.fillRect(rand() * 128, rand() * 128, 2, 2);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A small library of facade variants so the skyline does not repeat one face.
export function buildFacadeLibrary() {
  const palette = ['#d8a06a', '#c97e6b', '#a8b8c4', '#e0cfa8', '#9fb3a4', '#b98a9e', '#7fa3c9', '#d9d9d9'];
  return palette.map((color, i) => facadeTexture(1000 + i * 77, color));
}

// Six flat car-paint colours shared by every vehicle.
export const CAR_PAINTS = [0xd23b3b, 0x2f6fd0, 0xe8b93a, 0x3aa655, 0xe8e8e8, 0x222226, 0xc96fd0, 0xe07b39];
