import { Lane, OutpostState, TerrainCell, TerrainType, UnitInstance } from '../types/game';

export interface MapPreset {
  id: string;
  name: string;
  description: string;
  laneTerrains: { left: TerrainType; center: TerrainType; right: TerrainType };
  specialRules: string;
}

export const MAP_PRESETS: MapPreset[] = [
  {
    id: 'map-forest-frontier',
    name: 'แนวรบพงไพร (Forest Frontier)',
    description: 'ป่าโบราณหนาทึบที่มีที่กำบังสูงในเลนด้านข้าง และช่องทางแม่น้ำเปิดกว้างบริเวณเลนกลาง',
    laneTerrains: { left: 'forest', center: 'plains', right: 'forest' },
    specialRules: 'ช่องป่ามอบเกราะป้องกันที่กำบัง +1 Defense จากการโจมตีระยะไกล',
  },
  {
    id: 'map-frozen-pass',
    name: 'ช่องเขาเยือกแข็ง (Frozen Pass)',
    description: 'ช่องแคบภูเขาน้ำแข็งอันหนาวเหน็บ การเคลื่อนพลผ่านเลนด้านข้างต้องใช้พละกำลังเป็นสองเท่า',
    laneTerrains: { left: 'frozen-pass', center: 'plains', right: 'frozen-pass' },
    specialRules: 'ช่องน้ำแข็งต้องใช้ค่าเคลื่อนที่ 2 Movement ต่อ 1 ก้าว',
  },
  {
    id: 'map-ashen-desert',
    name: 'ทะเลทรายเถ้าถ่าน (Ashen Desert)',
    description: 'ที่ราบแห้งแล้งโล่งกว้าง ปราศจากสิ่งกีดขวาง เหมาะแก่การระดมยิงปืนใหญ่ระยะไกล',
    laneTerrains: { left: 'ashen-desert', center: 'ashen-desert', right: 'ashen-desert' },
    specialRules: 'ยูนิตระยะไกลได้รับระยะยิงเพิ่ม +1 Range เมื่ออยู่บนผืนทรายโล่ง',
  },
  {
    id: 'map-arcane-ruins',
    name: 'ซากโบราณสถานอาร์เคน (Arcane Ruins)',
    description: 'รอยแยกมิติริฟต์ที่แปรปรวนและเสาหินคริสตัลที่สั่นพ้องทั่วทั้งสามเลน',
    laneTerrains: { left: 'arcane-ruins', center: 'plains', right: 'arcane-ruins' },
    specialRules: 'ช่องมนตรามอบ +1 พลังริฟต์ให้แก่ผู้ครอบครองจุดยุทธศาสตร์ใกล้เคียง',
  },
  {
    id: 'map-nexus-city',
    name: 'เมืองเน็กซัสสังหาร (Nexus City Chokepoints)',
    description: 'ซากปรักหักพังของเมืองหลวงไฮเทค บังเกอร์คอนกรีตและตรอกซอกซอยแคบตัดขวาง',
    laneTerrains: { left: 'nexus-city', center: 'nexus-city', right: 'nexus-city' },
    specialRules: 'ที่กำบังในเมืองมอบเกราะป้องกัน +2 Defense จากยูนิตที่ไม่ใช่สายทำลายฐาน',
  },
];

export const LANES: Lane[] = ['left', 'center', 'right'];
export const LANE_COLS: Record<Lane, number> = { left: 0, center: 1, right: 2 };
export const COL_LANES: Record<number, Lane> = { 0: 'left', 1: 'center', 2: 'right' };

// Row 0: Opponent Base (Opponent Nexus at row 0, col 1)
// Row 1: Opponent Rear (Structures / Deploy)
// Row 2: Opponent Mid
// Row 3: Strategic Neutral Frontline (OUTPOSTS: Supply, Fortress, Relay)
// Row 4: Player Mid
// Row 5: Player Rear (Structures / Deploy)
// Row 6: Player Base (Player Nexus at row 6, col 1)
export const TOTAL_ROWS = 7;

export function getCellId(row: number, col: number): string {
  return `cell-${row}-${col}`;
}

export function generateBattlefield(presetId: string = 'map-forest-frontier'): {
  cells: Record<string, TerrainCell>;
  outposts: Record<string, OutpostState>;
} {
  const preset = MAP_PRESETS.find((p) => p.id === presetId) || MAP_PRESETS[0];
  const cells: Record<string, TerrainCell> = {};

  for (let r = 0; r < TOTAL_ROWS; r++) {
    for (let c = 0; c < 3; c++) {
      const lane = COL_LANES[c];
      const cellId = getCellId(r, c);

      let terrainType: TerrainType = 'plains';
      let moveCost = 1;
      let cover = 0;
      let isBase = false;
      let baseOwner: 'player1' | 'player2' | undefined;

      // Base zones
      if (r === 0) {
        terrainType = 'base-zone';
        isBase = true;
        baseOwner = 'player2'; // Opponent
      } else if (r === 6) {
        terrainType = 'base-zone';
        isBase = true;
        baseOwner = 'player1'; // Player
      } else {
        // Lane terrain from preset
        terrainType = preset.laneTerrains[lane];
        if (terrainType === 'forest') {
          cover = 1;
        } else if (terrainType === 'frozen-pass') {
          moveCost = 2;
        } else if (terrainType === 'nexus-city') {
          cover = 1;
        }
      }

      cells[cellId] = {
        id: cellId,
        lane,
        row: r,
        col: c,
        terrainType,
        movementCost: moveCost,
        coverBonus: cover,
        unitId: null,
        structureId: null,
        outpostId: r === 3 ? `outpost-${c}` : null,
        isBaseZone: isBase,
        baseOwner,
      };
    }
  }

  // 3 Outposts in Row 3 (Frontline)
  const outposts: Record<string, OutpostState> = {
    'outpost-0': {
      id: 'outpost-0',
      name: 'ฐานส่งกำลังบำรุง อัลฟ่า (Supply Outpost)',
      type: 'supply',
      lane: 'left',
      row: 3,
      col: 0,
      owner: null,
      captureProgress: 0,
      capturingPlayer: null,
      isContested: false,
      description: 'ผลิต +1 ประจุชาร์จ (Charge) เพิ่มเติมในแต่ละรอบให้แก่ผู้ครอบครอง',
    },
    'outpost-1': {
      id: 'outpost-1',
      name: 'ฐานป้อมปราการ บราโว่ (Fortress Outpost)',
      type: 'fortress',
      lane: 'center',
      row: 3,
      col: 1,
      owner: null,
      captureProgress: 0,
      capturingPlayer: null,
      isContested: false,
      description: 'มอบออร่าเกราะป้องกัน +2 Defense ให้แก่ยูนิตฝ่ายเราทั้งหมดในเลนกลาง',
    },
    'outpost-2': {
      id: 'outpost-2',
      name: 'ฐานรีเลย์มิติ แกมม่า (Relay Outpost)',
      type: 'relay',
      lane: 'right',
      row: 3,
      col: 2,
      owner: null,
      captureProgress: 0,
      capturingPlayer: null,
      isContested: false,
      description: 'ผลิต +1 พลังงานริฟต์ (Rift) เพิ่มเติมในแต่ละรอบ และเสริมพลังความสามารถข้ามมิติ',
    },
  };

  return { cells, outposts };
}

// Pathfinding: Get all reachable cells for a unit using BFS
export function getReachableCells(
  unit: UnitInstance,
  cells: Record<string, TerrainCell>,
  units: Record<string, UnitInstance>
): string[] {
  if (unit.hasMovedThisTurn || unit.movePoints <= 0) return [];

  const reachable = new Set<string>();
  const visitedCosts = new Map<string, number>();

  const startCellId = getCellId(unit.row, unit.col);
  const queue: { row: number; col: number; remainingMove: number }[] = [
    { row: unit.row, col: unit.col, remainingMove: unit.movePoints },
  ];
  visitedCosts.set(startCellId, unit.movePoints);

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Directions: Forward (row-1 for player, row+1 for opponent), Backward, and Lane Switch (left/right cols if row in [2, 3, 4] or flying)
    const neighbors: { r: number; c: number }[] = [
      { r: current.row - 1, c: current.col }, // Forward/North
      { r: current.row + 1, c: current.col }, // Backward/South
    ];

    // Lateral lane transition permitted in mid-battlefield rows (2, 3, 4) or flying units
    if (unit.isFlying || (current.row >= 2 && current.row <= 4)) {
      if (current.col > 0) neighbors.push({ r: current.row, c: current.col - 1 });
      if (current.col < 2) neighbors.push({ r: current.row, c: current.col + 1 });
    }

    for (const next of neighbors) {
      if (next.r < 0 || next.r >= TOTAL_ROWS || next.c < 0 || next.c > 2) continue;

      const neighborId = getCellId(next.r, next.c);
      const targetCell = cells[neighborId];
      if (!targetCell) continue;

      // Cannot move into opponent base unless attacking
      if (targetCell.isBaseZone && targetCell.baseOwner !== unit.owner) {
        // Opponent base can be targeted for attack, not occupied as ordinary cell
        continue;
      }

      // Check occupancy: Cannot enter cell occupied by other friendly or enemy unit unless flying passing through
      const occupant = targetCell.unitId ? units[targetCell.unitId] : null;
      if (occupant && !unit.isFlying) {
        continue; // blocked
      }

      const cost = unit.isFlying ? 1 : targetCell.movementCost;
      const rem = current.remainingMove - cost;

      if (rem >= 0) {
        if (!visitedCosts.has(neighborId) || visitedCosts.get(neighborId)! < rem) {
          visitedCosts.set(neighborId, rem);
          // If destination is empty, it is legally reachable
          if (!targetCell.unitId) {
            reachable.add(neighborId);
          }
          queue.push({ row: next.r, col: next.c, remainingMove: rem });
        }
      }
    }
  }

  return Array.from(reachable);
}

// Attack Targeting: Calculate eligible target cells (enemy units, structures, or enemy base)
export function getAttackableCells(
  unit: UnitInstance,
  cells: Record<string, TerrainCell>,
  units: Record<string, UnitInstance>,
  enemyBaseOwner: 'player1' | 'player2'
): string[] {
  if (unit.hasAttackedThisTurn) return [];

  const targets: string[] = [];
  const range = unit.range || 1;

  for (let r = 0; r < TOTAL_ROWS; r++) {
    for (let c = 0; c < 3; c++) {
      const cellId = getCellId(r, c);
      const cell = cells[cellId];
      if (!cell) continue;

      // Distance calculation: Manhattan distance + lane distance
      const rowDist = Math.abs(r - unit.row);
      const colDist = Math.abs(c - unit.col);
      const totalDist = rowDist + colDist;

      if (totalDist > 0 && totalDist <= range) {
        // Target 1: Enemy Unit
        if (cell.unitId) {
          const targetUnit = units[cell.unitId];
          if (targetUnit && targetUnit.owner !== unit.owner) {
            targets.push(cellId);
            continue;
          }
        }

        // Target 2: Enemy Structure
        if (cell.structureId) {
          targets.push(cellId);
          continue;
        }

        // Target 3: Opponent Main Base (Row 0 for opponent, Row 6 for player)
        if (cell.isBaseZone && cell.baseOwner === enemyBaseOwner) {
          targets.push(cellId);
          continue;
        }
      }
    }
  }

  return targets;
}

// Airborne Drop Valid Cells:
// Can drop onto ANY Outpost cell (row 3) or rear flanking row (row 2 or 4) that is unoccupied!
export function getAirborneLandingCells(
  cells: Record<string, TerrainCell>,
  owner: 'player1' | 'player2'
): string[] {
  const landingCells: string[] = [];

  // Outposts in Row 3 are always valid drop targets if unoccupied
  for (let c = 0; c < 3; c++) {
    const outpostCellId = getCellId(3, c);
    const cell = cells[outpostCellId];
    if (cell && !cell.unitId) {
      landingCells.push(outpostCellId);
    }
  }

  // Also can drop into mid rows 2, 4 (behind frontline)
  const allowedRows = owner === 'player1' ? [3, 4, 2] : [3, 2, 4];
  for (const r of allowedRows) {
    for (let c = 0; c < 3; c++) {
      const cellId = getCellId(r, c);
      const cell = cells[cellId];
      if (cell && !cell.unitId && !landingCells.includes(cellId)) {
        landingCells.push(cellId);
      }
    }
  }

  return landingCells;
}
