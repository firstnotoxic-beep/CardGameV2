import { Universe, CardCost, StatusEffect } from './game';

export type TacticalTerrainType =
  | 'plains'
  | 'forest'
  | 'hills'
  | 'water'
  | 'road'
  | 'building'
  | 'mountain';

export type FogVisibility = 'visible' | 'explored' | 'shrouded';

export type StructureType =
  | 'hq'
  | 'barracks'
  | 'factory'
  | 'power_plant'
  | 'radar_tower'
  | 'supply_depot';

export type UnitStance = 'normal' | 'overwatch' | 'entrenched';

export interface TacticalSkill {
  id: string;
  name: string;
  description: string;
  apCost: number;
  manaCost?: number;
  ammoCost?: number;
  cooldown: number; // turns
  currentCooldown: number;
  range: number;
  areaRadius?: number; // 0 = single target, 1 = 3x3 blast
  skillType:
    | 'artillery-barrage'
    | 'smoke-grenade'
    | 'heal-pulse'
    | 'sniper-shot'
    | 'sprint'
    | 'emp-blast'
    | 'repair-structure'
    | 'chrono-rewind';
}

export interface TacticalUnitInstance {
  id: string;
  definitionId: string;
  name: string;
  owner: 'player1' | 'player2';
  universe: Universe;
  x: number;
  y: number;

  // Primary Tactical Stats
  maxHealth: number;
  currentHealth: number;
  defense: number;
  attack: number;
  range: number;
  minRange: number; // For artillery/snipers who cannot hit adjacent targets

  // Action & Resource Limits
  maxAP: number;
  currentAP: number;
  movementCostPerTile: number; // Default 1 AP per standard tile
  visionRange: number; // Tiles of sight for Fog of War

  // Logistics: Ammo & Mana
  maxAmmo: number;
  currentAmmo: number;
  maxMana: number;
  currentMana: number;

  // Stances & State
  stance: UnitStance;
  reactionsUsedThisTurn: number;
  hasMovedThisTurn: boolean;
  hasAttackedThisTurn: boolean;
  isFlying?: boolean;

  // Skills & Status
  skills: TacticalSkill[];
  statusEffects: StatusEffect[];
  artwork?: string;
  flavor?: string;
}

export interface TacticalStructureInstance {
  id: string;
  name: string;
  type: StructureType;
  owner: 'player1' | 'player2' | null;
  x: number;
  y: number;
  maxHealth: number;
  currentHealth: number;
  defense: number;
  visionRange: number;
  producesCategory?: 'infantry' | 'vehicle' | 'all';
  resourceIncome?: {
    charge?: number;
    rift?: number;
    resolve?: number;
  };
}

export interface ProductionQueueItem {
  id: string;
  unitDefId: string;
  name: string;
  owner: 'player1' | 'player2';
  buildingId: string;
  turnsRemaining: number;
  totalTurns: number;
  cost: CardCost;
  artwork?: string;
}

export interface TacticalCell {
  id: string;
  x: number;
  y: number;
  terrain: TacticalTerrainType;
  movementCost: number; // AP to enter
  coverDefense: number; // Added to unit defense
  blocksLineOfSight: boolean;
  heightLevel: number; // 0 = low, 1 = normal, 2 = hill
  unitId: string | null;
  structureId: string | null;
  isObjective?: boolean;
  objectiveOwner?: 'player1' | 'player2' | null;
  objectiveCapturePoints?: number; // 0 to 100
}

export interface MapPresetConfig {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  generator: () => {
    cells: Record<string, TacticalCell>;
    structures: Record<string, TacticalStructureInstance>;
  };
}

export type TacticalPhase =
  | 'start-turn'
  | 'resource-income'
  | 'production-deployment'
  | 'player-command'
  | 'end-turn'
  | 'reactions'
  | 'turn-switch';

export interface ReactionEvent {
  id: string;
  type: 'overwatch-intercept' | 'counter-attack';
  sourceUnitId: string;
  targetUnitId: string;
  triggerX: number;
  triggerY: number;
  damageDealt: number;
  targetDestroyed: boolean;
  timestamp: number;
  message: string;
}

export interface TacticalGameState {
  id: string;
  mapWidth: number;
  mapHeight: number;
  turnNumber: number;
  activePlayerId: 'player1' | 'player2';
  phase: TacticalPhase;

  // Grid & World
  cells: Record<string, TacticalCell>;
  units: Record<string, TacticalUnitInstance>;
  structures: Record<string, TacticalStructureInstance>;
  productionQueue: ProductionQueueItem[];

  // Fog of War (calculated per player)
  fogOfWar: {
    player1: Record<string, FogVisibility>;
    player2: Record<string, FogVisibility>;
  };

  // Resources
  player1Resources: {
    charge: number;
    maxCharge: number;
    rift: number;
    resolve: number;
    commandCap: number; // Population cap
  };
  player2Resources: {
    charge: number;
    maxCharge: number;
    rift: number;
    resolve: number;
    commandCap: number;
  };

  // Selection & UI targeting
  selectedUnitId: string | null;
  selectedStructureId: string | null;
  selectedSkillId: string | null;
  currentCommandMode: 'idle' | 'move' | 'attack' | 'skill-targeting';
  reachableCellKeys: string[];
  attackableCellKeys: string[];
  skillTargetCellKeys: string[];

  // Logs & History
  combatLog: string[];
  reactionLog: ReactionEvent[];
  winner: 'player1' | 'player2' | null;
  winReason?: string;
  mode: 'ai-skirmish' | 'hotseat' | 'multiplayer-room';
  roomCode?: string;
}

export interface StateSnapshot {
  turnNumber: number;
  stateJson: string;
  timestamp: number;
}
