import React, { useEffect, useRef, useState } from 'react';
import { GameState, UnitInstance } from '../types/game';

type EffectKind =
  | 'attack'
  | 'counter'
  | 'death'
  | 'damage-number'
  | 'heal-number'
  | 'meteor'
  | 'meteor-cell'
  | 'bolt'
  | 'bolt-line'
  | 'rift-gate'
  | 'battle-cry'
  | 'aura'
  | 'heal'
  | 'capture'
  | 'airborne';

interface VisualEffect {
  id: number;
  kind: EffectKind;
  left: number;
  top: number;
  width: number;
  height: number;
  text?: string;
  owner?: 'player1' | 'player2' | null;
  path?: string;
  viewWidth?: number;
  viewHeight?: number;
  duration: number;
  delay?: number;
}

interface UnitSnapshot {
  row: number;
  col: number;
  health: number;
  attack: number;
  owner: UnitInstance['owner'];
  name: string;
}

interface StructureSnapshot {
  row: number;
  col: number;
  health: number;
  defense: number;
}

interface GameSnapshot {
  units: Record<string, UnitSnapshot>;
  structures: Record<string, StructureSnapshot>;
  baseHealth: Record<'player1' | 'player2', number>;
  outposts: Record<string, { owner: 'player1' | 'player2' | null; row: number; col: number }>;
  selectedUnitId: string | null;
  activePlayerId: 'player1' | 'player2';
  logTop?: string;
  logLength: number;
}

interface PendingEffect {
  kind: EffectKind;
  cellId?: string;
  nexus?: 'player1' | 'player2';
  text?: string;
  owner?: 'player1' | 'player2' | null;
  path?: string;
  duration?: number;
  delay?: number;
}

const cellIdFor = (row: number, col: number) => `cell-${row}-${col}`;

function takeSnapshot(state: GameState): GameSnapshot {
  const units: GameSnapshot['units'] = {};
  Object.values(state.units).forEach((unit) => {
    units[unit.id] = {
      row: unit.row,
      col: unit.col,
      health: unit.currentHealth,
      attack: unit.attack,
      owner: unit.owner,
      name: unit.name,
    };
  });

  const structures: GameSnapshot['structures'] = {};
  Object.values(state.structures).forEach((structure) => {
    structures[structure.id] = {
      row: structure.row,
      col: structure.col,
      health: structure.currentHealth,
      defense: structure.defense,
    };
  });

  const outposts: GameSnapshot['outposts'] = {};
  Object.values(state.outposts).forEach((outpost) => {
    outposts[outpost.id] = { owner: outpost.owner, row: outpost.row, col: outpost.col };
  });

  return {
    units,
    structures,
    baseHealth: {
      player1: state.player1.baseHealth,
      player2: state.player2.baseHealth,
    },
    outposts,
    selectedUnitId: state.selectedUnitId,
    activePlayerId: state.activePlayerId,
    logTop: state.combatLog[0],
    logLength: state.combatLog.length,
  };
}

export const EffectsOverlay: React.FC<{ state: GameState }> = ({ state }) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const previousRef = useRef<GameSnapshot | null>(null);
  const nextIdRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const [effects, setEffects] = useState<VisualEffect[]>([]);

  useEffect(() => {
    const previous = previousRef.current;
    const current = takeSnapshot(state);
    previousRef.current = current;
    if (!previous) return;

    const overlay = overlayRef.current;
    const root = overlay?.parentElement;
    if (!overlay || !root) return;

    const rootRect = root.getBoundingClientRect();
    const viewWidth = root.clientWidth;
    const viewHeight = root.clientHeight;
    const pending: PendingEffect[] = [];
    const logChanged =
      current.logTop !== previous.logTop || current.logLength > previous.logLength;
    const log = logChanged ? current.logTop || '' : '';
    const isCombat = log.includes('[ประจัญบาน]');
    const isMeteor = log.includes('Meteor Field');
    const isBolt = log.includes('Arcane Bolt');
    const isHeal = log.includes('Healing Pulse');
    const isRiftGate = log.includes('Rift Gate');
    const isBattleCry = log.includes('Battle Cry');
    const isNexusSurge = log.includes('Nexus Surge');
    const isFortify = log.includes('Fortify');
    const isAirborne = log.includes('ทิ้งร่มทางอากาศ') || log.includes('Airborne');
    const isCounterAttack = log.includes('โต้กลับ');

    const cellElement = (cellId: string) =>
      Array.from(root.querySelectorAll<HTMLElement>('[data-cell-id]')).find(
        (element) => element.dataset.cellId === cellId
      );
    const nexusElement = (player: 'player1' | 'player2') =>
      root.querySelector<HTMLElement>(`[data-nexus-health="${player}"]`);
    const elementRect = (element?: HTMLElement | null) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left - rootRect.left,
        top: rect.top - rootRect.top,
        width: rect.width,
        height: rect.height,
      };
    };

    const pushCell = (kind: EffectKind, cellId: string, extra: Partial<PendingEffect> = {}) => {
      if (cellElement(cellId)) pending.push({ kind, cellId, ...extra });
    };
    const pushNumber = (
      kind: 'damage-number' | 'heal-number',
      cellId: string,
      amount: number
    ) => {
      if (amount > 0 && cellElement(cellId)) {
        pending.push({ kind, cellId, text: `${kind === 'damage-number' ? '−' : '+'}${amount}` });
      }
    };
    const pushNexus = (
      kind: EffectKind,
      player: 'player1' | 'player2',
      extra: Partial<PendingEffect> = {}
    ) => {
      if (nexusElement(player)) pending.push({ kind, nexus: player, ...extra });
    };
    const pushNexusNumber = (
      kind: 'damage-number' | 'heal-number',
      player: 'player1' | 'player2',
      amount: number
    ) => {
      if (amount > 0 && nexusElement(player)) {
        pending.push({
          kind,
          nexus: player,
          text: `${kind === 'damage-number' ? '−' : '+'}${amount}`,
        });
      }
    };

    const targetCellFromLog = log.match(/cell-\d+-\d+/)?.[0];
    const changedUnitIds = new Set([
      ...Object.keys(previous.units),
      ...Object.keys(current.units),
    ]);
    const damagedUnitCells: string[] = [];
    const healedUnitCells = new Set<string>();

    changedUnitIds.forEach((unitId) => {
      const before = previous.units[unitId];
      const after = current.units[unitId];

      if (!before && after) {
        const cellId = cellIdFor(after.row, after.col);
        if (isAirborne) {
          pushCell('airborne', cellId, { duration: 950 });
        }
        return;
      }

      if (!before || !after) {
        if (before && !after) {
          const cellId = cellIdFor(before.row, before.col);
          pushCell('death', cellId, { duration: 720 });
          const counterDamage =
            isCounterAttack && unitId === previous.selectedUnitId
              ? Number(log.match(/โต้กลับ:.*?(\d+)\s*DMG/)?.[1])
              : undefined;
          const combatDamage = Number(log.match(/สร้างความเสียหาย\s+(\d+)/)?.[1]);
          const expectedDamage = isMeteor ? 3 : isBolt ? 4 : counterDamage || combatDamage;
          const amount = expectedDamage || before.health;
          pushNumber('damage-number', cellId, amount);
          damagedUnitCells.push(cellId);
          if (isCombat) {
            const isCounterTarget = isCounterAttack && unitId === previous.selectedUnitId;
            pushCell(isCounterTarget ? 'counter' : 'attack', cellId, { duration: 560 });
          } else if (isBolt) {
            pushCell('bolt', cellId, { duration: 650 });
          }
        }
        return;
      }

      if (after.health < before.health) {
        const cellId = cellIdFor(before.row, before.col);
        const amount = before.health - after.health;
        pushNumber('damage-number', cellId, amount);
        damagedUnitCells.push(cellId);

        if (isCombat) {
          const isCounterTarget = isCounterAttack && unitId === previous.selectedUnitId;
          pushCell(isCounterTarget ? 'counter' : 'attack', cellId, { duration: 560 });
        } else if (isBolt) {
          pushCell('bolt', cellId, { duration: 650 });
        }
      } else if (after.health > before.health) {
        const cellId = cellIdFor(before.row, before.col);
        pushCell('heal', cellId, { duration: 850 });
        pushNumber('heal-number', cellId, after.health - before.health);
        healedUnitCells.add(cellId);
      }

      if (isBattleCry && after.attack > before.attack) {
        pushCell('battle-cry', cellIdFor(after.row, after.col), {
          owner: after.owner,
          duration: 900,
          delay: after.row * 65,
        });
      }
    });

    if (isMeteor) {
      const center = targetCellFromLog;
      if (center) {
        pushCell('meteor', center, { duration: 1100 });
        const [, rowText, colText] = center.match(/cell-(\d+)-(\d+)/) || [];
        const row = Number(rowText);
        const col = Number(colText);
        if (Number.isInteger(row) && Number.isInteger(col)) {
          [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc], index) => {
            const affectedRow = row + dr;
            const affectedCol = col + dc;
            if (affectedRow >= 0 && affectedRow < 7 && affectedCol >= 0 && affectedCol < 3) {
              pushCell('meteor-cell', cellIdFor(affectedRow, affectedCol), {
                duration: 620,
                delay: index * 55,
              });
            }
          });
        }
      }
    }

    const boltTargetCell = targetCellFromLog || damagedUnitCells[0];
    if (isBolt && boltTargetCell && nexusElement(previous.activePlayerId)) {
      const source = elementRect(nexusElement(previous.activePlayerId));
      const target = elementRect(cellElement(boltTargetCell));
      if (source && target) {
        const fromX = source.left + source.width / 2;
        const fromY = source.top + source.height / 2;
        const toX = target.left + target.width / 2;
        const toY = target.top + target.height / 2;
        const curveX = (fromX + toX) / 2 + (toY < fromY ? 32 : -32);
        const curveY = (fromY + toY) / 2;
        pending.push({
          kind: 'bolt-line',
          path: `M ${fromX} ${fromY} Q ${curveX} ${curveY} ${toX} ${toY}`,
          duration: 620,
        });
      }
    }

    if (isHeal) {
      const namedTarget = Object.entries(previous.units).find(([, unit]) => log.includes(unit.name));
      if (namedTarget) {
        const [, unit] = namedTarget;
        const targetCell = cellIdFor(unit.row, unit.col);
        if (!healedUnitCells.has(targetCell)) {
          pushCell('heal', targetCell, { duration: 850 });
        }
      }
    }

    if (isRiftGate && targetCellFromLog) {
      pushCell('rift-gate', targetCellFromLog, { duration: 1100 });
    }

    Object.entries(current.baseHealth).forEach(([player, health]) => {
      const owner = player as 'player1' | 'player2';
      const oldHealth = previous.baseHealth[owner];
      if (health < oldHealth) {
        pushNexusNumber('damage-number', owner, oldHealth - health);
        pushNexus(isCombat ? 'attack' : 'meteor-cell', owner, { duration: 620 });
      } else if (health > oldHealth) {
        pushNexusNumber('heal-number', owner, health - oldHealth);
        pushNexus('heal', owner, { duration: 850 });
      }
    });

    if (isNexusSurge) {
      pushNexus('aura', previous.activePlayerId, { duration: 1050 });
    }

    const changedStructureIds = new Set([
      ...Object.keys(previous.structures),
      ...Object.keys(current.structures),
    ]);
    changedStructureIds.forEach((structureId) => {
      const before = previous.structures[structureId];
      const after = current.structures[structureId];
      if (!before) return;
      const cellId = cellIdFor(before.row, before.col);
      if (!after) {
        pushCell('death', cellId, { duration: 720 });
        const amount = Number(log.match(/สร้างความเสียหาย\s+(\d+)/)?.[1]);
        if (amount > 0) pushNumber('damage-number', cellId, amount);
        if (isCombat) pushCell('attack', cellId, { duration: 560 });
        return;
      }
      if (after.health < before.health) {
        pushCell('attack', cellId, { duration: 560 });
        pushNumber('damage-number', cellId, before.health - after.health);
      } else if (after.health > before.health || (isFortify && after.defense > before.defense)) {
        pushCell('aura', cellId, { duration: 1050 });
        if (after.health > before.health) {
          pushNumber('heal-number', cellId, after.health - before.health);
        }
      }
    });

    Object.entries(current.outposts).forEach(([outpostId, outpost]) => {
      const before = previous.outposts[outpostId];
      if (before && before.owner !== outpost.owner) {
        pushCell('capture', cellIdFor(outpost.row, outpost.col), {
          owner: outpost.owner,
          duration: 900,
        });
      }
    });

    if (!pending.length) return;

    const located: VisualEffect[] = pending.flatMap<VisualEffect>((effect) => {
      const target = effect.cellId
        ? elementRect(cellElement(effect.cellId))
        : effect.nexus
        ? elementRect(nexusElement(effect.nexus))
        : null;
      if (!target && effect.kind !== 'bolt-line') return [];

      const id = nextIdRef.current++;
      if (effect.kind === 'bolt-line') {
        return [{
          id,
          kind: effect.kind,
          left: 0,
          top: 0,
          width: viewWidth,
          height: viewHeight,
          path: effect.path,
          viewWidth,
          viewHeight,
          duration: effect.duration || 620,
          delay: effect.delay,
        }];
      }

      const isNumber = effect.kind === 'damage-number' || effect.kind === 'heal-number';
      return [{
        id,
        kind: effect.kind,
        left: target!.left + (isNumber ? target!.width / 2 : 0),
        top: target!.top + (isNumber ? target!.height / 2 : 0),
        width: isNumber ? 0 : target!.width,
        height: isNumber ? 0 : target!.height,
        text: effect.text,
        owner: effect.owner,
        duration: effect.duration || (isNumber ? 820 : 700),
        delay: effect.delay,
      }];
    });

    if (!located.length) return;
    setEffects((existing) => [...existing, ...located]);
    const ids = new Set(located.map((effect) => effect.id));
    const timer = window.setTimeout(() => {
      setEffects((existing) => existing.filter((effect) => !ids.has(effect.id)));
    }, Math.max(...located.map((effect) => effect.duration + (effect.delay || 0))) + 80);
    timersRef.current.push(timer);
  }, [state]);

  useEffect(
    () => () => {
      timersRef.current.forEach(window.clearTimeout);
      timersRef.current = [];
    },
    []
  );

  return (
    <div ref={overlayRef} className="effects-overlay" aria-hidden="true">
      {effects.map((effect) =>
        effect.kind === 'bolt-line' ? (
          <svg
            key={effect.id}
            className="fx-bolt-line"
            viewBox={`0 0 ${effect.viewWidth || 1} ${effect.viewHeight || 1}`}
            preserveAspectRatio="none"
            style={{ animationDuration: `${effect.duration}ms` }}
          >
            <path d={effect.path} />
          </svg>
        ) : effect.kind === 'damage-number' || effect.kind === 'heal-number' ? (
          <div
            key={effect.id}
            className={`fx-mark fx-number ${effect.kind}`}
            style={{
              left: effect.left,
              top: effect.top,
              animationDuration: `${effect.duration}ms`,
              animationDelay: `${effect.delay || 0}ms`,
            }}
          >
            {effect.text}
          </div>
        ) : (
          <div
            key={effect.id}
            className={`fx-mark fx-cell-mark fx-${effect.kind} ${
              effect.owner ? `owner-${effect.owner}` : ''
            }`}
            style={{
              left: effect.left,
              top: effect.top,
              width: effect.width,
              height: effect.height,
              animationDuration: `${effect.duration}ms`,
              animationDelay: `${effect.delay || 0}ms`,
            }}
          >
            {effect.kind === 'death' ? (
              <>
                <i className="fx-shard fx-shard-one" />
                <i className="fx-shard fx-shard-two" />
                <i className="fx-shard fx-shard-three" />
                <i className="fx-shard fx-shard-four" />
              </>
            ) : null}
          </div>
        )
      )}
    </div>
  );
};
