import {
  CardDefinition,
  GameState,
  OutpostState,
  PlayerState,
  StructureInstance,
  TerrainCell,
  UnitInstance,
} from '../types/game';
import { CARD_DATABASE } from '../data/cards';
import { generateEntityId, getCellId } from './battlefield';
import { soundFx } from '../utils/audio';

export interface CombatResult {
  damageDealt: number;
  counterDamageDealt?: number;
  targetDestroyed: boolean;
  attackerDestroyed: boolean;
  baseDamaged?: boolean;
  newBaseHealth?: number;
  logMessage: string;
}

export function executeCombat(
  attacker: UnitInstance,
  targetCellId: string,
  state: GameState
): { nextState: GameState; result: CombatResult } {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const targetCell = next.cells[targetCellId];
  const attackerUnit = next.units[attacker.id];

  if (!targetCell || !attackerUnit) {
    throw new Error('Invalid combat parameters');
  }

  const activePlayer = attacker.owner === 'player1' ? next.player1 : next.player2;
  const defendingPlayer = attacker.owner === 'player1' ? next.player2 : next.player1;

  // 1. Attack against Opponent Main Base Nexus
  if (targetCell.isBaseZone && targetCell.baseOwner !== attacker.owner) {
    const rawDamage = attacker.attack;
    const actualDamage = Math.max(1, rawDamage);
    defendingPlayer.baseHealth = Math.max(0, defendingPlayer.baseHealth - actualDamage);

    attackerUnit.hasAttackedThisTurn = true;
    soundFx.playAttack('kinetic');

    const log = `[ประจัญบาน] ${attacker.name} โจมตีฐานทัพเน็กซัสของ ${defendingPlayer.name} สร้างความเสียหาย ${actualDamage} หน่วย! (ความสมบูรณ์เน็กซัส: ${defendingPlayer.baseHealth}/30)`;
    next.combatLog.unshift(log);

    if (defendingPlayer.baseHealth <= 0) {
      next.winner = attacker.owner;
      next.winReason = `${activePlayer.name} ทำลายฐานทัพเน็กซัสของศัตรูสำเร็จ!`;
      soundFx.playVictory();
    }

    return {
      nextState: next,
      result: {
        damageDealt: actualDamage,
        targetDestroyed: defendingPlayer.baseHealth <= 0,
        attackerDestroyed: false,
        baseDamaged: true,
        newBaseHealth: defendingPlayer.baseHealth,
        logMessage: log,
      },
    };
  }

  // 2. Attack against Enemy Unit
  if (targetCell.unitId) {
    const defender = next.units[targetCell.unitId];
    if (!defender) throw new Error('Target unit not found');

    const coverBonus = targetCell.coverBonus || 0;
    // Check for Fortress Outpost aura
    let fortressBonus = 0;
    const fortressOutpost = Object.values(next.outposts).find(
      (o) => o.type === 'fortress' && o.lane === defender.lane
    );
    if (fortressOutpost && fortressOutpost.owner === defender.owner) {
      fortressBonus = 2;
    }

    const totalDefense = defender.defense + coverBonus + fortressBonus;
    const damageDealt = Math.max(1, attacker.attack - totalDefense);

    // Apply damage to defender
    defender.currentHealth = Math.max(0, defender.currentHealth - damageDealt);
    attackerUnit.hasAttackedThisTurn = true;

    // Play attack sound based on unit universe
    if (attacker.universe === 'arcane-dominion') soundFx.playAttack('arcane');
    else if (attacker.universe === 'neo-genesis') soundFx.playAttack('laser');
    else soundFx.playAttack('kinetic');

    let defenderDied = false;
    let attackerDied = false;
    let counterDamage = 0;

    let log = `[ประจัญบาน] ${attacker.name} เข้าโจมตี ${defender.name} สร้างความเสียหาย ${damageDealt} DMG (HP: ${defender.currentHealth}/${defender.maxHealth})`;

    if (defender.currentHealth <= 0) {
      defenderDied = true;
      delete next.units[defender.id];
      targetCell.unitId = null;
      log += ` - ${defender.name} ถูกทำลายสิ้นซาก!`;
    } else {
      // Counter-attack if defender is within range
      const rowDist = Math.abs(defender.row - attacker.row);
      const colDist = Math.abs(defender.col - attacker.col);
      const dist = rowDist + colDist;

      if (dist <= defender.range) {
        const attackerCell = next.cells[getCellId(attacker.row, attacker.col)];
        const attackerCover = attackerCell?.coverBonus || 0;
        counterDamage = Math.max(1, defender.attack - (attacker.defense + attackerCover));
        attackerUnit.currentHealth = Math.max(0, attackerUnit.currentHealth - counterDamage);
        log += ` | โต้กลับ: ${defender.name} ยิงสวนกลับ ${counterDamage} DMG (HP: ${attackerUnit.currentHealth}/${attackerUnit.maxHealth})`;

        if (attackerUnit.currentHealth <= 0) {
          attackerDied = true;
          delete next.units[attacker.id];
          if (attackerCell) attackerCell.unitId = null;
          log += ` - ${attacker.name} ถูกทำลายจากการยิงตอบโต้!`;
        }
      }
    }

    next.combatLog.unshift(log);

    return {
      nextState: next,
      result: {
        damageDealt,
        counterDamageDealt: counterDamage,
        targetDestroyed: defenderDied,
        attackerDestroyed: attackerDied,
        logMessage: log,
      },
    };
  }

  // 3. Attack against Enemy Structure (e.g. Airbase, Bunker)
  if (targetCell.structureId) {
    const structure = next.structures[targetCell.structureId];
    if (!structure) throw new Error('Structure not found');

    const damageDealt = Math.max(1, attacker.attack - structure.defense);
    structure.currentHealth = Math.max(0, structure.currentHealth - damageDealt);
    attackerUnit.hasAttackedThisTurn = true;
    soundFx.playAttack('kinetic');

    let destroyed = false;
    let log = `[ประจัญบาน] ${attacker.name} ระดมยิงสิ่งปลูกสร้าง ${structure.name} สร้างความเสียหาย ${damageDealt} DMG (${structure.currentHealth}/${structure.maxHealth} HP)`;

    if (structure.currentHealth <= 0) {
      destroyed = true;
      delete next.structures[structure.id];
      targetCell.structureId = null;
      log += ` - ${structure.name} พังทลายลงแล้ว!`;
    }

    next.combatLog.unshift(log);

    return {
      nextState: next,
      result: {
        damageDealt,
        targetDestroyed: destroyed,
        attackerDestroyed: false,
        logMessage: log,
      },
    };
  }

  throw new Error('No valid target at destination cell');
}

// Outpost Capture Progression Logic
export function resolveOutpostCaptures(state: GameState): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;

  for (let c = 0; c < 3; c++) {
    const outpost = next.outposts[`outpost-${c}`];
    const outpostCell = next.cells[getCellId(3, c)];
    if (!outpost || !outpostCell) continue;

    const occupyingUnit = outpostCell.unitId ? next.units[outpostCell.unitId] : null;

    if (!occupyingUnit || !occupyingUnit.canCapture) {
      // If unoccupied or non-capturing unit, state remains as is
      continue;
    }

    const occupyingOwner = occupyingUnit.owner;

    // Check if contested: Is there an enemy unit on the outpost or in flanking adjacent row (Row 2 or 4 in same lane)?
    const northCell = next.cells[getCellId(2, c)];
    const southCell = next.cells[getCellId(4, c)];
    const northUnit = northCell?.unitId ? next.units[northCell.unitId] : null;
    const southUnit = southCell?.unitId ? next.units[southCell.unitId] : null;

    const enemyThreat =
      (northUnit && northUnit.owner !== occupyingOwner) ||
      (southUnit && southUnit.owner !== occupyingOwner);

    outpost.isContested = !!enemyThreat;

    // Supply/Relay outposts are captured instantly by moving onto them (see captureOutpostOnMove).
    // Only the Fortress uses turn-based capture, and progress pauses while contested.
    if (outpost.type !== 'fortress') continue;
    if (outpost.isContested && outpost.owner !== occupyingOwner) continue;

    if (outpost.owner === occupyingOwner) {
      // Already owned by this player
      outpost.captureProgress = 100;
    } else if (outpost.owner !== null && outpost.owner !== occupyingOwner) {
      // Owned by enemy: neutralise first
      outpost.captureProgress -= 50;
      if (outpost.captureProgress <= 0) {
        outpost.owner = null;
        outpost.captureProgress = 0;
        outpost.capturingPlayer = occupyingOwner;
        next.combatLog.unshift(`[ยึดฐาน] ${occupyingUnit.name} ได้ทำให้ ${outpost.name} กลายเป็นกลาง!`);
        soundFx.playCapture();
      }
    } else {
      // Neutral outpost: capture progress increases
      outpost.capturingPlayer = occupyingOwner;
      outpost.captureProgress += 50;
      if (outpost.captureProgress >= 100) {
        outpost.owner = occupyingOwner;
        outpost.captureProgress = 100;
        const ownerName = occupyingOwner === 'player1' ? next.player1.name : next.player2.name;
        next.combatLog.unshift(`[ยึดฐาน] ★ ${ownerName} ยึดครอง ${outpost.name} ได้สำเร็จ!`);
        soundFx.playCapture();
      }
    }
  }

  return next;
}

// Economy Phase: Resolve resource income from turn & controlled outposts
export function resolveEconomyIncome(state: GameState, player: 'player1' | 'player2'): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const p = player === 'player1' ? next.player1 : next.player2;

  // Base income: Increase max charge by +1 (up to 10), fill charge to max
  p.resources.maxCharge = Math.min(10, p.resources.maxCharge + 1);
  p.resources.charge = p.resources.maxCharge;

  // Regenerate +1 Resolve (up to 5)
  p.resources.resolve = Math.min(5, p.resources.resolve + 1);

  // Check controlled outposts:
  const supplyOutpost = next.outposts['outpost-0'];
  if (supplyOutpost && supplyOutpost.owner === player && !supplyOutpost.isContested) {
    p.resources.charge = Math.min(10, p.resources.charge + 1);
    next.combatLog.unshift(`[เศรษฐกิจ] ฐานส่งกำลังบำรุงมอบ +1 Charge ให้แก่ ${p.name}!`);
  }

  const relayOutpost = next.outposts['outpost-2'];
  if (relayOutpost && relayOutpost.owner === player && !relayOutpost.isContested) {
    p.resources.rift = Math.min(10, p.resources.rift + 1);
    next.combatLog.unshift(`[เศรษฐกิจ] ฐานรีเลย์ส่งมอบ +1 Rift ให้แก่ ${p.name}!`);
  }

  return next;
}

// Deploy Paratroopers via Airbase to an Outpost or Rear zone
export function performAirborneDeployment(
  state: GameState,
  owner: 'player1' | 'player2',
  targetCellId: string
): GameState {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const player = owner === 'player1' ? next.player1 : next.player2;

  // Verify resources: 3 Charge + 1 Rift
  if (player.resources.charge < 3 || player.resources.rift < 1) {
    throw new Error('ทรัพยากรไม่เพียงพอ: ต้องการ 3 Charge และ 1 Rift');
  }

  const targetCell = next.cells[targetCellId];
  if (!targetCell || targetCell.unitId) {
    throw new Error('ช่องเป้าหมายไม่ถูกต้องหรือมียูนิตอื่นอยู่แล้ว');
  }

  player.resources.charge -= 3;
  player.resources.rift -= 1;

  // Create Paratrooper unit
  const cardDef = CARD_DATABASE['IF-05'];
  const unitId = generateEntityId('unit-paratrooper');

  next.units[unitId] = {
    id: unitId,
    cardInstanceId: `inst-${unitId}`,
    definitionId: 'IF-05',
    name: cardDef.name,
    owner,
    universe: cardDef.universe,
    attack: cardDef.attack || 3,
    currentHealth: cardDef.health || 4,
    maxHealth: cardDef.health || 4,
    defense: cardDef.defense || 1,
    movePoints: 1, // Ready to reposition
    maxMove: cardDef.move || 2,
    range: cardDef.range || 1,
    canCapture: true,
    keywords: cardDef.keywords || ['Airborne Drop'],
    statusEffects: [],
    hasMovedThisTurn: false,
    hasAttackedThisTurn: false,
    lane: targetCell.lane,
    row: targetCell.row,
    col: targetCell.col,
  };

  targetCell.unitId = unitId;

  soundFx.playAttack('airborne');
  next.combatLog.unshift(
    `[ทิ้งร่มทางอากาศ] ✈️ ${player.name} ส่งหน่วยพลร่มจู่โจมลงสู่เลน ${targetCell.lane.toUpperCase()} (${targetCellId})!`
  );

  return next;
}
