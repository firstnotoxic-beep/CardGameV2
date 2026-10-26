import * as THREE from 'three';
import { TerrainType } from '../../types/game';

// Procedural Canvas Texture Generators with zero external dependencies

/**
 * Creates high-res procedural terrain canvas texture
 */
export function createTerrainTexture(type: TerrainType): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Background base
  switch (type) {
    case 'base-zone': {
      ctx.fillStyle = '#090e17';
      ctx.fillRect(0, 0, 256, 256);
      
      // Cyber hexagonal grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      drawHexGrid(ctx, 256, 256, 24);
      
      // Tech circuit traces
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 6;
      drawCircuitLines(ctx, 256, 256, 8);
      break;
    }
    case 'arcane-ruins': {
      ctx.fillStyle = '#110726';
      ctx.fillRect(0, 0, 256, 256);
      
      // Ancient mystical runes and geometric circle
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 8;
      drawRunicCircle(ctx, 128, 128, 70);
      break;
    }
    case 'nexus-city': {
      ctx.fillStyle = '#061a29';
      ctx.fillRect(0, 0, 256, 256);
      
      // High-tech circuit grid
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      drawGrid(ctx, 256, 256, 32);
      
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 8;
      drawCircuitLines(ctx, 256, 256, 12);
      break;
    }
    case 'frozen-pass': {
      ctx.fillStyle = '#081e28';
      ctx.fillRect(0, 0, 256, 256);
      
      // Crystal ice fractures
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 6;
      drawIceCracks(ctx, 256, 256);
      break;
    }
    case 'ashen-desert': {
      ctx.fillStyle = '#1a0e05';
      ctx.fillRect(0, 0, 256, 256);
      
      // Lava cracks & burnt strata
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ea580c';
      ctx.shadowBlur = 8;
      drawIceCracks(ctx, 256, 256);
      break;
    }
    case 'forest': {
      ctx.fillStyle = '#061f12';
      ctx.fillRect(0, 0, 256, 256);
      
      // Biomechanical vines / growth nodes
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 6;
      drawBioVines(ctx, 256, 256);
      break;
    }
    case 'plains':
    default: {
      ctx.fillStyle = '#0c1524';
      ctx.fillRect(0, 0, 256, 256);
      
      // Sleek tactical arena tile grid with subtle bevel
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      drawGrid(ctx, 256, 256, 32);
      
      // Center tactical crosshair
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(128, 128, 48, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
  }

  // Border frame bevel on each tile
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 252);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, step: number) {
  ctx.beginPath();
  for (let x = step; x < w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = step; y < h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
}

function drawHexGrid(ctx: CanvasRenderingContext2D, w: number, h: number, radius: number) {
  const hexWidth = radius * Math.sqrt(3);
  const hexHeight = radius * 2;
  const vertDist = hexHeight * 0.75;

  for (let y = -radius; y < h + radius; y += vertDist) {
    const isOdd = Math.floor(y / vertDist) % 2 === 1;
    const xOffset = isOdd ? hexWidth / 2 : 0;
    for (let x = -hexWidth; x < w + hexWidth; x += hexWidth) {
      drawHexagon(ctx, x + xOffset, y, radius * 0.9);
    }
  }
}

function drawHexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawCircuitLines(ctx: CanvasRenderingContext2D, w: number, h: number, count: number) {
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const startX = ((i * 37) % w);
    const startY = ((i * 53) % h);
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + 24, startY);
    ctx.lineTo(startX + 48, startY + (i % 2 === 0 ? 24 : -24));
    ctx.lineTo(startX + 80, startY + (i % 2 === 0 ? 24 : -24));
  }
  ctx.stroke();
}

function drawRunicCircle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.arc(cx, cy, r * 0.75, 0, Math.PI * 2);
  ctx.stroke();

  // Internal star/triangle
  for (let i = 0; i < 6; i++) {
    const a1 = (i * Math.PI) / 3;
    const a2 = ((i + 2) * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.75 * Math.cos(a1), cy + r * 0.75 * Math.sin(a1));
    ctx.lineTo(cx + r * 0.75 * Math.cos(a2), cy + r * 0.75 * Math.sin(a2));
    ctx.stroke();
  }
}

function drawIceCracks(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(20, 20);
  ctx.lineTo(80, 70);
  ctx.lineTo(140, 60);
  ctx.lineTo(190, 120);
  ctx.lineTo(240, 110);
  
  ctx.moveTo(140, 60);
  ctx.lineTo(160, 190);
  ctx.lineTo(210, 230);

  ctx.moveTo(80, 70);
  ctx.lineTo(60, 180);
  ctx.lineTo(110, 220);
  ctx.stroke();
}

function drawBioVines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.beginPath();
  ctx.arc(128, 128, 64, 0, Math.PI * 1.5);
  ctx.moveTo(128, 64);
  ctx.bezierCurveTo(160, 80, 180, 140, 220, 160);
  ctx.moveTo(64, 128);
  ctx.bezierCurveTo(80, 180, 140, 200, 180, 240);
  ctx.stroke();
}

/**
 * Creates a floating 3D billboarding tag for Unit stats (Attack / Health / Name)
 */
export function createUnitBillboardTexture(
  name: string,
  attack: number,
  health: number,
  maxHealth: number,
  owner: 'player1' | 'player2',
  statusBadges?: string[]
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const isP1 = owner === 'player1';
  const primaryColor = isP1 ? '#06b6d4' : '#f43f5e';
  const bgColor = isP1 ? 'rgba(8, 24, 40, 0.92)' : 'rgba(40, 8, 16, 0.92)';

  // Rounded container box
  ctx.fillStyle = bgColor;
  roundRect(ctx, 8, 8, 240, 112, 14);
  ctx.fill();

  // Glowing border
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 3;
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 10;
  roundRect(ctx, 8, 8, 240, 112, 14);
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Unit Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const displayName = name.length > 14 ? name.substring(0, 12) + '...' : name;
  ctx.fillText(displayName, 128, 18);

  // Health Bar
  const barX = 24;
  const barY = 46;
  const barW = 208;
  const barH = 10;
  ctx.fillStyle = '#1e293b';
  roundRect(ctx, barX, barY, barW, barH, 5);
  ctx.fill();

  const healthRatio = Math.max(0, Math.min(1, health / (maxHealth || 1)));
  const healthGradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  if (healthRatio > 0.5) {
    healthGradient.addColorStop(0, '#10b981');
    healthGradient.addColorStop(1, '#34d399');
  } else if (healthRatio > 0.25) {
    healthGradient.addColorStop(0, '#f59e0b');
    healthGradient.addColorStop(1, '#fbbf24');
  } else {
    healthGradient.addColorStop(0, '#ef4444');
    healthGradient.addColorStop(1, '#f87171');
  }
  ctx.fillStyle = healthGradient;
  roundRect(ctx, barX, barY, Math.max(8, barW * healthRatio), barH, 5);
  ctx.fill();

  // Attack Badge (Left)
  ctx.fillStyle = '#450a0a';
  roundRect(ctx, 24, 64, 96, 44, 8);
  ctx.fill();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 24, 64, 96, 44, 8);
  ctx.stroke();

  ctx.fillStyle = '#fca5a5';
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⚔️ พลัง', 32, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(attack.toString(), 110, 80);

  // Health Badge (Right)
  ctx.fillStyle = '#064e3b';
  roundRect(ctx, 136, 64, 96, 44, 8);
  ctx.fill();
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 136, 64, 96, 44, 8);
  ctx.stroke();

  ctx.fillStyle = '#6ee7b7';
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('💚 เลือด', 144, 70);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${health}/${maxHealth}`, 222, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
