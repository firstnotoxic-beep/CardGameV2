import {
  TacticalCell,
  TacticalGameState,
  TacticalTerrainType,
  TacticalStructureInstance,
  TacticalUnitInstance,
  FogVisibility,
} from '../../types/tactical';

export function getCoordKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function parseCoordKey(key: string): { x: number; y: number } {
  const [xStr, yStr] = key.split(',');
  return { x: parseInt(xStr, 10), y: parseInt(yStr, 10) };
}

export interface TerrainProperties {
  name: string;
  movementCost: number;
  coverDefense: number;
  blocksLineOfSight: boolean;
  heightLevel: number;
  color: string;
}

export const TERRAIN_DATA: Record<TacticalTerrainType, TerrainProperties> = {
  plains: {
    name: 'ที่ราบโล่ง (Plains)',
    movementCost: 1,
    coverDefense: 0,
    blocksLineOfSight: false,
    heightLevel: 1,
    color: '#1e293b',
  },
  forest: {
    name: 'ป่าพรางสายตา (Forest)',
    movementCost: 2,
    coverDefense: 1,
    blocksLineOfSight: true,
    heightLevel: 1,
    color: '#064e3b',
  },
  hills: {
    name: 'เนินยุทธศาสตร์ (Hills)',
    movementCost: 2,
    coverDefense: 1,
    blocksLineOfSight: false,
    heightLevel: 2,
    color: '#78350f',
  },
  water: {
    name: 'แม่น้ำลึก (Water)',
    movementCost: 999, // Impassable for ground units
    coverDefense: 0,
    blocksLineOfSight: false,
    heightLevel: 0,
    color: '#0c4a6e',
  },
  road: {
    name: 'ถนนยุทธวิธี (Paved Road)',
    movementCost: 1, // Quick traversal
    coverDefense: 0,
    blocksLineOfSight: false,
    heightLevel: 1,
    color: '#334155',
  },
  building: {
    name: 'ซากปรักหักพัง/อาคาร (Ruins/Urban)',
    movementCost: 2,
    coverDefense: 2,
    blocksLineOfSight: true,
    heightLevel: 1,
    color: '#475569',
  },
  mountain: {
    name: 'ภูเขาหินผา (Mountain Ridge)',
    movementCost: 999, // Completely impassable
    coverDefense: 3,
    blocksLineOfSight: true,
    heightLevel: 3,
    color: '#1f2937',
  },
};

/**
 * Generates map presets for the tactical RTS
 */
export function generateTacticalMap(preset: 'frontline' | 'citadel' | 'glade' = 'frontline'): {
  width: number;
  height: number;
  cells: Record<string, TacticalCell>;
  structures: Record<string, TacticalStructureInstance>;
} {
  const width = preset === 'citadel' ? 12 : 10;
  const height = preset === 'glade' ? 10 : 8;

  const cells: Record<string, TacticalCell> = {};
  const structures: Record<string, TacticalStructureInstance> = {};

  // Base grid fill
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = getCoordKey(x, y);
      let terrain: TacticalTerrainType = 'plains';

      if (preset === 'frontline') {
        // River bisecting horizontally with 2 bridges
        if (y === 3 || y === 4) {
          if (x === 2 || x === 7) {
            terrain = 'road'; // Bridge crossings
          } else {
            terrain = 'water';
          }
        } else if (x === 0 || x === width - 1) {
          terrain = 'forest';
        } else if ((x === 4 || x === 5) && (y === 1 || y === 6)) {
          terrain = 'hills';
        }
      } else if (preset === 'citadel') {
        // Urban ruins and roads
        if (y === 2 || y === 5) {
          terrain = 'road';
        } else if (x === 3 || x === 8) {
          terrain = 'building';
        } else if (x === 5 || x === 6) {
          terrain = y % 2 === 0 ? 'forest' : 'hills';
        }
      } else {
        // Glade
        if ((x + y) % 3 === 0 && x > 1 && x < width - 2) {
          terrain = 'forest';
        } else if (x === 4 && y === 4) {
          terrain = 'hills';
        } else if (x === 0 || x === width - 1) {
          terrain = 'mountain';
        }
      }

      const prop = TERRAIN_DATA[terrain];
      cells[key] = {
        id: key,
        x,
        y,
        terrain,
        movementCost: prop.movementCost,
        coverDefense: prop.coverDefense,
        blocksLineOfSight: prop.blocksLineOfSight,
        heightLevel: prop.heightLevel,
        unitId: null,
        structureId: null,
      };
    }
  }

  // Place Headquarters & Objectives
  // Player 1 HQ (Bottom-Left / Bottom-Center)
  const p1HqKey = getCoordKey(Math.floor(width / 2) - 1, height - 1);
  const p1HqId = 'struct-p1-hq';
  structures[p1HqId] = {
    id: p1HqId,
    name: 'กองบัญชาการเน็กซัส (P1 Nexus HQ)',
    type: 'hq',
    owner: 'player1',
    x: Math.floor(width / 2) - 1,
    y: height - 1,
    maxHealth: 50,
    currentHealth: 50,
    defense: 2,
    visionRange: 5,
    producesCategory: 'all',
    resourceIncome: { charge: 5, rift: 1 },
  };
  cells[p1HqKey].structureId = p1HqId;
  cells[p1HqKey].terrain = 'building';

  // Player 2 HQ (Top-Right / Top-Center)
  const p2HqKey = getCoordKey(Math.floor(width / 2), 0);
  const p2HqId = 'struct-p2-hq';
  structures[p2HqId] = {
    id: p2HqId,
    name: 'กองบัญชาการศัตรู (P2 Enemy HQ)',
    type: 'hq',
    owner: 'player2',
    x: Math.floor(width / 2),
    y: 0,
    maxHealth: 50,
    currentHealth: 50,
    defense: 2,
    visionRange: 5,
    producesCategory: 'all',
    resourceIncome: { charge: 5, rift: 1 },
  };
  cells[p2HqKey].structureId = p2HqId;
  cells[p2HqKey].terrain = 'building';

  // Factory/Barracks
  const p1FactoryKey = getCoordKey(Math.floor(width / 2) + 2, height - 1);
  const p1FactoryId = 'struct-p1-factory';
  structures[p1FactoryId] = {
    id: p1FactoryId,
    name: 'โรงงานสรรพาวุธภาคพื้น (P1 Armory)',
    type: 'factory',
    owner: 'player1',
    x: Math.floor(width / 2) + 2,
    y: height - 1,
    maxHealth: 30,
    currentHealth: 30,
    defense: 1,
    visionRange: 4,
    producesCategory: 'vehicle',
  };
  cells[p1FactoryKey].structureId = p1FactoryId;
  cells[p1FactoryKey].terrain = 'building';

  const p2FactoryKey = getCoordKey(Math.floor(width / 2) - 3, 0);
  const p2FactoryId = 'struct-p2-factory';
  structures[p2FactoryId] = {
    id: p2FactoryId,
    name: 'โรงงานจักรกลศัตรู (P2 Mech Foundry)',
    type: 'factory',
    owner: 'player2',
    x: Math.floor(width / 2) - 3,
    y: 0,
    maxHealth: 30,
    currentHealth: 30,
    defense: 1,
    visionRange: 4,
    producesCategory: 'vehicle',
  };
  cells[p2FactoryKey].structureId = p2FactoryId;
  cells[p2FactoryKey].terrain = 'building';

  // Central Strategic Objective
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  const midKey = getCoordKey(midX, midY);
  cells[midKey].isObjective = true;
  cells[midKey].objectiveOwner = null;
  cells[midKey].objectiveCapturePoints = 0;

  const radarKey = getCoordKey(midX - 2, midY);
  const radarId = 'struct-radar-tower';
  structures[radarId] = {
    id: radarId,
    name: 'หอเรดาร์สังเกตการณ์ (Radar Tower)',
    type: 'radar_tower',
    owner: null,
    x: midX - 2,
    y: midY,
    maxHealth: 25,
    currentHealth: 25,
    defense: 1,
    visionRange: 6,
    resourceIncome: { resolve: 1 },
  };
  cells[radarKey].structureId = radarId;

  return { width, height, cells, structures };
}

/**
 * Bresenham Line of Sight check between two coordinates
 */
export function hasLineOfSight(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  cells: Record<string, TacticalCell>
): boolean {
  if (startX === targetX && startY === targetY) return true;

  const startCell = cells[getCoordKey(startX, startY)];
  const targetCell = cells[getCoordKey(targetX, targetY)];
  if (!startCell || !targetCell) return false;

  const startHeight = startCell.heightLevel;
  const targetHeight = targetCell.heightLevel;

  let x0 = startX;
  let y0 = startY;
  const x1 = targetX;
  const y1 = targetY;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (x0 === x1 && y0 === y1) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }

    // If reached the target cell, stop checking intermediate blocks
    if (x0 === x1 && y0 === y1) break;

    const interKey = getCoordKey(x0, y0);
    const interCell = cells[interKey];
    if (interCell) {
      // Mountains and heavy buildings block LoS unless observer is on a higher hill
      if (interCell.blocksLineOfSight) {
        if (startHeight <= interCell.heightLevel && targetHeight <= interCell.heightLevel) {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Calculates Fog of War visibility map for a player.
 * - 'visible': Cell is within active vision range and line-of-sight of a friendly unit or structure.
 * - 'explored': Cell was visible previously (terrain known), but currently not in active vision.
 * - 'shrouded': Completely hidden (pitch black).
 */
export function computePlayerFogOfWar(
  player: 'player1' | 'player2',
  state: Pick<TacticalGameState, 'mapWidth' | 'mapHeight' | 'cells' | 'units' | 'structures' | 'fogOfWar'>
): Record<string, FogVisibility> {
  const currentFog = state.fogOfWar ? state.fogOfWar[player] : {};
  const updatedFog: Record<string, FogVisibility> = {};

  // First mark all previously 'visible' as 'explored', keeping previously 'explored' as 'explored'
  for (let y = 0; y < state.mapHeight; y++) {
    for (let x = 0; x < state.mapWidth; x++) {
      const key = getCoordKey(x, y);
      const prev = currentFog[key];
      updatedFog[key] = prev === 'visible' || prev === 'explored' ? 'explored' : 'shrouded';
    }
  }

  // Collect all vision sources (friendly units + friendly structures)
  const visionSources: Array<{ x: number; y: number; visionRange: number }> = [];

  for (const unit of Object.values(state.units)) {
    if (unit.owner === player && unit.currentHealth > 0) {
      visionSources.push({
        x: unit.x,
        y: unit.y,
        visionRange: unit.visionRange || 3,
      });
    }
  }

  for (const structure of Object.values(state.structures)) {
    if (structure.owner === player && structure.currentHealth > 0) {
      visionSources.push({
        x: structure.x,
        y: structure.y,
        visionRange: structure.visionRange || 4,
      });
    }
  }

  // Cast vision from each source
  for (const source of visionSources) {
    const r = source.visionRange;
    const minX = Math.max(0, source.x - r);
    const maxX = Math.min(state.mapWidth - 1, source.x + r);
    const minY = Math.max(0, source.y - r);
    const maxY = Math.min(state.mapHeight - 1, source.y + r);

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dist = Math.hypot(px - source.x, py - source.y);
        if (dist <= r) {
          const key = getCoordKey(px, py);
          if (hasLineOfSight(source.x, source.y, px, py, state.cells)) {
            updatedFog[key] = 'visible';
          }
        }
      }
    }
  }

  return updatedFog;
}

/**
 * Calculates reachable cells using Dijkstra's algorithm factoring in terrain AP costs
 */
export function getTacticalReachableCells(
  unit: TacticalUnitInstance,
  cells: Record<string, TacticalCell>,
  units: Record<string, TacticalUnitInstance>,
  mapWidth: number,
  mapHeight: number
): string[] {
  if (unit.currentAP <= 0) return [];

  const startKey = getCoordKey(unit.x, unit.y);
  const costMap: Record<string, number> = { [startKey]: 0 };
  const queue: Array<{ x: number; y: number; cost: number }> = [{ x: unit.x, y: unit.y, cost: 0 }];
  const reachable: string[] = [];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift()!;

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    for (const n of neighbors) {
      if (n.x < 0 || n.x >= mapWidth || n.y < 0 || n.y >= mapHeight) continue;

      const nKey = getCoordKey(n.x, n.y);
      const cell = cells[nKey];
      if (!cell) continue;

      // Check impassable terrain
      if (cell.movementCost >= 900 && !unit.isFlying) continue;

      // Check if blocked by enemy unit (friendly units can be traversed if not stopping on them)
      const existingUnit = Object.values(units).find((u) => u.x === n.x && u.y === n.y && u.id !== unit.id);
      if (existingUnit && existingUnit.owner !== unit.owner) {
        // Enemy unit blocks path
        continue;
      }

      const stepCost = unit.isFlying ? 1 : cell.movementCost;
      const totalCost = current.cost + stepCost;

      if (totalCost <= unit.currentAP) {
        if (costMap[nKey] === undefined || totalCost < costMap[nKey]) {
          costMap[nKey] = totalCost;
          queue.push({ x: n.x, y: n.y, cost: totalCost });

          // Can only stop on empty cells (or friendly structure)
          if (!existingUnit && nKey !== startKey) {
            reachable.push(nKey);
          }
        }
      }
    }
  }

  return Array.from(new Set(reachable));
}

/**
 * Calculates attackable cells based on attack range, minRange, ammo, and Line of Sight
 */
export function getTacticalAttackableCells(
  unit: TacticalUnitInstance,
  cells: Record<string, TacticalCell>,
  units: Record<string, TacticalUnitInstance>,
  structures: Record<string, TacticalStructureInstance>,
  mapWidth: number,
  mapHeight: number,
  playerFog?: Record<string, FogVisibility>
): string[] {
  // Requires at least 2 AP and 1 ammo to attack
  if (unit.currentAP < 2 || unit.currentAmmo <= 0) return [];

  const targets: string[] = [];
  const range = unit.range || 1;
  const minRange = unit.minRange || 1;

  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const dist = Math.abs(dx) + Math.abs(dy); // Manhattan distance for tactical grid
      if (dist < minRange || dist > range) continue;

      const tx = unit.x + dx;
      const ty = unit.y + dy;

      if (tx < 0 || tx >= mapWidth || ty < 0 || ty >= mapHeight) continue;

      const targetKey = getCoordKey(tx, ty);

      // Check Fog of War: Can only target visible cells
      if (playerFog && playerFog[targetKey] !== 'visible') {
        continue;
      }

      // Check Line of Sight
      if (!hasLineOfSight(unit.x, unit.y, tx, ty, cells)) continue;

      // Check for enemy unit or enemy structure
      const targetUnit = Object.values(units).find((u) => u.x === tx && u.y === ty && u.owner !== unit.owner);
      const targetStructure = Object.values(structures).find(
        (s) => s.x === tx && s.y === ty && s.owner !== unit.owner
      );

      if (targetUnit || targetStructure) {
        targets.push(targetKey);
      }
    }
  }

  return targets;
}
