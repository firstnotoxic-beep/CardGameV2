import { GameState, TerrainCell, UnitInstance } from '../types/game';
import { CARD_DATABASE } from '../data/cards';
import { getCardDef } from './cardRegistry';
import {
  captureOutpostOnMove,
  generateEntityId,
  getAttackableCells,
  getCellId,
  getReachableCellCosts,
} from './battlefield';
import { executeCombat, performAirborneDeployment } from './combat';

export function runAITurn(initialState: GameState): GameState {
  let state = JSON.parse(JSON.stringify(initialState)) as GameState;
  const ai = state.player2;

  // 1. DEPLOYMENT PHASE: Deploy affordable units from hand to rear row (Row 1 or 0)
  for (let i = ai.hand.length - 1; i >= 0; i--) {
    const cardInst = ai.hand[i];
    const def = getCardDef(cardInst.definitionId);
    if (!def) continue;

    const chargeCost = def.cost.charge || 0;
    const riftCost = def.cost.rift || 0;

    if (ai.resources.charge >= chargeCost && ai.resources.rift >= riftCost) {
      if (def.cardType === 'unit') {
        // Find empty cell in row 1 (or 0)
        let emptyCell: TerrainCell | null = null;
        for (let r = 1; r >= 0; r--) {
          for (let c = 0; c < 3; c++) {
            const cell = state.cells[getCellId(r, c)];
            if (cell && !cell.unitId && !cell.structureId) {
              emptyCell = cell;
              break;
            }
          }
          if (emptyCell) break;
        }

        if (emptyCell) {
          ai.resources.charge -= chargeCost;
          ai.resources.rift -= riftCost;

          const unitId = generateEntityId('ai-unit');
          state.units[unitId] = {
            id: unitId,
            cardInstanceId: cardInst.instanceId,
            definitionId: def.id,
            name: def.name,
            owner: 'player2',
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
            lane: emptyCell.lane,
            row: emptyCell.row,
            col: emptyCell.col,
          };
          emptyCell.unitId = unitId;
          ai.hand.splice(i, 1);
          state.combatLog.unshift(`[การกระทำ AI] สถาปนิกฝ่ายตรงข้ามส่ง ${def.name} ลงสู่เลน ${emptyCell.lane.toUpperCase()}`);
        }
      } else if (def.cardType === 'structure') {
        // Deploy structure in row 1
        const emptyCell = [0, 1, 2]
          .map((c) => state.cells[getCellId(1, c)])
          .find((c) => c && !c.structureId && !c.unitId);

        if (emptyCell) {
          ai.resources.charge -= chargeCost;
          ai.resources.rift -= riftCost;

          const structId = generateEntityId('ai-struct');
          state.structures[structId] = {
            id: structId,
            cardInstanceId: cardInst.instanceId,
            definitionId: def.id,
            name: def.name,
            owner: 'player2',
            universe: def.universe,
            currentHealth: def.health || 6,
            maxHealth: def.health || 6,
            defense: def.defense || 2,
            lane: emptyCell.lane,
            row: emptyCell.row,
            col: emptyCell.col,
            structureType: def.id === 'IF-04' ? 'airbase' : 'bunker',
          };
          emptyCell.structureId = structId;
          ai.hand.splice(i, 1);
          state.combatLog.unshift(`[การกระทำ AI] สถาปนิกฝ่ายตรงข้ามสร้าง ${def.name} ในเลน ${emptyCell.lane.toUpperCase()}`);
        }
      }
    }
  }

  // 2. AIRBASE AIRBORNE DROP: If AI owns an Airbase and has 3 Charge + 1 Rift, drop into Outpost 0 or 2 if empty
  const aiAirbase = Object.values(state.structures).find((s) => s.owner === 'player2' && s.structureType === 'airbase');
  if (aiAirbase && ai.resources.charge >= 3 && ai.resources.rift >= 1) {
    const targetOutpostCell = [0, 1, 2]
      .map((c) => state.cells[getCellId(3, c)])
      .find((cell) => cell && !cell.unitId);

    if (targetOutpostCell) {
      try {
        state = performAirborneDeployment(state, 'player2', targetOutpostCell.id);
      } catch (e) {
        // ignore if condition fails
      }
    }
  }

  // 3. MOVEMENT PHASE: Move AI units forward (row increasing toward 6) or into Outposts (row 3)
  const aiUnits = Object.values(state.units).filter((u) => u.owner === 'player2');
  for (const unit of aiUnits) {
    if (!state.units[unit.id]) continue; // unit might have been eliminated

    const reachableCosts = getReachableCellCosts(unit, state.cells, state.units);
    const reachable = Array.from(reachableCosts.keys());
    if (reachable.length > 0) {
      // Prioritize cells that move forward toward row 3 (Outposts) or row 6 (Player Base)
      reachable.sort((a, b) => {
        const cellA = state.cells[a];
        const cellB = state.cells[b];
        // Outpost bonus
        const scoreA = (cellA.row === 3 ? 10 : cellA.row) + (cellA.outpostId ? 5 : 0);
        const scoreB = (cellB.row === 3 ? 10 : cellB.row) + (cellB.outpostId ? 5 : 0);
        return scoreB - scoreA;
      });

      const bestCellId = reachable[0];
      const targetCell = state.cells[bestCellId];
      if (targetCell && !targetCell.unitId) {
        const currentCell = state.cells[getCellId(unit.row, unit.col)];
        if (currentCell) currentCell.unitId = null;

        targetCell.unitId = unit.id;
        unit.row = targetCell.row;
        unit.col = targetCell.col;
        unit.lane = targetCell.lane;
        // AI moves once per turn; keep movePoints consistent with the cost actually spent
        unit.movePoints = Math.max(0, reachableCosts.get(bestCellId) ?? 0);
        unit.hasMovedThisTurn = true;
        captureOutpostOnMove(state, unit);
      }
    }
  }

  // 4. COMBAT PHASE: Units attack targets in range
  for (const unit of Object.values(state.units).filter((u) => u.owner === 'player2')) {
    if (unit.hasAttackedThisTurn) continue;

    const targets = getAttackableCells(unit, state.cells, state.units, 'player1');
    if (targets.length > 0) {
      // Prioritize low-health enemy units or the player's base
      targets.sort((a, b) => {
        const cellA = state.cells[a];
        const cellB = state.cells[b];
        if (cellA.isBaseZone) return -1;
        if (cellB.isBaseZone) return 1;
        const hpA = cellA.unitId && state.units[cellA.unitId] ? state.units[cellA.unitId].currentHealth : 99;
        const hpB = cellB.unitId && state.units[cellB.unitId] ? state.units[cellB.unitId].currentHealth : 99;
        return hpA - hpB;
      });

      const chosenTargetCellId = targets[0];
      try {
        const combatResult = executeCombat(unit, chosenTargetCellId, state);
        state = combatResult.nextState;
      } catch (err) {
        // pass
      }
    }
  }

  return state;
}
