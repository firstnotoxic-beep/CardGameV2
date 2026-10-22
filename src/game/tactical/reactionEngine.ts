import {
  TacticalGameState,
  TacticalUnitInstance,
  ReactionEvent,
} from '../../types/tactical';
import { hasLineOfSight } from './mapEngine';
import { soundFx } from '../../utils/audio';

export interface ReactionResolutionResult {
  nextState: TacticalGameState;
  reactionsTriggered: ReactionEvent[];
  unitDied: boolean;
}

/**
 * Checks and triggers Overwatch reactions when an enemy unit moves into or through an overwatching unit's range
 */
export function checkAndResolveOverwatch(
  movedUnit: TacticalUnitInstance,
  targetX: number,
  targetY: number,
  state: TacticalGameState
): ReactionResolutionResult {
  const next = JSON.parse(JSON.stringify(state)) as TacticalGameState;
  const currentMovedUnit = next.units[movedUnit.id];
  const reactionsTriggered: ReactionEvent[] = [];
  let unitDied = false;

  if (!currentMovedUnit || currentMovedUnit.currentHealth <= 0) {
    return { nextState: next, reactionsTriggered, unitDied: true };
  }

  // Find all opposing units currently in 'overwatch' stance that have ammo & reactions remaining
  const opposingOwner = currentMovedUnit.owner === 'player1' ? 'player2' : 'player1';
  const overwatchWatchers = Object.values(next.units).filter(
    (u) =>
      u.owner === opposingOwner &&
      u.stance === 'overwatch' &&
      u.currentAmmo > 0 &&
      u.currentHealth > 0 &&
      u.reactionsUsedThisTurn < 1 // Loop & spam protection: max 1 overwatch per turn
  );

  for (const watcher of overwatchWatchers) {
    if (currentMovedUnit.currentHealth <= 0) {
      unitDied = true;
      break;
    }

    const dist = Math.abs(watcher.x - targetX) + Math.abs(watcher.y - targetY);
    if (dist >= watcher.minRange && dist <= watcher.range) {
      // Check Line of Sight
      if (hasLineOfSight(watcher.x, watcher.y, targetX, targetY, next.cells)) {
        // Overwatch Intercept Triggers!
        watcher.currentAmmo = Math.max(0, watcher.currentAmmo - 1);
        watcher.reactionsUsedThisTurn += 1;
        watcher.stance = 'normal'; // Expends overwatch stance

        // Calculate Damage
        const targetCell = next.cells[`${targetX},${targetY}`];
        const cover = targetCell ? targetCell.coverDefense : 0;
        const totalDefense = currentMovedUnit.defense + cover;
        const damage = Math.max(1, watcher.attack - Math.floor(totalDefense / 2));

        currentMovedUnit.currentHealth = Math.max(0, currentMovedUnit.currentHealth - damage);
        soundFx.playAttack('kinetic');

        const event: ReactionEvent = {
          id: `reaction-ow-${Date.now()}-${Math.random()}`,
          type: 'overwatch-intercept',
          sourceUnitId: watcher.id,
          targetUnitId: currentMovedUnit.id,
          triggerX: targetX,
          triggerY: targetY,
          damageDealt: damage,
          targetDestroyed: currentMovedUnit.currentHealth <= 0,
          timestamp: Date.now(),
          message: `⚡ [ปฏิกิริยาดักยิง Overwatch] ${watcher.name} ดักยิงสกัด ${currentMovedUnit.name} สร้างความเสียหาย ${damage} หน่วย!`,
        };

        reactionsTriggered.push(event);
        next.reactionLog.unshift(event);
        next.combatLog.unshift(event.message);

        if (currentMovedUnit.currentHealth <= 0) {
          unitDied = true;
          // Free cell occupied by dead unit
          const oldCell = next.cells[`${currentMovedUnit.x},${currentMovedUnit.y}`];
          if (oldCell && oldCell.unitId === currentMovedUnit.id) {
            oldCell.unitId = null;
          }
          delete next.units[currentMovedUnit.id];
          break;
        }
      }
    }
  }

  return { nextState: next, reactionsTriggered, unitDied };
}

/**
 * Resolves Defender's Counter-Attack retaliation if attacker is within range and defender survives
 */
export function resolveCounterAttack(
  defender: TacticalUnitInstance,
  attacker: TacticalUnitInstance,
  state: TacticalGameState
): { nextState: TacticalGameState; reaction?: ReactionEvent } {
  const next = JSON.parse(JSON.stringify(state)) as TacticalGameState;
  const currentDefender = next.units[defender.id];
  const currentAttacker = next.units[attacker.id];

  if (!currentDefender || !currentAttacker) return { nextState: next };
  if (currentDefender.currentHealth <= 0 || currentDefender.currentAmmo <= 0) return { nextState: next };
  if (currentDefender.reactionsUsedThisTurn >= 1) return { nextState: next }; // Cycle protection: max 1 counter-attack

  const dist = Math.abs(currentDefender.x - currentAttacker.x) + Math.abs(currentDefender.y - currentAttacker.y);
  if (dist < currentDefender.minRange || dist > currentDefender.range) return { nextState: next };

  // Check Line of Sight
  if (!hasLineOfSight(currentDefender.x, currentDefender.y, currentAttacker.x, currentAttacker.y, next.cells)) {
    return { nextState: next };
  }

  // Trigger Retaliation
  currentDefender.currentAmmo = Math.max(0, currentDefender.currentAmmo - 1);
  currentDefender.reactionsUsedThisTurn += 1;

  const attackerCell = next.cells[`${currentAttacker.x},${currentAttacker.y}`];
  const cover = attackerCell ? attackerCell.coverDefense : 0;
  const defenseTotal = currentAttacker.defense + cover;
  // Counter-attacks deal 75% baseline damage
  const rawDamage = Math.floor(currentDefender.attack * 0.75);
  const damage = Math.max(1, rawDamage - Math.floor(defenseTotal / 2));

  currentAttacker.currentHealth = Math.max(0, currentAttacker.currentHealth - damage);

  const event: ReactionEvent = {
    id: `reaction-counter-${Date.now()}`,
    type: 'counter-attack',
    sourceUnitId: currentDefender.id,
    targetUnitId: currentAttacker.id,
    triggerX: currentAttacker.x,
    triggerY: currentAttacker.y,
    damageDealt: damage,
    targetDestroyed: currentAttacker.currentHealth <= 0,
    timestamp: Date.now(),
    message: `🛡️ [สวนกลับ Counter-Attack] ${currentDefender.name} ยิงสวนกลับใส่ ${currentAttacker.name} สร้างความเสียหาย ${damage} หน่วย!`,
  };

  next.reactionLog.unshift(event);
  next.combatLog.unshift(event.message);

  if (currentAttacker.currentHealth <= 0) {
    const atkCell = next.cells[`${currentAttacker.x},${currentAttacker.y}`];
    if (atkCell && atkCell.unitId === currentAttacker.id) {
      atkCell.unitId = null;
    }
    delete next.units[currentAttacker.id];
  }

  return { nextState: next, reaction: event };
}
