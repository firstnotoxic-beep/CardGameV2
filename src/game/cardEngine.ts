import {
  CardDefinition,
  CardInstance,
  GameState,
  Lane,
  PlayerState,
  StructureInstance,
  TerrainCell,
  UnitInstance,
} from '../types/game';
import { CARD_DATABASE } from '../data/cards';
import { getCardDef } from './cardRegistry';
import { executeResolvedAbility } from './rules/abilityExecutor';
import { getCellId, getReachableCells, TOTAL_ROWS } from './battlefield';
import { soundFx } from '../utils/audio';

export interface TargetValidationResult {
  canPlay: boolean;
  reason?: string;
  cardDef?: CardDefinition;
  cardInst?: CardInstance;
  targetType:
    | 'no-target'
    | 'friendly-unit'
    | 'enemy-unit'
    | 'any-unit'
    | 'empty-cell'
    | 'friendly-structure'
    | 'enemy-structure'
    | 'outpost'
    | 'cell-area'
    | 'lane'
    | 'global';
  validCellIds: string[];
  validUnitIds: string[];
  validStructureIds: string[];
  validLanes: Lane[];
}

/**
 * Validates whether a card in hand can be played and calculates all legal targets
 */
export function canPlayCard(
  state: GameState,
  playerId: 'player1' | 'player2',
  cardInstanceId: string
): TargetValidationResult {
  const player = playerId === 'player1' ? state.player1 : state.player2;
  const opponentId = playerId === 'player1' ? 'player2' : 'player1';
  const cardInst = player.hand.find((c) => c.instanceId === cardInstanceId);

  if (!cardInst) {
    return {
      canPlay: false,
      reason: 'ไม่พบการ์ดใบนี้บนมือ',
      targetType: 'no-target',
      validCellIds: [],
      validUnitIds: [],
      validStructureIds: [],
      validLanes: [],
    };
  }

  const def = getCardDef(cardInst.definitionId);
  if (!def) {
    return {
      canPlay: false,
      reason: 'ไม่พบข้อมูลการ์ดในฐานข้อมูล',
      targetType: 'no-target',
      validCellIds: [],
      validUnitIds: [],
      validStructureIds: [],
      validLanes: [],
    };
  }

  // 1. Check Resource Affordability
  const hasCharge = player.resources.charge >= (def.cost.charge || 0);
  const hasRift = player.resources.rift >= (def.cost.rift || 0);
  const hasResolve = player.resources.resolve >= (def.cost.resolve || 0);

  if (!hasCharge || !hasRift || !hasResolve) {
    return {
      canPlay: false,
      reason: `ทรัพยากรไม่เพียงพอ (ต้องการ ${def.cost.charge || 0}⚡${def.cost.rift ? ` + ${def.cost.rift}🌀` : ''})`,
      cardDef: def,
      cardInst,
      targetType: 'no-target',
      validCellIds: [],
      validUnitIds: [],
      validStructureIds: [],
      validLanes: [],
    };
  }

  // Determine targeting mode
  const targetMode = def.targetRule?.mode || (def.cardType === 'unit' || def.cardType === 'structure' ? 'empty-cell' : 'no-target');
  const validCellIds: string[] = [];
  const validUnitIds: string[] = [];
  const validStructureIds: string[] = [];
  const validLanes: Lane[] = ['left', 'center', 'right'];

  // 2. Calculate Legal Targets Based on Mode
  switch (targetMode) {
    case 'friendly-unit': {
      // Must target a friendly unit anywhere on the board
      Object.values(state.units).forEach((u) => {
        if (u.owner === playerId) {
          validUnitIds.push(u.id);
          validCellIds.push(getCellId(u.row, u.col));
        }
      });
      if (validUnitIds.length === 0) {
        return {
          canPlay: false,
          reason: 'ไม่มียูนิตฝ่ายเราในสนามที่เป็นเป้าหมายได้',
          cardDef: def,
          cardInst,
          targetType: targetMode,
          validCellIds: [],
          validUnitIds: [],
          validStructureIds: [],
          validLanes: [],
        };
      }
      break;
    }

    case 'enemy-unit': {
      // Must target an enemy unit anywhere on the board
      Object.values(state.units).forEach((u) => {
        if (u.owner === opponentId) {
          validUnitIds.push(u.id);
          validCellIds.push(getCellId(u.row, u.col));
        }
      });
      if (validUnitIds.length === 0) {
        return {
          canPlay: false,
          reason: 'ไม่มียูนิตศัตรูในสนามที่เป็นเป้าหมายได้',
          cardDef: def,
          cardInst,
          targetType: targetMode,
          validCellIds: [],
          validUnitIds: [],
          validStructureIds: [],
          validLanes: [],
        };
      }
      break;
    }

    case 'any-unit': {
      Object.values(state.units).forEach((u) => {
        validUnitIds.push(u.id);
        validCellIds.push(getCellId(u.row, u.col));
      });
      if (validUnitIds.length === 0) {
        return {
          canPlay: false,
          reason: 'ไม่มียูนิตใดในสนามเป็นเป้าหมายได้',
          cardDef: def,
          cardInst,
          targetType: targetMode,
          validCellIds: [],
          validUnitIds: [],
          validStructureIds: [],
          validLanes: [],
        };
      }
      break;
    }

    case 'empty-cell': {
      // Check deployment zone restrictions or general empty cells
      const isRiftGate = def.id === 'SPELL-RIFT-GATE';
      const isAirborne = def.keywords?.some((k) => k.includes('Airborne') || k.includes('พลร่ม'));

      if (isRiftGate) {
        // Rift gate can open on ANY empty cell across the whole battlefield (excluding base zones)
        for (let r = 1; r < TOTAL_ROWS - 1; r++) {
          for (let c = 0; c < 3; c++) {
            const cellId = getCellId(r, c);
            const cell = state.cells[cellId];
            if (cell && !cell.unitId && !cell.structureId) {
              validCellIds.push(cellId);
            }
          }
        }
      } else if (isAirborne) {
        // Airborne units can land on outposts or mid corridors
        for (let r = 2; r <= 4; r++) {
          for (let c = 0; c < 3; c++) {
            const cellId = getCellId(r, c);
            const cell = state.cells[cellId];
            if (cell && !cell.unitId) {
              validCellIds.push(cellId);
            }
          }
        }
      } else {
        // Standard Unit / Structure Deployment: Base Row & Rear Row
        const allowedRows = playerId === 'player1' ? [6, 5] : [0, 1];
        allowedRows.forEach((r) => {
          [0, 1, 2].forEach((c) => {
            const cellId = getCellId(r, c);
            const cell = state.cells[cellId];
            if (cell && !cell.unitId && !cell.structureId) {
              validCellIds.push(cellId);
            }
          });
        });
      }

      if (validCellIds.length === 0) {
        return {
          canPlay: false,
          reason: 'ไม่มีช่องว่างที่ถูกกฎสำหรับจัดวางกำลังในขณะนี้',
          cardDef: def,
          cardInst,
          targetType: targetMode,
          validCellIds: [],
          validUnitIds: [],
          validStructureIds: [],
          validLanes: [],
        };
      }
      break;
    }

    case 'friendly-structure': {
      Object.values(state.structures).forEach((s) => {
        if (s.owner === playerId) {
          validStructureIds.push(s.id);
          validCellIds.push(getCellId(s.row, s.col));
        }
      });
      if (validStructureIds.length === 0) {
        return {
          canPlay: false,
          reason: 'ไม่มีสิ่งปลูกสร้างฝ่ายเราในสนามสำหรับเสริมพลัง',
          cardDef: def,
          cardInst,
          targetType: targetMode,
          validCellIds: [],
          validUnitIds: [],
          validStructureIds: [],
          validLanes: [],
        };
      }
      break;
    }

    case 'enemy-structure': {
      Object.values(state.structures).forEach((s) => {
        if (s.owner === opponentId) {
          validStructureIds.push(s.id);
          validCellIds.push(getCellId(s.row, s.col));
        }
      });
      if (validStructureIds.length === 0) {
        return {
          canPlay: false,
          reason: 'ไม่มีสิ่งปลูกสร้างของศัตรูในสนาม',
          cardDef: def,
          cardInst,
          targetType: targetMode,
          validCellIds: [],
          validUnitIds: [],
          validStructureIds: [],
          validLanes: [],
        };
      }
      break;
    }

    case 'outpost': {
      // 3 Outposts in Row 3
      [0, 1, 2].forEach((c) => {
        validCellIds.push(getCellId(3, c));
      });
      break;
    }

    case 'cell-area': {
      // Any cell on the battlefield except base zones
      for (let r = 1; r < TOTAL_ROWS - 1; r++) {
        for (let c = 0; c < 3; c++) {
          validCellIds.push(getCellId(r, c));
        }
      }
      break;
    }

    case 'lane': {
      // Valid lanes
      validLanes.push('left', 'center', 'right');
      for (let r = 1; r < TOTAL_ROWS - 1; r++) {
        for (let c = 0; c < 3; c++) {
          validCellIds.push(getCellId(r, c));
        }
      }
      break;
    }

    case 'no-target':
    case 'global':
    default:
      // Can be played directly without targeting
      break;
  }

  return {
    canPlay: true,
    cardDef: def,
    cardInst,
    targetType: targetMode,
    validCellIds,
    validUnitIds,
    validStructureIds,
    validLanes,
  };
}

/**
 * Resolves the playing of a card (deducts resource ONCE, removes from hand, applies effect)
 */
export function resolveCardPlay(
  state: GameState,
  playerId: 'player1' | 'player2',
  cardInstanceId: string,
  target: {
    cellId?: string;
    unitId?: string;
    structureId?: string;
    outpostId?: string;
    lane?: Lane;
  }
): { nextState: GameState; success: boolean; logMessage: string } {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const player = playerId === 'player1' ? next.player1 : next.player2;
  const opponent = playerId === 'player1' ? next.player2 : next.player1;

  const cardInstIdx = player.hand.findIndex((c) => c.instanceId === cardInstanceId);
  if (cardInstIdx === -1) {
    return { nextState: state, success: false, logMessage: 'ไม่พบการ์ดบนมือ' };
  }

  const cardInst = player.hand[cardInstIdx];
  const def = getCardDef(cardInst.definitionId);
  if (!def) {
    return { nextState: state, success: false, logMessage: 'ข้อมูลการ์ดไม่ถูกต้อง' };
  }

  // 1. Deduct Resources EXACTLY ONCE
  player.resources.charge -= def.cost.charge || 0;
  player.resources.rift -= def.cost.rift || 0;
  player.resources.resolve -= def.cost.resolve || 0;

  // 2. Remove Card from Hand & Add to Discard
  player.hand.splice(cardInstIdx, 1);
  cardInst.currentZone = 'discard';
  player.discard.push(cardInst);

  let logMessage = '';

  // 3. Resolve Card by Specific ID or Target Mode
  switch (def.id) {
    case 'SPELL-HEAL': {
      // Healing Pulse: restores 3 health to friendly unit up to maxHealth
      const targetUnitId = target.unitId || (target.cellId ? next.cells[target.cellId]?.unitId : null);
      if (targetUnitId && next.units[targetUnitId] && next.units[targetUnitId].owner === playerId) {
        const u = next.units[targetUnitId];
        const oldHp = u.currentHealth;
        u.currentHealth = Math.min(u.maxHealth, u.currentHealth + 3);
        const diff = u.currentHealth - oldHp;
        soundFx.playDeploy();
        logMessage = `[เวทเยียวยา] ${player.name} ร่ายชีพจรเยียวยา (Healing Pulse) ฟื้นฟูเลือด +${diff} HP ให้แก่ ${u.name} (ปัจจุบัน: ${u.currentHealth}/${u.maxHealth} HP)`;
      } else {
        logMessage = `[เวทเยียวยา] ${player.name} ร่ายชีพจรเยียวยา`;
      }
      break;
    }

    case 'SPELL-BOLT': {
      // Arcane Bolt: deals 4 damage to enemy unit
      const targetUnitId = target.unitId || (target.cellId ? next.cells[target.cellId]?.unitId : null);
      if (targetUnitId && next.units[targetUnitId]) {
        const u = next.units[targetUnitId];
        u.currentHealth -= 4;
        soundFx.playAttack('kinetic');
        logMessage = `[ศรมนตรา] ${player.name} ร่ายศรมนตราอาร์เคน (Arcane Bolt) ยิงสายฟ้าฟาดสร้างความเสียหาย 4 หน่วยแก่ ${u.name}!`;

        if (u.currentHealth <= 0) {
          const cellId = getCellId(u.row, u.col);
          if (next.cells[cellId]) next.cells[cellId].unitId = null;
          delete next.units[u.id];
          logMessage += ` — ${u.name} ถูกทำลายสิ้นซาก!`;
        }
      }
      break;
    }

    case 'SPELL-RIFT-GATE': {
      // Rift Gate: summons Void Vanguard on selected empty cell
      if (target.cellId && next.cells[target.cellId] && !next.cells[target.cellId].unitId) {
        const cell = next.cells[target.cellId];
        const voidUnitId = `void-vanguard-${Date.now()}`;
        next.units[voidUnitId] = {
          id: voidUnitId,
          cardInstanceId: `inst-${voidUnitId}`,
          definitionId: 'SPELL-RIFT-GATE',
          name: 'ผู้บุกเบิกมิติริฟต์ (Void Vanguard)',
          owner: playerId,
          universe: 'arcane-dominion',
          attack: 3,
          currentHealth: 4,
          maxHealth: 4,
          defense: 1,
          movePoints: 2,
          maxMove: 2,
          range: 1,
          canCapture: true,
          keywords: ['อสูรมิติ', 'เทเลพอร์ต'],
          statusEffects: [],
          hasMovedThisTurn: false,
          hasAttackedThisTurn: false,
          lane: cell.lane,
          row: cell.row,
          col: cell.col,
        };
        cell.unitId = voidUnitId;
        soundFx.playDeploy();
        logMessage = `[ประตูมิติ] ${player.name} ร่ายประตูมิติริฟต์ (Rift Gate) อัญเชิญผู้บุกเบิกมิติริฟต์ลงสู่สนาม (${target.cellId})`;
      }
      break;
    }

    case 'SPELL-METEOR': {
      // Meteor Field: deals 3 damage to all units in target cell and adjacent cells
      if (target.cellId && next.cells[target.cellId]) {
        const center = next.cells[target.cellId];
        const affectedCellIds = [
          target.cellId,
          getCellId(Math.max(0, center.row - 1), center.col),
          getCellId(Math.min(TOTAL_ROWS - 1, center.row + 1), center.col),
        ];

        let hitCount = 0;
        affectedCellIds.forEach((cId) => {
          const c = next.cells[cId];
          if (c && c.unitId && next.units[c.unitId]) {
            const u = next.units[c.unitId];
            u.currentHealth -= 3;
            hitCount++;
            if (u.currentHealth <= 0) {
              c.unitId = null;
              delete next.units[u.id];
            }
          }
        });
        soundFx.playAttack('kinetic');
        logMessage = `[ดงอุกกาบาต] ${player.name} สั่งดงอุกกาบาต (Meteor Field) ถล่มบริเวณแถว ${center.row} โดนยูนิต ${hitCount} ตัว สร้างความเสียหาย 3 หน่วย!`;
      }
      break;
    }

    case 'SPELL-BATTLE-CRY': {
      // Battle Cry: gives all friendly units in lane +2 Attack this turn
      const targetLane = target.lane || (target.cellId ? next.cells[target.cellId]?.lane : 'center');
      let buffCount = 0;
      Object.values(next.units).forEach((u) => {
        if (u.owner === playerId && u.lane === targetLane) {
          u.attack += 2;
          buffCount++;
        }
      });
      soundFx.playDeploy();
      logMessage = `[เสียงกู่ร้องศึก] ${player.name} คำรามเสียงกู่ร้องศึก (Battle Cry) เพิ่มพลังโจมตี +2 ATK แก่ยูนิตฝ่ายเรา ${buffCount} ตัวในเลน ${targetLane.toUpperCase()}!`;
      break;
    }

    case 'SPELL-NEXUS-SURGE': {
      // Nexus Surge: restores 4 base health, grants +2 charge
      player.baseHealth = Math.min(player.maxBaseHealth, player.baseHealth + 4);
      player.resources.charge = Math.min(10, player.resources.charge + 2);
      soundFx.playDeploy();
      logMessage = `[เน็กซัสคลื่นทะลัก] ${player.name} ปลดปล่อยเน็กซัสคลื่นทะลัก (Nexus Surge) ฟื้นฟูฐานเน็กซัส +4 HP (${player.baseHealth}/30) และเพิ่ม +2 Charge!`;
      break;
    }

    case 'SPELL-FORTIFY': {
      // Fortify: friendly structure gets +4 HP and +2 DEF
      const structId = target.structureId || (target.cellId ? next.cells[target.cellId]?.structureId : null);
      if (structId && next.structures[structId]) {
        const s = next.structures[structId];
        s.currentHealth += 4;
        s.maxHealth += 4;
        s.defense += 2;
        soundFx.playDeploy();
        logMessage = `[เสริมปราการ] ${player.name} ร่ายเสริมปราการมั่นคง (Fortify) มอบ +4 HP และ +2 DEF แก่ ${s.name}!`;
      }
      break;
    }

    case 'SPELL-OUTPOST-SABOTAGE': {
      // Outpost Sabotage: resets or reduces enemy capture progress in outpost row 3
      if (target.cellId) {
        const cell = next.cells[target.cellId];
        if (cell && cell.outpostId && next.outposts[cell.outpostId]) {
          const outpost = next.outposts[cell.outpostId];
          outpost.captureProgress = Math.max(0, outpost.captureProgress - 50);
          if (cell.unitId && next.units[cell.unitId] && next.units[cell.unitId].owner !== playerId) {
            next.units[cell.unitId].currentHealth -= 2;
            if (next.units[cell.unitId].currentHealth <= 0) {
              const defeated = next.units[cell.unitId];
              cell.unitId = null;
              delete next.units[defeated.id];
            }
          }
          soundFx.playAttack('kinetic');
          logMessage = `[วินาศกรรมฐาน] ${player.name} ก่อวินาศกรรมฐานยุทธศาสตร์ ${outpost.name} ลดทอนการควบคุมลง 50%!`;
        }
      }
      break;
    }

    default: {
      // 4. Standard Unit or Structure Deployment
      if (def.cardType === 'unit' && target.cellId) {
        const cell = next.cells[target.cellId];
        const unitId = `unit-${playerId}-${Date.now()}`;
        next.units[unitId] = {
          id: unitId,
          cardInstanceId: cardInst.instanceId,
          definitionId: def.id,
          name: def.name,
          owner: playerId,
          universe: def.universe,
          attack: def.attack || 2,
          currentHealth: def.health || 4,
          maxHealth: def.health || 4,
          defense: def.defense || 0,
          movePoints: def.move || 2,
          maxMove: def.move || 2,
          range: def.range || 1,
          canCapture: def.canCapture ?? true,
          keywords: def.keywords || [],
          statusEffects: [],
          hasMovedThisTurn: false,
          hasAttackedThisTurn: false,
          lane: cell.lane,
          row: cell.row,
          col: cell.col,
        };
        cell.unitId = unitId;
        soundFx.playDeploy();
        logMessage = `[จัดวางกำลัง] ${player.name} จัดวาง ${def.name} ในเลน ${cell.lane.toUpperCase()} (${target.cellId})`;

        // Trigger on-deploy abilities deterministically via Ability Engine
        if (def.abilities && def.abilities.length > 0) {
          def.abilities.forEach((ab) => {
            if (ab.trigger === 'deploy') {
              const res = executeResolvedAbility(
                next,
                playerId,
                def.name,
                ab.actionType,
                ab.powerValue || 2,
                {
                  cellId: target.cellId,
                  unitId,
                  lane: cell.lane,
                  row: cell.row,
                  col: cell.col,
                }
              );
              // Merge resulting units and cells
              Object.assign(next.units, res.nextState.units);
              Object.assign(next.cells, res.nextState.cells);
              Object.assign(next.structures, res.nextState.structures);
              logMessage += ` | ${res.logMessage}`;
            }
          });
        }
      } else if (def.cardType === 'structure' && target.cellId) {
        const cell = next.cells[target.cellId];
        const structId = `struct-${playerId}-${Date.now()}`;
        const structType = def.id === 'IF-04' ? 'airbase' : 'bunker';
        next.structures[structId] = {
          id: structId,
          cardInstanceId: cardInst.instanceId,
          definitionId: def.id,
          name: def.name,
          owner: playerId,
          universe: def.universe,
          currentHealth: def.health || 6,
          maxHealth: def.health || 6,
          defense: def.defense || 2,
          lane: cell.lane,
          row: cell.row,
          col: cell.col,
          structureType: structType,
        };
        cell.structureId = structId;
        soundFx.playDeploy();
        logMessage = `[ก่อสร้าง] ${player.name} ก่อสร้าง ${def.name} ในเลน ${cell.lane.toUpperCase()} (${target.cellId})`;
      } else {
        logMessage = `[ใช้การ์ด] ${player.name} ใช้การ์ด ${def.name}`;
      }
      break;
    }
  }

  next.combatLog.unshift(logMessage);

  // Clear selections
  next.selectedCardInstanceId = null;
  next.selectedCellId = null;
  next.selectedUnitId = null;
  next.validTargetCellIds = [];
  next.reachableCellIds = [];
  next.attackableCellIds = [];
  next.actionMode = 'idle';

  return { nextState: next, success: true, logMessage };
}

/**
 * Validates and executes unit movement on the grid between cells
 */
export function executeUnitMovement(
  state: GameState,
  unitId: string,
  destinationCellId: string
): { nextState: GameState; success: boolean; logMessage: string } {
  const next = JSON.parse(JSON.stringify(state)) as GameState;
  const unit = next.units[unitId];
  if (!unit) return { nextState: state, success: false, logMessage: 'ไม่พบยูนิต' };

  if (unit.hasMovedThisTurn || unit.movePoints <= 0) {
    return { nextState: state, success: false, logMessage: 'ยูนิตนี้เดินทัพไปแล้วในเทิร์นนี้' };
  }

  const reachable = getReachableCells(unit, next.cells, next.units);
  if (!reachable.includes(destinationCellId)) {
    return { nextState: state, success: false, logMessage: 'เส้นทางเดินทัพไม่ถูกต้องหรือถูกปิดกั้น' };
  }

  const destCell = next.cells[destinationCellId];
  if (!destCell || destCell.unitId) {
    return { nextState: state, success: false, logMessage: 'ช่องเป้าหมายมีผู้อื่นยึดครองอยู่แล้ว' };
  }

  // Clear old cell
  const oldCellId = getCellId(unit.row, unit.col);
  if (next.cells[oldCellId]) {
    next.cells[oldCellId].unitId = null;
  }

  // Update unit position
  unit.row = destCell.row;
  unit.col = destCell.col;
  unit.lane = destCell.lane;
  unit.hasMovedThisTurn = true;
  unit.movePoints = 0;

  // Occupy new cell
  destCell.unitId = unit.id;

  soundFx.playDeploy();
  const logMessage = `[เดินทัพ] ${unit.name} เคลื่อนพลไปยังเลน ${destCell.lane.toUpperCase()} (${destinationCellId})`;
  next.combatLog.unshift(logMessage);

  next.selectedUnitId = null;
  next.selectedCellId = null;
  next.reachableCellIds = [];
  next.actionMode = 'idle';

  return { nextState: next, success: true, logMessage };
}
