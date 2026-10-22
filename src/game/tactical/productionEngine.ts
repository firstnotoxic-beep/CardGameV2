import {
  TacticalGameState,
  TacticalStructureInstance,
  ProductionQueueItem,
  TacticalUnitInstance,
} from '../../types/tactical';
import { getCoordKey } from './mapEngine';
import { createTacticalUnitFromBlueprint, TACTICAL_BLUEPRINTS } from './tacticalUnits';
import { soundFx } from '../../utils/audio';

/**
 * Queues a unit for production at a structure (HQ or Factory)
 */
export function queueUnitProduction(
  structureId: string,
  blueprintId: string,
  owner: 'player1' | 'player2',
  state: TacticalGameState
): { nextState: TacticalGameState; success: boolean; reason?: string } {
  const next = JSON.parse(JSON.stringify(state)) as TacticalGameState;
  const structure = next.structures[structureId];
  const bp = TACTICAL_BLUEPRINTS[blueprintId];

  if (!structure) return { nextState: next, success: false, reason: 'ไม่พบสิ่งปลูกสร้างนี้' };
  if (structure.owner !== owner) return { nextState: next, success: false, reason: 'ไม่ใช่สิ่งปลูกสร้างของคุณ' };
  if (!bp) return { nextState: next, success: false, reason: 'ไม่พบแบบแปลนยูนิตนี้' };

  const playerRes = owner === 'player1' ? next.player1Resources : next.player2Resources;

  // Check Command Cap / Population limit
  const currentUnitsCount = Object.values(next.units).filter((u) => u.owner === owner).length;
  const queuedCount = next.productionQueue.filter((q) => q.owner === owner).length;
  if (currentUnitsCount + queuedCount >= playerRes.commandCap) {
    return { nextState: next, success: false, reason: `ขีดจำกัดกำลังพลเต็ม (${playerRes.commandCap} หน่วย)` };
  }

  // Check Resource Costs
  if (playerRes.charge < bp.cost.charge) {
    return { nextState: next, success: false, reason: `พลังงาน Charge ไม่เพียงพอ (ต้องการ ${bp.cost.charge})` };
  }
  if ((bp.cost.rift || 0) > playerRes.rift) {
    return { nextState: next, success: false, reason: `คริสตัล Rift ไม่เพียงพอ (ต้องการ ${bp.cost.rift})` };
  }
  if ((bp.cost.resolve || 0) > playerRes.resolve) {
    return { nextState: next, success: false, reason: `เจตจำนง Resolve ไม่เพียงพอ (ต้องการ ${bp.cost.resolve})` };
  }

  // Deduct resources
  playerRes.charge -= bp.cost.charge;
  if (bp.cost.rift) playerRes.rift -= bp.cost.rift;
  if (bp.cost.resolve) playerRes.resolve -= bp.cost.resolve;

  const queueItem: ProductionQueueItem = {
    id: `queue-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    unitDefId: bp.id,
    name: bp.name,
    owner,
    buildingId: structure.id,
    turnsRemaining: bp.buildTurns,
    totalTurns: bp.buildTurns,
    cost: bp.cost,
    artwork: bp.artwork,
  };

  next.productionQueue.push(queueItem);
  next.combatLog.unshift(`🏭 [สายการผลิต] ${structure.name} เริ่มสร้าง ${bp.name} (ใช้เวลา ${bp.buildTurns} เทิร์น)`);
  soundFx.playDeploy();

  return { nextState: next, success: true };
}

/**
 * Finds a valid free adjacent cell next to the building to spawn the unit
 */
function findValidSpawnCell(
  structure: TacticalStructureInstance,
  cells: TacticalGameState['cells'],
  units: Record<string, TacticalUnitInstance>,
  mapWidth: number,
  mapHeight: number
): { x: number; y: number } | null {
  // Search radius 1, then radius 2
  for (let r = 1; r <= 2; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx === 0 && dy === 0) continue;
        const sx = structure.x + dx;
        const sy = structure.y + dy;

        if (sx < 0 || sx >= mapWidth || sy < 0 || sy >= mapHeight) continue;

        const key = getCoordKey(sx, sy);
        const cell = cells[key];
        if (!cell) continue;

        // Must be passable terrain and not occupied
        if (cell.movementCost < 900 && !cell.structureId && !cell.unitId) {
          const unitOccupying = Object.values(units).some((u) => u.x === sx && u.y === sy);
          if (!unitOccupying) {
            return { x: sx, y: sy };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Advances production queues and deploys finished units
 */
export function advanceProductionPhase(
  owner: 'player1' | 'player2',
  state: TacticalGameState
): { nextState: TacticalGameState; spawnedUnits: TacticalUnitInstance[] } {
  const next = JSON.parse(JSON.stringify(state)) as TacticalGameState;
  const spawnedUnits: TacticalUnitInstance[] = [];
  const remainingQueue: ProductionQueueItem[] = [];

  for (const item of next.productionQueue) {
    if (item.owner === owner) {
      item.turnsRemaining -= 1;
      if (item.turnsRemaining <= 0) {
        // Ready to deploy!
        const structure = next.structures[item.buildingId];
        if (structure) {
          const spawnLoc = findValidSpawnCell(structure, next.cells, next.units, next.mapWidth, next.mapHeight);
          if (spawnLoc) {
            const newUnit = createTacticalUnitFromBlueprint(item.unitDefId, owner, spawnLoc.x, spawnLoc.y);
            // Spawned units have 0 AP this turn (or partial AP) to prevent instant surprise rush
            newUnit.currentAP = 2;
            next.units[newUnit.id] = newUnit;
            next.cells[getCoordKey(spawnLoc.x, spawnLoc.y)].unitId = newUnit.id;
            spawnedUnits.push(newUnit);
            next.combatLog.unshift(`⭐ [ส่งกำลังรบ] ${newUnit.name} ประจำการสำเร็จที่พิกัด (${spawnLoc.x}, ${spawnLoc.y})`);
            continue;
          } else {
            // Blocked, delay by 1 turn
            item.turnsRemaining = 1;
            next.combatLog.unshift(`⚠️ [จุดปล่อยพลติดขัด] ไม่พบพื้นที่ว่างรอบ ${structure.name} สำหรับส่ง ${item.name}`);
          }
        }
      }
    }
    remainingQueue.push(item);
  }

  next.productionQueue = remainingQueue;
  return { nextState: next, spawnedUnits };
}

/**
 * Resolves resource generation from HQ, structures, and captured strategic points
 */
export function resolveResourceEconomy(
  owner: 'player1' | 'player2',
  state: TacticalGameState
): TacticalGameState {
  const next = JSON.parse(JSON.stringify(state)) as TacticalGameState;
  const playerRes = owner === 'player1' ? next.player1Resources : next.player2Resources;

  // Base passive income
  let chargeIncome = 5;
  let riftIncome = 1;
  let resolveIncome = 0;

  // Structures income
  for (const struct of Object.values(next.structures)) {
    if (struct.owner === owner && struct.currentHealth > 0 && struct.resourceIncome) {
      chargeIncome += struct.resourceIncome.charge || 0;
      riftIncome += struct.resourceIncome.rift || 0;
      resolveIncome += struct.resourceIncome.resolve || 0;
    }
  }

  // Strategic Objectives income
  for (const cell of Object.values(next.cells)) {
    if (cell.isObjective && cell.objectiveOwner === owner) {
      chargeIncome += 2;
      riftIncome += 1;
    }
  }

  playerRes.charge = Math.min(playerRes.maxCharge, playerRes.charge + chargeIncome);
  playerRes.rift += riftIncome;
  playerRes.resolve += resolveIncome;

  next.combatLog.unshift(`⚡ [เศรษฐกิจเทิร์น] ${owner === 'player1' ? 'ผู้บัญชาการ' : 'ศัตรู'} ได้รับ +${chargeIncome} Charge, +${riftIncome} Rift`);

  return next;
}
