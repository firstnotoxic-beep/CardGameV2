import { GameState, Lane, UnitInstance, StructureInstance } from '../../types/game';
import { getCellId, TOTAL_ROWS } from '../battlefield';
import { soundFx } from '../../utils/audio';

export interface AbilityExecutionResult {
  nextState: GameState;
  success: boolean;
  logMessage: string;
}

export function executeUnitAbility(
  state: GameState,
  sourceUnitId: string,
  abilityIndex: number,
  target?: {
    cellId?: string;
    unitId?: string;
    targetLane?: Lane;
  }
): AbilityExecutionResult {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const unit = next.units[sourceUnitId];

  if (!unit) {
    return { nextState: state, success: false, logMessage: 'ไม่พบยูนิตต้นทาง' };
  }

  // Look up card definition or unit abilities
  const cardDef = next.player1.deck.concat(next.player1.hand, next.player2.deck, next.player2.hand)
    .find((c) => c.definitionId === unit.definitionId);

  // In RIFTBOUND, custom abilities can be looked up or stored on definition
  return { nextState: next, success: true, logMessage: `${unit.name} ใช้ความสามารถพิเศษ` };
}

/**
 * Executes a resolved ability action directly on the game state (deterministic execution)
 */
export function executeResolvedAbility(
  state: GameState,
  ownerId: 'player1' | 'player2',
  sourceName: string,
  actionType: string,
  powerValue: number,
  target: {
    cellId?: string;
    unitId?: string;
    structureId?: string;
    lane?: Lane;
    row?: number;
    col?: number;
  }
): AbilityExecutionResult {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const opponentId = ownerId === 'player1' ? 'player2' : 'player1';
  let logMessage = '';

  const normalizedAction = actionType.toLowerCase().replace(/-/g, '_');

  switch (normalizedAction) {
    case 'heal': {
      // Find target unit or friendly unit in cell
      const uId = target.unitId || (target.cellId ? next.cells[target.cellId]?.unitId : null);
      if (uId && next.units[uId]) {
        const u = next.units[uId];
        const oldHp = u.currentHealth;
        u.currentHealth = Math.min(u.maxHealth, u.currentHealth + powerValue);
        const healed = u.currentHealth - oldHp;
        soundFx.playDeploy();
        logMessage = `[ฟื้นฟู HP] ${sourceName} รักษาพลังชีวิต +${healed} HP ให้แก่ ${u.name} (ปัจจุบัน ${u.currentHealth}/${u.maxHealth})`;
      } else {
        logMessage = `[ฟื้นฟู HP] ${sourceName} ปล่อยคลื่นเยียวยา`;
      }
      break;
    }

    case 'damage':
    case 'deal_damage': {
      const uId = target.unitId || (target.cellId ? next.cells[target.cellId]?.unitId : null);
      if (uId && next.units[uId]) {
        const u = next.units[uId];
        u.currentHealth -= powerValue;
        soundFx.playAttack('laser');
        logMessage = `[จู่โจมฉับพลัน] ${sourceName} ยิงสร้างความเสียหาย ${powerValue} DMG ใส่ ${u.name}!`;

        if (u.currentHealth <= 0) {
          const cId = getCellId(u.row, u.col);
          if (next.cells[cId]) next.cells[cId].unitId = null;
          delete next.units[u.id];
          logMessage += ` — ${u.name} ถูกทำลาย!`;
        }
      } else {
        logMessage = `[จู่โจมฉับพลัน] ${sourceName} โจมตีเป้าหมาย`;
      }
      break;
    }

    case 'shield': {
      const uId = target.unitId || (target.cellId ? next.cells[target.cellId]?.unitId : null);
      if (uId && next.units[uId]) {
        const u = next.units[uId];
        u.defense += Math.min(3, Math.max(1, Math.round(powerValue / 2)));
        u.statusEffects.push({
          type: 'shielded',
          duration: 2,
          value: powerValue,
        });
        soundFx.playDeploy();
        logMessage = `[บาเรียเกราะ] ${sourceName} กางบาเรียเกราะดูดซับความเสียหาย ${powerValue} หน่วยให้ ${u.name}`;
      }
      break;
    }

    case 'push': {
      const uId = target.unitId || (target.cellId ? next.cells[target.cellId]?.unitId : null);
      if (uId && next.units[uId]) {
        const u = next.units[uId];
        // Push 1 row away towards its base
        const pushDir = u.owner === 'player1' ? 1 : -1;
        const newRow = u.row + pushDir;
        if (newRow >= 0 && newRow < TOTAL_ROWS) {
          const targetPushCellId = getCellId(newRow, u.col);
          const pushDestCell = next.cells[targetPushCellId];
          if (pushDestCell && !pushDestCell.unitId && !pushDestCell.structureId) {
            const oldCellId = getCellId(u.row, u.col);
            if (next.cells[oldCellId]) next.cells[oldCellId].unitId = null;
            u.row = newRow;
            pushDestCell.unitId = u.id;
            soundFx.playAttack('kinetic');
            logMessage = `[คลื่นกระแทก] ${sourceName} ผลักกระแทก ${u.name} ให้ถอยร่นไปแถว ${newRow}!`;
          } else {
            // Cannot push due to obstruction, deal shock damage
            u.currentHealth -= 2;
            logMessage = `[คลื่นกระแทก] ${sourceName} ผลัก ${u.name} ชนสิ่งกีดขวาง ได้รับบาดเจ็บ 2 DMG!`;
          }
        }
      }
      break;
    }

    case 'buff':
    case 'stat_buff': {
      const uId = target.unitId || (target.cellId ? next.cells[target.cellId]?.unitId : null);
      if (uId && next.units[uId]) {
        const u = next.units[uId];
        u.attack += powerValue;
        u.movePoints += 1;
        soundFx.playDeploy();
        logMessage = `[เสริมขีดความสามารถ] ${sourceName} เสริมกำลังรบให้ ${u.name} (+${powerValue} ATK, +1 Move)!`;
      }
      break;
    }

    case 'debuff': {
      const uId = target.unitId || (target.cellId ? next.cells[target.cellId]?.unitId : null);
      if (uId && next.units[uId]) {
        const u = next.units[uId];
        u.attack = Math.max(0, u.attack - powerValue);
        u.statusEffects.push({
          type: 'exhausted',
          duration: 1,
        });
        soundFx.playAttack('kinetic');
        logMessage = `[สกัดกั้นพลัง] ${sourceName} รบกวนระบบอาวุธของ ${u.name} ลดทอนพลังโจมตีลง -${powerValue} ATK!`;
      }
      break;
    }

    case 'summon':
    case 'airborne_drop': {
      // Find empty adjacent cell
      if (target.cellId && next.cells[target.cellId] && !next.cells[target.cellId].unitId) {
        const cell = next.cells[target.cellId];
        const tokenId = `token-${ownerId}-${Date.now()}`;
        next.units[tokenId] = {
          id: tokenId,
          cardInstanceId: `inst-${tokenId}`,
          definitionId: 'TOKEN-DRONE',
          name: 'โดรนจู่โจมสนาม (Combat Drone)',
          owner: ownerId,
          universe: 'creators-circle',
          attack: powerValue,
          currentHealth: Math.max(2, powerValue + 1),
          maxHealth: Math.max(2, powerValue + 1),
          defense: 0,
          movePoints: 2,
          maxMove: 2,
          range: 1,
          canCapture: true,
          keywords: ['โดรนสนับสนุน'],
          statusEffects: [],
          hasMovedThisTurn: false,
          hasAttackedThisTurn: false,
          lane: cell.lane,
          row: cell.row,
          col: cell.col,
        };
        cell.unitId = tokenId;
        soundFx.playDeploy();
        logMessage = `[อัญเชิญยูนิตเสริม] ${sourceName} ปล่อยโดรนจู่โจมสนาม (${cell.lane.toUpperCase()} ${target.cellId})!`;
      }
      break;
    }

    case 'deploy_structure':
    case 'repair': {
      if (target.cellId && next.cells[target.cellId] && !next.cells[target.cellId].structureId) {
        const cell = next.cells[target.cellId];
        const structId = `struct-barrier-${ownerId}-${Date.now()}`;
        next.structures[structId] = {
          id: structId,
          cardInstanceId: `inst-${structId}`,
          definitionId: 'STRUCT-BARRIER',
          name: 'บาเรียกีดขวางยุทธวิธี (Tactical Barrier)',
          owner: ownerId,
          universe: 'creators-circle',
          currentHealth: Math.max(3, powerValue),
          maxHealth: Math.max(3, powerValue),
          defense: 2,
          lane: cell.lane,
          row: cell.row,
          col: cell.col,
          structureType: 'bunker',
        };
        cell.structureId = structId;
        soundFx.playDeploy();
        logMessage = `[ติดตั้งโครงสร้าง] ${sourceName} ติดตั้งบาเรียป้องกันสนามรบ (${cell.lane.toUpperCase()} ${target.cellId})!`;
      }
      break;
    }

    case 'area_effect':
    case 'aoe_damage': {
      if (target.cellId && next.cells[target.cellId]) {
        const center = next.cells[target.cellId];
        const affectedCellIds = [
          target.cellId,
          getCellId(Math.max(0, center.row - 1), center.col),
          getCellId(Math.min(TOTAL_ROWS - 1, center.row + 1), center.col),
        ];

        let hits = 0;
        affectedCellIds.forEach((cId) => {
          const c = next.cells[cId];
          if (c && c.unitId && next.units[c.unitId]) {
            const u = next.units[c.unitId];
            if (u.owner === opponentId) {
              u.currentHealth -= powerValue;
              hits++;
              if (u.currentHealth <= 0) {
                c.unitId = null;
                delete next.units[u.id];
              }
            }
          }
        });
        soundFx.playAttack('arcane');
        logMessage = `[ระเบิดคลื่นพลัง] ${sourceName} ปล่อยระเบิดรัศมีวงกว้าง โดนยูนิตศัตรู ${hits} ตัว สร้างดาเมจ ${powerValue} DMG!`;
      }
      break;
    }

    case 'move':
    case 'teleport': {
      const uId = target.unitId;
      if (uId && next.units[uId] && target.cellId && next.cells[target.cellId] && !next.cells[target.cellId].unitId) {
        const u = next.units[uId];
        const dest = next.cells[target.cellId];
        const oldCellId = getCellId(u.row, u.col);
        if (next.cells[oldCellId]) next.cells[oldCellId].unitId = null;
        u.row = dest.row;
        u.col = dest.col;
        u.lane = dest.lane;
        dest.unitId = u.id;
        soundFx.playDeploy();
        logMessage = `[ข้ามมิติ] ${sourceName} วาร์ป ${u.name} ไปยัง (${dest.lane.toUpperCase()} ${target.cellId})!`;
      }
      break;
    }

    default:
      logMessage = `${sourceName} แสดงผลความสามารถ`;
      break;
  }

  next.combatLog.unshift(logMessage);
  return { nextState: next, success: true, logMessage };
}
