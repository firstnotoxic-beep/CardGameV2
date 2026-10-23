import React, { useState, useRef } from 'react';
import {
  TacticalGameState,
  TacticalUnitInstance,
  TacticalStructureInstance,
  TacticalCell,
  TacticalTerrainType,
  FogVisibility,
} from '../types/tactical';
import {
  getCoordKey,
  parseCoordKey,
  TERRAIN_DATA,
  getTacticalReachableCells,
  getTacticalAttackableCells,
} from '../game/tactical/mapEngine';
import {
  executeTacticalMove,
  executeTacticalAttack,
  executeTacticalReload,
  toggleOverwatchStance,
  executeTacticalSkill,
  endPlayerTurn,
} from '../game/tactical/turnManager';
import { queueUnitProduction } from '../game/tactical/productionEngine';
import { TACTICAL_BLUEPRINTS } from '../game/tactical/tacticalUnits';
import { tacticalHistory } from '../game/tactical/historyEngine';
import {
  Shield,
  Swords,
  Heart,
  Zap,
  Target,
  RefreshCw,
  Eye,
  EyeOff,
  Navigation,
  Factory,
  Radio,
  Flag,
  Crosshair,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronRight,
  ChevronDown,
  RotateCcw,
  Sparkles,
  Flame,
  Award,
} from 'lucide-react';

interface TacticalMapViewProps {
  state: TacticalGameState;
  onStateChange: (newState: TacticalGameState) => void;
  viewerRole?: 'player1' | 'player2' | 'spectator';
  onExitMatch?: () => void;
}

export const TacticalMapView: React.FC<TacticalMapViewProps> = ({
  state,
  onStateChange,
  viewerRole = 'player1',
  onExitMatch,
}) => {
  // Zoom & Pan Camera Controls
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // UI Panels
  const [showProductionModal, setShowProductionModal] = useState<boolean>(false);
  const [showLogDrawer, setShowLogDrawer] = useState<boolean>(true);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [revealFogOfWar, setRevealFogOfWar] = useState<boolean>(false); // Spectator / debug toggle

  const containerRef = useRef<HTMLDivElement>(null);

  const activeViewer = viewerRole === 'spectator' ? state.activePlayerId : viewerRole;
  const currentFog = state.fogOfWar ? state.fogOfWar[activeViewer] : {};

  const selectedUnit = state.selectedUnitId ? state.units[state.selectedUnitId] : null;
  const selectedStructure = state.selectedStructureId ? state.structures[state.selectedStructureId] : null;

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0 && (e.target as HTMLElement).tagName !== 'BUTTON') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Selection & Action commands
  const handleCellClick = (cellKey: string) => {
    const { x, y } = parseCoordKey(cellKey);
    const cell = state.cells[cellKey];

    // If in Move mode and cell is reachable
    if (state.currentCommandMode === 'move' && state.selectedUnitId && state.reachableCellKeys.includes(cellKey)) {
      const next = executeTacticalMove(state.selectedUnitId, x, y, state);
      onStateChange(next);
      return;
    }

    // If in Attack mode and cell is attackable
    if (state.currentCommandMode === 'attack' && state.selectedUnitId && state.attackableCellKeys.includes(cellKey)) {
      const next = executeTacticalAttack(state.selectedUnitId, cellKey, state);
      onStateChange(next);
      return;
    }

    // If in Skill Targeting mode
    if (
      state.currentCommandMode === 'skill-targeting' &&
      state.selectedUnitId &&
      state.selectedSkillId &&
      state.skillTargetCellKeys.includes(cellKey)
    ) {
      const next = executeTacticalSkill(state.selectedUnitId, state.selectedSkillId, cellKey, state);
      onStateChange(next);
      return;
    }

    // Direct Unit Click
    const clickedUnit = Object.values(state.units).find((u) => u.x === x && u.y === y);
    if (clickedUnit) {
      // If clicking own unit, select it
      if (clickedUnit.owner === state.activePlayerId) {
        const reachable = getTacticalReachableCells(
          clickedUnit,
          state.cells,
          state.units,
          state.mapWidth,
          state.mapHeight
        );
        const attackable = getTacticalAttackableCells(
          clickedUnit,
          state.cells,
          state.units,
          state.structures,
          state.mapWidth,
          state.mapHeight,
          revealFogOfWar ? undefined : currentFog
        );

        onStateChange({
          ...state,
          selectedUnitId: clickedUnit.id,
          selectedStructureId: null,
          currentCommandMode: 'idle',
          reachableCellKeys: reachable,
          attackableCellKeys: attackable,
        });
        return;
      }
    }

    // Direct Structure Click
    const clickedStructure = Object.values(state.structures).find((s) => s.x === x && s.y === y);
    if (clickedStructure) {
      onStateChange({
        ...state,
        selectedStructureId: clickedStructure.id,
        selectedUnitId: null,
        currentCommandMode: 'idle',
        reachableCellKeys: [],
        attackableCellKeys: [],
      });
      return;
    }

    // Clicked empty ground - clear selection
    onStateChange({
      ...state,
      selectedUnitId: null,
      selectedStructureId: null,
      currentCommandMode: 'idle',
      reachableCellKeys: [],
      attackableCellKeys: [],
      skillTargetCellKeys: [],
    });
  };

  const handleStartMoveMode = () => {
    if (!selectedUnit) return;
    const reachable = getTacticalReachableCells(selectedUnit, state.cells, state.units, state.mapWidth, state.mapHeight);
    onStateChange({
      ...state,
      currentCommandMode: 'move',
      reachableCellKeys: reachable,
      attackableCellKeys: [],
    });
  };

  const handleStartAttackMode = () => {
    if (!selectedUnit) return;
    const attackable = getTacticalAttackableCells(
      selectedUnit,
      state.cells,
      state.units,
      state.structures,
      state.mapWidth,
      state.mapHeight,
      revealFogOfWar ? undefined : currentFog
    );
    onStateChange({
      ...state,
      currentCommandMode: 'attack',
      attackableCellKeys: attackable,
      reachableCellKeys: [],
    });
  };

  const handleStartSkillMode = (skillId: string, range: number) => {
    if (!selectedUnit) return;
    // Calculate skill target cells within range
    const targetKeys: string[] = [];
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const tx = selectedUnit.x + dx;
        const ty = selectedUnit.y + dy;
        if (tx >= 0 && tx < state.mapWidth && ty >= 0 && ty < state.mapHeight) {
          const key = getCoordKey(tx, ty);
          if (revealFogOfWar || currentFog[key] === 'visible') {
            targetKeys.push(key);
          }
        }
      }
    }
    onStateChange({
      ...state,
      currentCommandMode: 'skill-targeting',
      selectedSkillId: skillId,
      skillTargetCellKeys: targetKeys,
      reachableCellKeys: [],
      attackableCellKeys: [],
    });
  };

  const handleEndTurn = () => {
    const next = endPlayerTurn(state);
    onStateChange(next);
  };

  const handleRewindTurn = (turnNum: number) => {
    const snap = tacticalHistory.getSnapshot(turnNum);
    if (snap) {
      onStateChange(snap);
      setShowHistoryModal(false);
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="relative w-full h-[calc(100vh-70px)] bg-slate-950 overflow-hidden select-none flex flex-col font-sans"
    >
      {/* TOP STATUS BAR: COMMANDER RESOURCES, TURN & CONTROLS */}
      <div className="relative z-20 flex items-center justify-between px-6 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 shadow-md">
        {/* Active Player Info & Resources */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                state.activePlayerId === 'player1' ? 'bg-cyan-400 shadow-cyan-500/50' : 'bg-rose-500 shadow-rose-500/50'
              } shadow-lg animate-pulse`}
            />
            <div>
              <div className="text-xs uppercase font-extrabold tracking-wider text-slate-300">
                {state.activePlayerId === 'player1' ? 'ผู้บัญชาการฝ่ายเรา (Player 1)' : 'ฝ่ายศัตรู (Player 2)'}
              </div>
              <div className="text-[11px] text-cyan-400 font-mono">
                เทิร์นที่ {state.turnNumber} · ขั้นบัญชาการ (Command Phase)
              </div>
            </div>
          </div>

          {/* Resources Bar */}
          <div className="hidden md:flex items-center gap-4 bg-slate-950/70 px-4 py-1.5 rounded-xl border border-slate-800">
            <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
              <Zap className="w-4 h-4 fill-amber-400" />
              <span>
                {state.activePlayerId === 'player1' ? state.player1Resources.charge : state.player2Resources.charge}/
                {state.activePlayerId === 'player1' ? state.player1Resources.maxCharge : state.player2Resources.maxCharge}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Charge</span>
            </div>
            <div className="w-[1px] h-4 bg-slate-800" />
            <div className="flex items-center gap-1.5 text-cyan-400 text-xs font-bold">
              <Sparkles className="w-4 h-4" />
              <span>{state.activePlayerId === 'player1' ? state.player1Resources.rift : state.player2Resources.rift}</span>
              <span className="text-[10px] text-slate-400 font-normal">Rift</span>
            </div>
            <div className="w-[1px] h-4 bg-slate-800" />
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
              <Shield className="w-4 h-4" />
              <span>
                {state.activePlayerId === 'player1' ? state.player1Resources.resolve : state.player2Resources.resolve}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Resolve</span>
            </div>
          </div>
        </div>

        {/* Viewport & Match Controls */}
        <div className="flex items-center gap-2">
          {/* Fog of war toggle for testing/spectating */}
          <button
            onClick={() => setRevealFogOfWar(!revealFogOfWar)}
            title="เปิด/ปิดหมอกสงคราม (Fog of War Toggle)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              revealFogOfWar
                ? 'bg-amber-950/60 border-amber-600/50 text-amber-300'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {revealFogOfWar ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>หมอก: {revealFogOfWar ? 'ปิด (Admin)' : 'เปิดสมจริง'}</span>
          </button>

          {/* Turn History Rewind */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>ย้อนเทิร์น (Rewind)</span>
          </button>

          {/* Zoom In/Out */}
          <div className="flex items-center bg-slate-800/80 rounded-lg border border-slate-700 p-0.5">
            <button
              onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
              className="p-1.5 text-slate-300 hover:text-white"
              title="ขยายแผนที่ (Zoom In)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="px-2 py-1 text-[11px] font-mono text-slate-400 hover:text-white"
              title="รีเซ็ตมุมมอง"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.65, z - 0.15))}
              className="p-1.5 text-slate-300 hover:text-white"
              title="ย่อแผนที่ (Zoom Out)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>

          {onExitMatch && (
            <button
              onClick={onExitMatch}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 text-rose-300 transition-colors"
            >
              ออกจากแมตช์
            </button>
          )}
        </div>
      </div>

      {/* CENTER TACTICAL CANVAS / GRID VIEWPORT */}
      <div className="relative flex-1 cursor-grab active:cursor-grabbing overflow-hidden flex items-center justify-center">
        {/* Battlefield Ambience Texture */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            gridTemplateColumns: `repeat(${state.mapWidth}, minmax(0, 1fr))`,
            width: `${state.mapWidth * 76}px`,
          }}
          className="relative grid gap-1.5 p-6 rounded-3xl bg-slate-900/80 border border-slate-800/80 shadow-[0_0_50px_rgba(0,0,0,0.8)]"
        >
          {Array.from({ length: state.mapHeight }).map((_, y) =>
            Array.from({ length: state.mapWidth }).map((_, x) => {
              const cellKey = getCoordKey(x, y);
              const cell = state.cells[cellKey];
              const visibility: FogVisibility = revealFogOfWar ? 'visible' : currentFog[cellKey] || 'shrouded';

              const unit = Object.values(state.units).find((u) => u.x === x && u.y === y);
              const structure = Object.values(state.structures).find((s) => s.x === x && s.y === y);

              const isReachable = state.reachableCellKeys.includes(cellKey);
              const isAttackable = state.attackableCellKeys.includes(cellKey);
              const isSkillTarget = state.skillTargetCellKeys.includes(cellKey);
              const isSelectedUnitCell = selectedUnit && selectedUnit.x === x && selectedUnit.y === y;

              // Hide enemy units in shrouded or explored fog!
              const showUnit = unit && (visibility === 'visible' || unit.owner === activeViewer);
              const showStructure = structure && (visibility !== 'shrouded' || revealFogOfWar);

              // Terrain visuals
              const terrainProp = TERRAIN_DATA[cell.terrain];

              return (
                <div
                  key={cellKey}
                  onClick={() => handleCellClick(cellKey)}
                  className={`relative w-[72px] h-[72px] rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer select-none group border ${
                    isSelectedUnitCell
                      ? 'border-cyan-400 ring-2 ring-cyan-500/50 shadow-lg shadow-cyan-500/20'
                      : isAttackable
                      ? 'border-rose-500 bg-rose-950/40 animate-pulse ring-2 ring-rose-500/50'
                      : isReachable
                      ? 'border-cyan-400/80 bg-cyan-950/30 ring-1 ring-cyan-400/40'
                      : isSkillTarget
                      ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400/50'
                      : 'border-slate-800/80 hover:border-slate-600'
                  }`}
                  style={{
                    backgroundColor: visibility === 'shrouded' ? '#030712' : terrainProp.color,
                    opacity: visibility === 'explored' ? 0.45 : 1,
                  }}
                >
                  {/* FOG OF WAR SHROUD OVERLAY */}
                  {visibility === 'shrouded' && (
                    <div className="absolute inset-0 bg-slate-950/95 flex items-center justify-center rounded-xl pointer-events-none">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-800" />
                    </div>
                  )}

                  {/* Terrain Feature Icons */}
                  {visibility !== 'shrouded' && (
                    <>
                      {cell.terrain === 'forest' && (
                        <div className="absolute inset-0 opacity-20 flex items-center justify-center pointer-events-none">
                          <span className="text-2xl">🌲</span>
                        </div>
                      )}
                      {cell.terrain === 'hills' && (
                        <div className="absolute top-1 left-1 px-1 rounded bg-amber-950/80 border border-amber-800 text-[9px] text-amber-300 font-bold">
                          ▲ +1
                        </div>
                      )}
                      {cell.terrain === 'road' && (
                        <div className="absolute inset-0 border-dashed border-t border-b border-slate-600/40 pointer-events-none" />
                      )}
                      {cell.terrain === 'water' && (
                        <div className="absolute inset-0 bg-blue-900/30 flex items-center justify-center pointer-events-none">
                          <span className="text-xs text-cyan-400 opacity-30">≋</span>
                        </div>
                      )}
                      {cell.isObjective && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                              cell.objectiveOwner === 'player1'
                                ? 'bg-cyan-950/80 border-cyan-400 text-cyan-400'
                                : cell.objectiveOwner === 'player2'
                                ? 'bg-rose-950/80 border-rose-400 text-rose-400'
                                : 'bg-amber-950/80 border-amber-400 text-amber-400'
                            } shadow-lg animate-pulse`}
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* STRUCTURE RENDERING */}
                  {showStructure && (
                    <div className="relative z-10 flex flex-col items-center">
                      <div
                        className={`w-11 h-11 rounded-lg flex items-center justify-center border shadow-md ${
                          structure.owner === 'player1'
                            ? 'bg-cyan-950/90 border-cyan-500 text-cyan-300'
                            : structure.owner === 'player2'
                            ? 'bg-rose-950/90 border-rose-500 text-rose-300'
                            : 'bg-slate-800 border-slate-600 text-slate-300'
                        }`}
                      >
                        {structure.type === 'hq' ? (
                          <div className="text-center font-extrabold text-[11px] leading-tight">HQ</div>
                        ) : structure.type === 'factory' ? (
                          <Factory className="w-5 h-5" />
                        ) : (
                          <Radio className="w-5 h-5" />
                        )}
                      </div>
                      {/* Structure HP Bar */}
                      <div className="w-12 h-1 bg-slate-900 rounded-full mt-1 overflow-hidden border border-slate-700">
                        <div
                          className={`h-full ${structure.owner === 'player1' ? 'bg-cyan-400' : 'bg-rose-500'}`}
                          style={{ width: `${(structure.currentHealth / structure.maxHealth) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* UNIT RENDERING */}
                  {showUnit && (
                    <div className="relative z-10 flex flex-col items-center">
                      {/* Unit Token Badge */}
                      <div
                        className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 shadow-lg transition-transform ${
                          unit.owner === 'player1'
                            ? 'border-cyan-400 shadow-cyan-500/20'
                            : 'border-rose-500 shadow-rose-500/20'
                        } ${isSelectedUnitCell ? 'scale-110' : 'hover:scale-105'}`}
                      >
                        {unit.artwork ? (
                          <img src={unit.artwork} alt={unit.name} className="w-full h-full object-cover" />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center font-bold text-xs ${
                              unit.owner === 'player1' ? 'bg-cyan-950 text-cyan-300' : 'bg-rose-950 text-rose-300'
                            }`}
                          >
                            {unit.name.slice(0, 2)}
                          </div>
                        )}

                        {/* Stance Indicator Badge */}
                        {unit.stance === 'overwatch' && (
                          <div className="absolute top-0 right-0 p-0.5 bg-amber-500 text-slate-950 rounded-bl text-[8px] font-extrabold shadow">
                            ⚡OW
                          </div>
                        )}
                      </div>

                      {/* Health & AP Gauges */}
                      <div className="w-12 flex flex-col gap-0.5 mt-0.5">
                        {/* HP Bar */}
                        <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden border border-slate-700">
                          <div
                            className={`h-full transition-all ${
                              unit.currentHealth / unit.maxHealth > 0.5
                                ? 'bg-emerald-400'
                                : unit.currentHealth / unit.maxHealth > 0.25
                                ? 'bg-amber-400'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.max(0, (unit.currentHealth / unit.maxHealth) * 100)}%` }}
                          />
                        </div>

                        {/* AP & Ammo Pips (only for active player units) */}
                        {unit.owner === state.activePlayerId && (
                          <div className="flex items-center justify-between px-0.5">
                            {/* AP Pips */}
                            <div className="flex gap-0.5">
                              {Array.from({ length: unit.maxAP }).map((_, idx) => (
                                <div
                                  key={idx}
                                  className={`w-1 h-1 rounded-full ${
                                    idx < unit.currentAP ? 'bg-cyan-400 shadow-cyan-400' : 'bg-slate-700'
                                  }`}
                                />
                              ))}
                            </div>
                            {/* Ammo Dots */}
                            <div className="flex gap-0.5">
                              {Array.from({ length: unit.maxAmmo }).map((_, idx) => (
                                <div
                                  key={idx}
                                  className={`w-1 h-1 rounded-sm ${
                                    idx < unit.currentAmmo ? 'bg-amber-400' : 'bg-slate-700'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Reachable / Attackable Indicator Pip */}
                  {isReachable && !unit && (
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/80 animate-ping pointer-events-none" />
                  )}
                  {isAttackable && (
                    <div className="absolute top-1 right-1 text-rose-400 font-extrabold text-[10px] pointer-events-none">
                      🎯
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* BOTTOM COMMAND DOCK & CONTROL BAR */}
      <div className="relative z-20 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Selected Unit or Structure Profile */}
        <div className="flex items-center gap-4 min-w-[320px]">
          {selectedUnit ? (
            <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-800 w-full">
              <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-cyan-500/50 flex-shrink-0">
                {selectedUnit.artwork ? (
                  <img src={selectedUnit.artwork} alt={selectedUnit.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-cyan-950 flex items-center justify-center font-bold text-cyan-300">
                    {selectedUnit.name.slice(0, 2)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-white truncate">{selectedUnit.name}</div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                    {selectedUnit.stance === 'overwatch' ? 'ดักยิง OW' : 'ปกติ Normal'}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-[11px] mt-1.5 font-mono">
                  <div className="text-emerald-400 font-bold">
                    HP: {selectedUnit.currentHealth}/{selectedUnit.maxHealth}
                  </div>
                  <div className="text-cyan-400 font-bold">
                    AP: {selectedUnit.currentAP}/{selectedUnit.maxAP}
                  </div>
                  <div className="text-amber-400 font-bold">
                    AMMO: {selectedUnit.currentAmmo}/{selectedUnit.maxAmmo}
                  </div>
                  <div className="text-rose-400 font-bold">ATK: {selectedUnit.attack}</div>
                </div>
              </div>
            </div>
          ) : selectedStructure ? (
            <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2.5 rounded-2xl border border-slate-800 w-full">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
                <Factory className="w-6 h-6" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">{selectedStructure.name}</div>
                <div className="text-xs text-slate-400">
                  HP: {selectedStructure.currentHealth}/{selectedStructure.maxHealth} · Defense: {selectedStructure.defense}
                </div>
              </div>
              {selectedStructure.owner === state.activePlayerId && (
                <button
                  onClick={() => setShowProductionModal(true)}
                  className="ml-auto px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-md shadow-cyan-600/30 flex items-center gap-1.5"
                >
                  <Factory className="w-3.5 h-3.5" />
                  สั่งผลิตกำลังพล
                </button>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic px-4 py-3">
              คลิกเลือกยูนิต หรือ กองบัญชาการ เพื่อออกคำสั่งยุทธวิธี
            </div>
          )}
        </div>

        {/* Action Commands Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {selectedUnit && selectedUnit.owner === state.activePlayerId && (
            <>
              {/* Move Command */}
              <button
                onClick={handleStartMoveMode}
                disabled={selectedUnit.currentAP <= 0}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  state.currentCommandMode === 'move'
                    ? 'bg-cyan-600 border-cyan-400 text-white shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-400/50'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Navigation className="w-3.5 h-3.5" />
                เคลื่อนพล
              </button>

              {/* Attack Command */}
              <button
                onClick={handleStartAttackMode}
                disabled={selectedUnit.currentAP < 2 || selectedUnit.currentAmmo <= 0}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                  state.currentCommandMode === 'attack'
                    ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-500/30 ring-2 ring-rose-400/50'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                <Swords className="w-3.5 h-3.5" />
                โจมตี (2 AP)
              </button>

              {/* Tactical Reload */}
              <button
                onClick={() => onStateChange(executeTacticalReload(selectedUnit.id, state))}
                disabled={selectedUnit.currentAP < 1 || selectedUnit.currentAmmo === selectedUnit.maxAmmo}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="บรรจุกระสุนเต็ม (ใช้ 1 AP)"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                บรรจุกระสุน (1 AP)
              </button>

              {/* Overwatch Stance */}
              <button
                onClick={() => onStateChange(toggleOverwatchStance(selectedUnit.id, state))}
                disabled={selectedUnit.currentAP < 1 || selectedUnit.currentAmmo <= 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="เข้าสู่ท่าเตรียมดักยิง Overwatch (ใช้ AP ทั้งหมดที่เหลือ)"
              >
                <Crosshair className="w-3.5 h-3.5" />
                ดักยิง Overwatch
              </button>

              {/* Unit Skills */}
              {selectedUnit.skills.map((skill) => (
                <button
                  key={skill.id}
                  onClick={() => handleStartSkillMode(skill.id, skill.range)}
                  disabled={
                    selectedUnit.currentAP < skill.apCost ||
                    skill.currentCooldown > 0 ||
                    Boolean(skill.ammoCost && selectedUnit.currentAmmo < skill.ammoCost) ||
                    Boolean(skill.manaCost && selectedUnit.currentMana < skill.manaCost)
                  }
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                    state.currentCommandMode === 'skill-targeting' && state.selectedSkillId === skill.id
                      ? 'bg-amber-600 border-amber-400 text-white shadow-lg shadow-amber-500/30'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-300'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {skill.name} ({skill.apCost} AP)
                </button>
              ))}
            </>
          )}

          {/* End Turn Button */}
          <button
            onClick={handleEndTurn}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-extrabold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 active:scale-95 transition-all ml-2"
          >
            <span>จบเทิร์น (End Turn)</span>
            <ChevronRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* HQ & BARRACKS PRODUCTION MODAL */}
      {showProductionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <Factory className="w-6 h-6 text-cyan-400" />
                <div>
                  <h3 className="text-lg font-extrabold text-white">สายการผลิตยุทธวิธี (HQ & Production Queue)</h3>
                  <p className="text-xs text-slate-400">เลือกกำลังพลเข้าสู่คิวการผลิตเพื่อประจำการรอบสิ่งปลูกสร้าง</p>
                </div>
              </div>
              <button
                onClick={() => setShowProductionModal(false)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Blueprints Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
              {Object.values(TACTICAL_BLUEPRINTS).map((bp) => {
                const playerRes = state.activePlayerId === 'player1' ? state.player1Resources : state.player2Resources;
                const canAfford =
                  playerRes.charge >= bp.cost.charge &&
                  (bp.cost.rift || 0) <= playerRes.rift &&
                  (bp.cost.resolve || 0) <= playerRes.resolve;

                return (
                  <div
                    key={bp.id}
                    className="flex items-center gap-3 p-3 rounded-2xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-colors"
                  >
                    <img src={bp.artwork} alt={bp.name} className="w-14 h-14 rounded-xl object-cover border border-slate-700" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-white truncate">{bp.name}</div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="text-amber-400 font-bold">{bp.cost.charge} Charge</span>
                        {bp.cost.rift && <span className="text-cyan-400 font-bold">{bp.cost.rift} Rift</span>}
                        <span>· {bp.buildTurns} เทิร์น</span>
                      </div>
                      <div className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">{bp.description}</div>
                    </div>
                    <button
                      onClick={() => {
                        if (selectedStructure) {
                          const res = queueUnitProduction(
                            selectedStructure.id,
                            bp.id,
                            state.activePlayerId,
                            state
                          );
                          if (res.success) {
                            onStateChange(res.nextState);
                            setShowProductionModal(false);
                          } else if (res.reason) {
                            alert(res.reason);
                          }
                        }
                      }}
                      disabled={!canAfford}
                      className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold shadow-md shadow-cyan-600/20"
                    >
                      สั่งสร้าง
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Current Production Queue */}
            <div className="border-t border-slate-800 pt-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                คิวการผลิตที่กำลังดำเนินการ ({state.productionQueue.length})
              </div>
              {state.productionQueue.length === 0 ? (
                <div className="text-xs text-slate-500 italic">ไม่มีคำสั่งผลิตในขณะนี้</div>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {state.productionQueue.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300"
                    >
                      <Factory className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="font-bold text-white">{item.name}</span>
                      <span className="text-[11px] text-amber-400">เหลือ {item.turnsRemaining} เทิร์น</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TURN HISTORY REWIND MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400">
                <RotateCcw className="w-5 h-5" />
                <h3 className="font-extrabold text-white text-base">ย้อนเวลาประวัติสมรภูมิ (Turn Rewind)</h3>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400">
              ระบบบันทึก Snapshot ทุกต้นเทิร์น คุณสามารถเลือกย้อนสถานะสนามรบกลับไปยังเทิร์นที่ต้องการได้
            </p>
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
              {tacticalHistory.getAvailableTurns().map((tNum) => (
                <button
                  key={tNum}
                  onClick={() => handleRewindTurn(tNum)}
                  className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-colors ${
                    tNum === state.turnNumber
                      ? 'bg-cyan-950/60 border-cyan-500 text-cyan-300'
                      : 'bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-300'
                  }`}
                >
                  <span>สแนปช็อตเทิร์นที่ {tNum}</span>
                  {tNum === state.turnNumber && (
                    <span className="px-2 py-0.5 rounded bg-cyan-900/60 text-[10px] text-cyan-400">เทิร์นปัจจุบัน</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / DEFEAT MODAL */}
      {state.winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-4 animate-in fade-in zoom-in duration-300">
          <div className="w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center flex flex-col items-center gap-4">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl ${
                state.winner === 'player1'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-400'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-400'
              }`}
            >
              <Award className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-black text-white">
              {state.winner === 'player1' ? 'ชัยชนะอย่างเด็ดขาด!' : 'พ่ายแพ้ในสมรภูมิ'}
            </h2>
            <p className="text-sm text-slate-300">{state.winReason}</p>
            <button
              onClick={onExitMatch}
              className="mt-4 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold text-sm shadow-lg shadow-cyan-500/30"
            >
              กลับสู่ล็อบบี้หลัก
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
