import React from 'react';
import { GameState, TerrainCell, UnitInstance, StructureInstance, OutpostState, Lane } from '../types/game';
import { Shield, Swords, Heart, Flag, Navigation, Plane, AlertTriangle, Zap, Radio, Castle, Crosshair, Target } from 'lucide-react';
import { UNIVERSE_CONFIG, CARD_DATABASE } from '../data/cards';
import { getCellId } from '../game/battlefield';
import { CardArtwork } from './CardArtwork';

interface BattlefieldViewProps {
  state: GameState;
  onCellClick: (cellId: string) => void;
  onUnitClick: (unit: UnitInstance) => void;
  onAirbaseDropClick: (structure: StructureInstance) => void;
  onLaneClick?: (lane: Lane) => void;
  canPerformAirborneDrop: boolean;
  selectedAirbase: StructureInstance | null;
}

export const BattlefieldView: React.FC<BattlefieldViewProps> = ({
  state,
  onCellClick,
  onUnitClick,
  onAirbaseDropClick,
  onLaneClick,
  canPerformAirborneDrop,
  selectedAirbase,
}) => {
  const {
    cells,
    units,
    structures,
    outposts,
    selectedCellId,
    selectedUnitId,
    reachableCellIds,
    attackableCellIds,
    airborneLandingCellIds,
    validTargetCellIds,
    actionMode,
    selectedCardInstanceId,
  } = state;

  const isCardTargeting = actionMode === 'card-targeting';
  const selectedCardDef = selectedCardInstanceId
    ? CARD_DATABASE[
        state.player1.hand.find((c) => c.instanceId === selectedCardInstanceId)?.definitionId || ''
      ]
    : null;
  const isLaneTargeting = isCardTargeting && selectedCardDef?.targetRule?.mode === 'lane';

  return (
    <div className="relative flex flex-col items-center w-full max-w-4xl mx-auto rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl p-4 overflow-hidden select-none">
      {/* Background Arena Texture */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none bg-cover bg-center"
        style={{ backgroundImage: `url('/src/assets/images/battlefield_arena_texture_1792637672663.jpg')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-transparent to-slate-950/80 pointer-events-none" />

      {/* TOP HEADER: OPPONENT NEXUS BASE (Row 0) */}
      <div className="relative z-10 flex items-center justify-between w-full px-4 py-2.5 mb-3 bg-gradient-to-r from-slate-900/90 via-rose-950/40 to-slate-900/90 rounded-xl border border-rose-900/50 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-rose-950 border border-rose-700/60 flex items-center justify-center text-rose-400 font-bold text-sm">
            Ω
          </div>
          <div>
            <div className="text-xs font-bold text-rose-300 uppercase tracking-wider">
              {state.player2.name} · เน็กซัสฝ่ายตรงข้าม
            </div>
            <div className="text-[11px] text-slate-400">
              {state.player2.partner.name}
            </div>
          </div>
        </div>

        {/* Base Health Bar */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
              ความสมบูรณ์เน็กซัส (Nexus Integrity)
            </div>
            <div className="text-sm font-mono-nums font-bold text-slate-200">
              {state.player2.baseHealth} / {state.player2.maxBaseHealth} HP
            </div>
          </div>
          <div className="w-36 h-3 bg-slate-900 rounded-full overflow-hidden border border-rose-800/40 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(0, (state.player2.baseHealth / state.player2.maxBaseHealth) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      {/* LANE TITLES / LANE TARGETING BUTTONS */}
      <div className="relative z-10 grid grid-cols-3 gap-3 w-full mb-2 text-center text-xs font-semibold tracking-wider uppercase text-slate-400">
        <button
          type="button"
          disabled={!isLaneTargeting}
          onClick={() => onLaneClick && onLaneClick('left')}
          className={`py-1.5 px-2 rounded border flex items-center justify-center gap-1.5 transition-all ${
            isLaneTargeting
              ? 'bg-purple-900/60 hover:bg-purple-800/90 text-purple-200 border-purple-400 ring-2 ring-purple-400/80 cursor-pointer animate-pulse'
              : 'bg-slate-900/60 border-slate-800 text-amber-400'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>เลนซ้าย · เสบียง</span>
          {isLaneTargeting ? <span className="text-[9px] bg-purple-500 text-white px-1.5 rounded ml-1 font-bold">เลือกเลนนี้</span> : null}
        </button>

        <button
          type="button"
          disabled={!isLaneTargeting}
          onClick={() => onLaneClick && onLaneClick('center')}
          className={`py-1.5 px-2 rounded border flex items-center justify-center gap-1.5 transition-all ${
            isLaneTargeting
              ? 'bg-purple-900/60 hover:bg-purple-800/90 text-purple-200 border-purple-400 ring-2 ring-purple-400/80 cursor-pointer animate-pulse'
              : 'bg-slate-900/60 border-slate-800 text-sky-400'
          }`}
        >
          <Castle className="w-3.5 h-3.5" />
          <span>เลนกลาง · ป้อมมั่นคง</span>
          {isLaneTargeting ? <span className="text-[9px] bg-purple-500 text-white px-1.5 rounded ml-1 font-bold">เลือกเลนนี้</span> : null}
        </button>

        <button
          type="button"
          disabled={!isLaneTargeting}
          onClick={() => onLaneClick && onLaneClick('right')}
          className={`py-1.5 px-2 rounded border flex items-center justify-center gap-1.5 transition-all ${
            isLaneTargeting
              ? 'bg-purple-900/60 hover:bg-purple-800/90 text-purple-200 border-purple-400 ring-2 ring-purple-400/80 cursor-pointer animate-pulse'
              : 'bg-slate-900/60 border-slate-800 text-purple-400'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>เลนขวา · รีเลย์มิติ</span>
          {isLaneTargeting ? <span className="text-[9px] bg-purple-500 text-white px-1.5 rounded ml-1 font-bold">เลือกเลนนี้</span> : null}
        </button>
      </div>

      {/* 3-LANE BATTLEFIELD GRID (7 Rows x 3 Cols) */}
      <div className="relative z-10 grid grid-rows-7 gap-2 w-full p-2 bg-slate-900/70 rounded-xl border border-slate-800/80">
        {[0, 1, 2, 3, 4, 5, 6].map((row) => (
          <div key={`row-${row}`} className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((col) => {
              const cellId = getCellId(row, col);
              const cell = cells[cellId];
              if (!cell) return null;

              const unit = cell.unitId ? units[cell.unitId] : null;
              const structure = cell.structureId ? structures[cell.structureId] : null;
              const outpost = cell.outpostId ? outposts[cell.outpostId] : null;

              const isReachable = reachableCellIds.includes(cellId);
              const isAttackable = attackableCellIds.includes(cellId);
              const isAirborneTarget = airborneLandingCellIds.includes(cellId);
              const isCardTarget = isCardTargeting && (validTargetCellIds?.includes(cellId) ?? false);
              const isDimmed = isCardTargeting && !isCardTarget;
              const isSelected = selectedCellId === cellId || (unit && selectedUnitId === unit.id);

              return (
                <div
                  key={cellId}
                  onClick={() => {
                    if (isCardTargeting) {
                      if (isCardTarget) {
                        onCellClick(cellId);
                      }
                      return;
                    }
                    if (unit && unit.owner === state.activePlayerId && actionMode !== 'attack') {
                      onUnitClick(unit);
                    } else {
                      onCellClick(cellId);
                    }
                  }}
                  className={`relative min-h-[76px] sm:min-h-[86px] rounded-lg p-1.5 flex flex-col justify-between transition-all duration-200 cursor-pointer border ${
                    // Highlight states
                    isCardTarget
                      ? 'border-purple-400 bg-purple-950/50 ring-2 ring-purple-400/90 shadow-lg shadow-purple-950 animate-pulse z-20 scale-[1.02]'
                      : isDimmed
                      ? 'opacity-35 grayscale-40 border-slate-800/60 bg-slate-950/40'
                      : isAttackable
                      ? 'border-rose-500 bg-rose-950/40 ring-2 ring-rose-500/70 shadow-lg shadow-rose-950 animate-pulse'
                      : isAirborneTarget
                      ? 'border-amber-400 bg-amber-950/40 ring-2 ring-amber-400/80 shadow-lg shadow-amber-950 animate-pulse'
                      : isReachable
                      ? 'border-cyan-400 bg-cyan-950/40 ring-2 ring-cyan-400/70 shadow-lg shadow-cyan-950'
                      : isSelected
                      ? 'border-indigo-400 bg-indigo-950/50 ring-2 ring-indigo-400/80'
                      : row === 3
                      ? 'border-slate-700 bg-slate-900/95 hover:border-slate-500' // Outpost frontline
                      : cell.isBaseZone
                      ? 'border-slate-800 bg-slate-950/90'
                      : 'border-slate-800/80 bg-slate-950/50 hover:bg-slate-900/70 hover:border-slate-700'
                  }`}
                >
                  {/* CELL HEADER: Row Label / Cover / Outpost Status */}
                  <div className="flex items-center justify-between text-[10px] font-mono-nums text-slate-400">
                    <span className="text-[9px] text-slate-500 uppercase">
                      {row === 0
                        ? 'ฐานศัตรู'
                        : row === 1
                        ? 'แนวหลังศัตรู'
                        : row === 2
                        ? 'แนวกลางศัตรู'
                        : row === 3
                        ? 'แนวรบหน้า'
                        : row === 4
                        ? 'แนวกลางเรา'
                        : row === 5
                        ? 'แนวหลังเรา'
                        : 'ฐานเรา'}
                    </span>

                    {/* Cover Bonus */}
                    {cell.coverBonus > 0 ? (
                      <span className="flex items-center gap-0.5 text-emerald-400" title={`ที่กำบัง: +${cell.coverBonus} Defense`}>
                        <Shield className="w-2.5 h-2.5" /> +{cell.coverBonus}
                      </span>
                    ) : null}

                    {/* Targeting Indicators */}
                    {isCardTarget ? (
                      <span className="text-purple-300 font-bold flex items-center gap-0.5 uppercase tracking-wider text-[9px] bg-purple-950/80 px-1 rounded border border-purple-500/50">
                        <Target className="w-2.5 h-2.5 text-purple-400" /> เป้าหมาย
                      </span>
                    ) : isAttackable ? (
                      <span className="text-rose-400 font-bold flex items-center gap-0.5 uppercase tracking-wider text-[9px]">
                        <Crosshair className="w-3 h-3" /> โจมตี
                      </span>
                    ) : isAirborneTarget ? (
                      <span className="text-amber-300 font-bold flex items-center gap-0.5 uppercase tracking-wider text-[9px]">
                        <Plane className="w-3 h-3" /> จุดทิ้งร่ม
                      </span>
                    ) : isReachable ? (
                      <span className="text-cyan-300 font-bold flex items-center gap-0.5 uppercase tracking-wider text-[9px]">
                        <Navigation className="w-3 h-3" /> เดินพล
                      </span>
                    ) : null}
                  </div>

                  {/* CELL BODY: UNIT OR STRUCTURE OR OUTPOST OBJECTIVE */}
                  <div className="flex-1 flex items-center justify-center py-1">
                    {/* 1. UNIT PRESENT */}
                    {unit ? (
                      <div
                        className={`w-full rounded-md p-1.5 flex flex-col justify-between border transition-all ${
                          unit.owner === 'player1'
                            ? 'bg-sky-950/70 border-sky-600/70 text-sky-100 shadow-md shadow-sky-950'
                            : 'bg-rose-950/70 border-rose-600/70 text-rose-100 shadow-md shadow-rose-950'
                        }`}
                      >
                        {/* Unit Mini Artwork + Name + Capturer Flag */}
                        <div className="flex items-center gap-1.5">
                          <div className="w-7 h-7 rounded overflow-hidden bg-slate-950 border border-slate-700/80 shrink-0 shadow-xs">
                            <CardArtwork
                              cardId={unit.definitionId}
                              universe={unit.universe}
                              cardType="unit"
                              mini
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold truncate leading-tight">
                                {unit.name.split(' (')[0]}
                              </span>
                              {unit.canCapture ? (
                                <span title="สามารถยึดจุดยุทธศาสตร์ได้" className="shrink-0">
                                  <Flag className="w-2.5 h-2.5 text-amber-400" />
                                </span>
                              ) : null}
                            </div>
                            {/* Health Bar */}
                            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden my-0.5 border border-slate-800">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  unit.owner === 'player1' ? 'bg-sky-400' : 'bg-rose-500'
                                }`}
                                style={{
                                  width: `${Math.max(0, (unit.currentHealth / unit.maxHealth) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Unit Stats */}
                        <div className="flex items-center justify-between text-[10px] font-mono-nums font-bold mt-1 pt-0.5 border-t border-slate-800/80">
                          <span className="flex items-center gap-0.5 text-rose-300" title="พลังโจมตี">
                            <Swords className="w-2.5 h-2.5" /> {unit.attack}
                          </span>
                          <span className="flex items-center gap-0.5 text-emerald-300" title="พลังชีวิต">
                            <Heart className="w-2.5 h-2.5" /> {unit.currentHealth}/{unit.maxHealth}
                          </span>
                          <span className="flex items-center gap-0.5 text-sky-300" title="เกราะ">
                            <Shield className="w-2.5 h-2.5" /> {unit.defense}
                          </span>
                          <span className="flex items-center gap-0.5 text-amber-300" title="การเดินที่เหลือ">
                            <Navigation className="w-2.5 h-2.5" /> {unit.hasMovedThisTurn ? 0 : unit.movePoints}
                          </span>
                        </div>
                      </div>
                    ) : structure ? (
                      /* 2. STRUCTURE PRESENT (e.g. Airbase or Bunker) */
                      <div className="w-full rounded-md p-1.5 bg-slate-900/90 border border-slate-700 text-slate-200 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-amber-300 truncate">
                            {structure.name}
                          </span>
                          <span className="text-[9px] font-mono-nums text-emerald-400 font-bold">
                            {structure.currentHealth} HP
                          </span>
                        </div>

                        {/* If player's Airbase, show Airborne Deployment action */}
                        {structure.structureType === 'airbase' && structure.owner === state.activePlayerId ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAirbaseDropClick(structure);
                            }}
                            className={`mt-1 py-1 px-1.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 transition-all ${
                              selectedAirbase?.id === structure.id
                                ? 'bg-amber-500 text-slate-950 font-extrabold ring-2 ring-amber-300'
                                : canPerformAirborneDrop
                                ? 'bg-amber-600/80 hover:bg-amber-500 text-amber-100 hover:text-slate-950 shadow-md shadow-amber-900/50'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                            }`}
                          >
                            <Plane className="w-3 h-3" /> ทิ้งร่มทางอากาศ (3⚡+1🌀)
                          </button>
                        ) : (
                          <div className="text-[9px] text-slate-400 italic">
                            สิ่งปลูกสร้างป้องกัน
                          </div>
                        )}
                      </div>
                    ) : outpost ? (
                      /* 3. OUTPOST OBJECTIVE (Row 3 Frontline) */
                      <div className="w-full h-full flex flex-col justify-between p-1 bg-slate-950/80 rounded border border-slate-800 text-center">
                        <div className="flex items-center justify-between text-[10px]">
                          <span
                            className={`font-bold uppercase tracking-wider ${
                              outpost.owner === 'player1'
                                ? 'text-sky-400'
                                : outpost.owner === 'player2'
                                ? 'text-rose-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {outpost.owner === 'player1'
                              ? 'ยึดครองแล้ว'
                              : outpost.owner === 'player2'
                              ? 'ศัตรูยึดครอง'
                              : 'เป็นกลาง'}
                          </span>

                          {outpost.isContested ? (
                            <span className="flex items-center gap-0.5 text-amber-400 text-[9px] font-bold animate-pulse">
                              <AlertTriangle className="w-2.5 h-2.5" /> ช่วงชิง
                            </span>
                          ) : null}
                        </div>

                        <div className="text-[11px] font-bold text-slate-200">
                          {outpost.name}
                        </div>

                        {/* Capture Progress Bar */}
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800 my-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              outpost.owner === 'player1' || outpost.capturingPlayer === 'player1'
                                ? 'bg-sky-400'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${outpost.captureProgress}%` }}
                          />
                        </div>

                        <div className="text-[9px] text-slate-400 leading-tight">
                          {outpost.type === 'supply'
                            ? '+1 Charge/รอบ'
                            : outpost.type === 'fortress'
                            ? '+2 Defense ออร่า'
                            : '+1 Rift/รอบ'}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-600 font-mono-nums">
                        {cell.terrainType}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* BOTTOM FOOTER: PLAYER NEXUS BASE (Row 6) */}
      <div className="relative z-10 flex items-center justify-between w-full px-4 py-2.5 mt-3 bg-gradient-to-r from-slate-900/90 via-sky-950/40 to-slate-900/90 rounded-xl border border-sky-900/50 shadow-lg">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-950 border border-sky-700/60 flex items-center justify-center text-sky-400 font-bold text-sm">
            Δ
          </div>
          <div>
            <div className="text-xs font-bold text-sky-300 uppercase tracking-wider">
              {state.player1.name} · เน็กซัสฝ่ายเรา
            </div>
            <div className="text-[11px] text-slate-400">
              {state.player1.partner.name}
            </div>
          </div>
        </div>

        {/* Player Base Health Bar */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">
              ความสมบูรณ์เน็กซัส (Nexus Integrity)
            </div>
            <div className="text-sm font-mono-nums font-bold text-slate-200">
              {state.player1.baseHealth} / {state.player1.maxBaseHealth} HP
            </div>
          </div>
          <div className="w-36 h-3 bg-slate-900 rounded-full overflow-hidden border border-sky-800/40 p-0.5">
            <div
              className="h-full bg-gradient-to-r from-sky-600 to-sky-400 rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(0, (state.player1.baseHealth / state.player1.maxBaseHealth) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
