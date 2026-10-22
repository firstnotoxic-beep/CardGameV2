import {
  TacticalGameState,
  TacticalUnitInstance,
  TacticalStructureInstance,
} from '../../types/tactical';
import {
  getCoordKey,
  parseCoordKey,
  computePlayerFogOfWar,
  hasLineOfSight,
  generateTacticalMap,
} from './mapEngine';
import { checkAndResolveOverwatch, resolveCounterAttack } from './reactionEngine';
import { advanceProductionPhase, resolveResourceEconomy } from './productionEngine';
import { tacticalHistory } from './historyEngine';
import { createTacticalUnitFromBlueprint } from './tacticalUnits';
import { soundFx } from '../../utils/audio';

/**
 * Initializes a new tactical RTS game state with balanced starting forces and Fog of War
 */
export function initializeTacticalGame(preset: 'frontline' | 'citadel' | 'glade' = 'frontline'): TacticalGameState {
  const { width, height, cells, structures } = generateTacticalMap(preset);
  const units: Record<string, TacticalUnitInstance> = {};

  // Spawn initial scouting & vanguard units
  // Player 1 Initial Squad (Bottom area)
  const p1Vanguard = createTacticalUnitFromBlueprint('tactical-vanguard-infantry', 'player1', Math.floor(width / 2) - 1, height - 2);
  const p1Drone = createTacticalUnitFromBlueprint('tactical-scout-drone', 'player1', Math.floor(width / 2) + 1, height - 2);
  units[p1Vanguard.id] = p1Vanguard;
  units[p1Drone.id] = p1Drone;
  cells[getCoordKey(p1Vanguard.x, p1Vanguard.y)].unitId = p1Vanguard.id;
  cells[getCoordKey(p1Drone.x, p1Drone.y)].unitId = p1Drone.id;

  // Player 2 Initial Squad (Top area)
  const p2Vanguard = createTacticalUnitFromBlueprint('tactical-vanguard-infantry', 'player2', Math.floor(width / 2), 1);
  const p2Drone = createTacticalUnitFromBlueprint('tactical-scout-drone', 'player2', Math.floor(width / 2) - 2, 1);
  units[p2Vanguard.id] = p2Vanguard;
  units[p2Drone.id] = p2Drone;
  cells[getCoordKey(p2Vanguard.x, p2Vanguard.y)].unitId = p2Vanguard.id;
  cells[getCoordKey(p2Drone.x, p2Drone.y)].unitId = p2Drone.id;

  const initialFogP1 = computePlayerFogOfWar('player1', {
    mapWidth: width,
    mapHeight: height,
    cells,
    units,
    structures,
    fogOfWar: { player1: {}, player2: {} },
  });

  const initialFogP2 = computePlayerFogOfWar('player2', {
    mapWidth: width,
    mapHeight: height,
    cells,
    units,
    structures,
    fogOfWar: { player1: {}, player2: {} },
  });

  const state: TacticalGameState = {
    id: `tactical-match-${Date.now()}`,
    mapWidth: width,
    mapHeight: height,
    turnNumber: 1,
    activePlayerId: 'player1',
    phase: 'player-command',
    cells,
    units,
    structures,
    productionQueue: [],
    fogOfWar: {
      player1: initialFogP1,
      player2: initialFogP2,
    },
    player1Resources: {
      charge: 10,
      maxCharge: 30,
      rift: 3,
      resolve: 2,
      commandCap: 8,
    },
    player2Resources: {
      charge: 10,
      maxCharge: 30,
      rift: 3,
      resolve: 2,
      commandCap: 8,
    },
    selectedUnitId: p1Vanguard.id,
    selectedStructureId: null,
    selectedSkillId: null,
    currentCommandMode: 'idle',
    reachableCellKeys: [],
    attackableCellKeys: [],
    skillTargetCellKeys: [],
    combatLog: [
      '⚔️ [เริ่มสมรภูมิ] RIFTBOUND: Tactical Frontline Nexus เริ่มต้นขึ้นแล้ว!',
      'หมอกสงคราม (Fog of War) ปกคลุมทั่วสนามรบ ใช้โดรนลาดตระเวนและทหารราบเปิดแนวสายตา',
    ],
    reactionLog: [],
    winner: null,
    mode: 'ai-skirmish',
  };

  tacticalHistory.clear();
  tacticalHistory.captureSnapshot(state);

  return state;
}

/**
 * Executes Unit Movement along a grid path with AP deduction and Overwatch trigger checks
 */
export function executeTacticalMove(
  unitId: string,
  targetX: number,
  targetY: number,
  state: TacticalGameState
): TacticalGameState {
  let next = JSON.parse(JSON.stringify(state)) as TacticalGameState;
  const unit = next.units[unitId];

  if (!unit || unit.owner !== next.activePlayerId) return state;

  const targetKey = getCoordKey(targetX, targetY);
  const targetCell = next.cells[targetKey];
  if (!targetCell) return state;

  // Calculate distance & AP cost
  const dist = Math.abs(targetX - unit.x) + Math.abs(targetY - unit.y);
  const moveCost = unit.isFlying ? dist : dist * targetCell.movementCost;

  if (unit.currentAP < moveCost) {
    soundFx.playError();
    return state;
  }

  // Clear previous cell occupation
  const oldCell = next.cells[getCoordKey(unit.x, unit.y)];
  if (oldCell) oldCell.unitId = null;

  // Deduct AP and update position
  unit.currentAP -= moveCost;
  unit.hasMovedThisTurn = true;
  unit.stance = 'normal'; // Moving breaks defensive/overwatch stance

  const prevX = unit.x;
  const prevY = unit.y;
  unit.x = targetX;
  unit.y = targetY;
  targetCell.unitId = unit.id;

  next.combatLog.unshift(`🏃 [เคลื่อนกำลัง] ${unit.name} เคลื่อนพลสู่ (${targetX}, ${targetY}) [ใช้ ${moveCost} AP]`);
  soundFx.playMove();

  // Check objective occupation
  if (targetCell.isObjective && targetCell.objectiveOwner !== unit.owner) {
    targetCell.objectiveCapturePoints = Math.min(100, (targetCell.objectiveCapturePoints || 0) + 50);
    if (targetCell.objectiveCapturePoints >= 100) {
      targetCell.objectiveOwner = unit.owner;
      next.combatLog.unshift(`🚩 [ยึดจุดยุทธศาสตร์] ${unit.name} ยึดครองจุดยุทธศาสตร์กลางสำเร็จ!`);
      soundFx.playCapture();
    }
  }

  // Update Fog of War for active player
  next.fogOfWar[unit.owner] = computePlayerFogOfWar(unit.owner, next);

  // Check and Resolve opposing Overwatch Intercepts
  const owResult = checkAndResolveOverwatch(unit, targetX, targetY, next);
  next = owResult.nextState;

  // Clear command mode
  next.currentCommandMode = 'idle';
  next.reachableCellKeys = [];
  next.attackableCellKeys = [];

  return next;
}

/**
 * Executes a Direct Combat Attack against an enemy unit or structure
 */
export function executeTacticalAttack(
  attackerId: string,
  targetKey: string,
  state: TacticalGameState
): TacticalGameState {
  let next = JSON.parse(JSON.stringify(state)) as TacticalGameState;
  const attacker = next.units[attackerId];

  if (!attacker || attacker.owner !== next.activePlayerId) return state;
  if (attacker.currentAP < 2 || attacker.currentAmmo <= 0) {
    soundFx.playError();
    return state;
  }

  const { x: tx, y: ty } = parseCoordKey(targetKey);
  const targetCell = next.cells[targetKey];
  if (!targetCell) return state;

  const targetUnit = Object.values(next.units).find((u) => u.x === tx && u.y === ty && u.owner !== attacker.owner);
  const targetStructure = Object.values(next.structures).find(
    (s) => s.x === tx && s.y === ty && s.owner !== attacker.owner
  );

  if (!targetUnit && !targetStructure) return state;

  // Deduct AP and Ammo
  attacker.currentAP -= 2;
  attacker.currentAmmo -= 1;
  attacker.hasAttackedThisTurn = true;
  soundFx.playAttack('kinetic');

  if (targetUnit) {
    // Attack against Unit
    const cover = targetCell.coverDefense;
    const effectiveDefense = targetUnit.defense + cover;
    const damage = Math.max(1, attacker.attack - Math.floor(effectiveDefense / 2));

    targetUnit.currentHealth = Math.max(0, targetUnit.currentHealth - damage);
    next.combatLog.unshift(
      `💥 [โจมตี] ${attacker.name} ยิงโจมตี ${targetUnit.name} สร้างความเสียหาย ${damage} หน่วย! (${targetUnit.currentHealth}/${targetUnit.maxHealth} HP)`
    );

    if (targetUnit.currentHealth <= 0) {
      next.combatLog.unshift(`☠️ [ยูนิตถูกทำลาย] ${targetUnit.name} ถูกทำลายสิ้นซาก!`);
      targetCell.unitId = null;
      delete next.units[targetUnit.id];
    } else {
      // Defender Counter-Attack
      const counterResult = resolveCounterAttack(targetUnit, attacker, next);
      next = counterResult.nextState;
    }
  } else if (targetStructure) {
    // Attack against Structure (HQ or Factory)
    const damage = Math.max(1, attacker.attack - targetStructure.defense);
    targetStructure.currentHealth = Math.max(0, targetStructure.currentHealth - damage);

    next.combatLog.unshift(
      `💥 [ถล่มสิ่งปลูกสร้าง] ${attacker.name} ยิงถล่ม ${targetStructure.name} สร้างความเสียหาย ${damage} หน่วย! (${targetStructure.currentHealth}/${targetStructure.maxHealth} HP)`
    );

    if (targetStructure.currentHealth <= 0) {
      targetStructure.currentHealth = 0;
      next.combatLog.unshift(`🔥 [สิ่งปลูกสร้างพังทลาย] ${targetStructure.name} พังทลายลงแล้ว!`);

      // Check Victory Condition if HQ was destroyed
      if (targetStructure.type === 'hq') {
        next.winner = attacker.owner;
        next.winReason = `${attacker.owner === 'player1' ? 'ผู้บัญชาการ (Player 1)' : 'ฝ่ายศัตรู (Player 2)'} ทำลายกองบัญชาการเน็กซัสของศัตรูสำเร็จ!`;
        soundFx.playVictory();
      }
    }
  }

  // Update Fog of War
  next.fogOfWar[attacker.owner] = computePlayerFogOfWar(attacker.owner, next);

  next.currentCommandMode = 'idle';
  next.reachableCellKeys = [];
  next.attackableCellKeys = [];

  return next;
}

/**
 * Reloads unit ammunition
 */
export function executeTacticalReload(unitId: string, state: TacticalGameState): TacticalGameState {
  const next = JSON.parse(JSON.stringify(state)) as TacticalGameState;
  const unit = next.units[unitId];

  if (!unit || unit.owner !== next.activePlayerId) return state;
  if (unit.currentAP < 1) {
    soundFx.playError();
    return state;
  }

  unit.currentAP -= 1;
  unit.currentAmmo = unit.maxAmmo;
  next.combatLog.unshift(`🔄 [บรรจุกระสุน] ${unit.name} บรรจุกระสุนเต็มอัตราศึก (${unit.maxAmmo} นัด)`);

  return next;
}

/**
 * Sets unit into defensive Overwatch Stance
 */
export function toggleOverwatchStance(unitId: string, state: TacticalGameState): TacticalGameState {
  const next = JSON.parse(JSON.stringify(state)) as TacticalGameState;
  const unit = next.units[unitId];

  if (!unit || unit.owner !== next.activePlayerId) return state;
  if (unit.currentAP < 1 || unit.currentAmmo <= 0) {
    soundFx.playError();
    return state;
  }

  unit.currentAP = 0; // Consumes remaining AP to maintain full alertness
  unit.stance = 'overwatch';
  next.combatLog.unshift(`🛡️ [ตั้งแนวระวังภัย Overwatch] ${unit.name} เข้าสู่ท่าเตรียมพร้อมดักยิงสกัดศัตรูทันทีที่ก้าวผ่าน`);

  return next;
}

/**
 * Executes a Unit Tactical Skill (Artillery, Heal, Snipe, Sprint)
 */
export function executeTacticalSkill(
  unitId: string,
  skillId: string,
  targetKey: string,
  state: TacticalGameState
): TacticalGameState {
  const next = JSON.parse(JSON.stringify(state)) as TacticalGameState;
  const unit = next.units[unitId];
  if (!unit || unit.owner !== next.activePlayerId) return state;

  const skill = unit.skills.find((s) => s.id === skillId);
  if (!skill || skill.currentCooldown > 0 || unit.currentAP < skill.apCost) {
    soundFx.playError();
    return state;
  }

  const { x: tx, y: ty } = parseCoordKey(targetKey);

  // Deduct Costs
  unit.currentAP -= skill.apCost;
  if (skill.ammoCost) unit.currentAmmo = Math.max(0, unit.currentAmmo - skill.ammoCost);
  if (skill.manaCost) unit.currentMana = Math.max(0, unit.currentMana - skill.manaCost);
  skill.currentCooldown = skill.cooldown;

  if (skill.skillType === 'artillery-barrage') {
    // AoE damage radius 1
    const blastRadius = skill.areaRadius || 1;
    let hitCount = 0;
    for (let dy = -blastRadius; dy <= blastRadius; dy++) {
      for (let dx = -blastRadius; dx <= blastRadius; dx++) {
        const bx = tx + dx;
        const by = ty + dy;
        const bKey = getCoordKey(bx, by);
        const hitUnit = Object.values(next.units).find((u) => u.x === bx && u.y === by && u.owner !== unit.owner);
        if (hitUnit) {
          const dmg = 8;
          hitUnit.currentHealth = Math.max(0, hitUnit.currentHealth - dmg);
          hitCount++;
          if (hitUnit.currentHealth <= 0) {
            next.cells[bKey].unitId = null;
            delete next.units[hitUnit.id];
          }
        }
      }
    }
    soundFx.playAttack('airborne');
    next.combatLog.unshift(`💣 [ปืนใหญ่ระดมยิง] ${unit.name} ยิงระเบิดถล่มพิกัด (${tx}, ${ty}) โดนยูนิตศัตรู ${hitCount} หน่วย!`);
  } else if (skill.skillType === 'heal-pulse') {
    // Heal friendly units in range
    for (const ally of Object.values(next.units)) {
      if (ally.owner === unit.owner) {
        const dist = Math.abs(ally.x - tx) + Math.abs(ally.y - ty);
        if (dist <= 2) {
          ally.currentHealth = Math.min(ally.maxHealth, ally.currentHealth + 8);
        }
      }
    }
    soundFx.playHeal();
    next.combatLog.unshift(`✨ [คลื่นฟื้นฟู] ${unit.name} ปล่อยคลื่นฟื้นฟูพลังชีวิตให้แก่กองกำลังฝ่ายเดียวกัน!`);
  } else if (skill.skillType === 'sprint') {
    unit.currentAP += 2;
    unit.defense = Math.max(0, unit.defense - 1);
    next.combatLog.unshift(`⚡ [เร่งฝีเท้า] ${unit.name} เร่งฝีเท้าได้รับ +2 AP เพิ่มเติม!`);
  }

  // Update Fog of War
  next.fogOfWar[unit.owner] = computePlayerFogOfWar(unit.owner, next);

  next.currentCommandMode = 'idle';
  next.skillTargetCellKeys = [];
  return next;
}

/**
 * Deterministic Turn Switch executing steps 5, 6, and 7
 */
export function endPlayerTurn(state: TacticalGameState): TacticalGameState {
  let next = JSON.parse(JSON.stringify(state)) as TacticalGameState;
  const currentOwner = next.activePlayerId;
  const nextOwner = currentOwner === 'player1' ? 'player2' : 'player1';

  // Step 5: End-turn cleanup for finishing player
  for (const u of Object.values(next.units)) {
    if (u.owner === currentOwner) {
      u.reactionsUsedThisTurn = 0;
      u.hasMovedThisTurn = false;
      u.hasAttackedThisTurn = false;
      u.skills.forEach((s) => {
        if (s.currentCooldown > 0) s.currentCooldown -= 1;
      });
    }
  }

  // Step 6: Step switch to next player
  next.activePlayerId = nextOwner;
  if (nextOwner === 'player1') {
    next.turnNumber += 1;
  }

  // Step 1 of new player: Reset AP & Status
  for (const u of Object.values(next.units)) {
    if (u.owner === nextOwner) {
      u.currentAP = u.maxAP;
      u.reactionsUsedThisTurn = 0;
      u.hasMovedThisTurn = false;
      u.hasAttackedThisTurn = false;
      // Passive mana recharge
      u.currentMana = Math.min(u.maxMana, u.currentMana + 1);
    }
  }

  // Step 2: Resource Income for new player
  next = resolveResourceEconomy(nextOwner, next);

  // Step 3: Production advancement for new player
  const prodResult = advanceProductionPhase(nextOwner, next);
  next = prodResult.nextState;

  // Update Fog of War for new player
  next.fogOfWar[nextOwner] = computePlayerFogOfWar(nextOwner, next);

  next.combatLog.unshift(`🚩 [สลับเทิร์น] ถึงรอบบัญชาการของ ${nextOwner === 'player1' ? 'ผู้บัญชาการ (Player 1)' : 'ฝ่ายศัตรู (Player 2)'} (เทิร์นที่ ${next.turnNumber})`);

  // Clear selections
  next.selectedUnitId = null;
  next.selectedStructureId = null;
  next.currentCommandMode = 'idle';
  next.reachableCellKeys = [];
  next.attackableCellKeys = [];
  next.skillTargetCellKeys = [];

  // Capture Snapshot for Turn History & Rewind
  tacticalHistory.captureSnapshot(next);

  return next;
}
