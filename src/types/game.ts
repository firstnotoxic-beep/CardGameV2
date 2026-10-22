export type Universe =
  | 'iron-frontier'
  | 'arcane-dominion'
  | 'neo-genesis'
  | 'mythic-wilds'
  | 'creators-circle';

export type CardType =
  | 'unit'
  | 'spell'
  | 'tactic'
  | 'relic'
  | 'domain'
  | 'structure'
  | 'ascension'
  | 'origin'
  | 'nexus-partner';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export type TerrainType =
  | 'plains'
  | 'forest'
  | 'frozen-pass'
  | 'ashen-desert'
  | 'nexus-city'
  | 'arcane-ruins'
  | 'base-zone';

export type OutpostType = 'supply' | 'fortress' | 'relay';

export type StatusEffectType =
  | 'shielded'
  | 'burning'
  | 'frozen'
  | 'stunned'
  | 'guarding'
  | 'concealed'
  | 'exhausted';

export type TurnPhase =
  | 'start'
  | 'draw'
  | 'economy'
  | 'deployment'
  | 'movement'
  | 'combat'
  | 'capture'
  | 'end';

export type Lane = 'left' | 'center' | 'right';

export interface CardCost {
  charge: number;
  rift?: number;
  resolve?: number;
}

export interface CardAbility {
  id: string;
  name: string;
  description: string;
  cost?: CardCost;
  trigger: 'deploy' | 'active' | 'passive' | 'combat' | 'death' | 'turn-start';
  actionType:
    | 'airborne-drop'
    | 'deal-damage'
    | 'heal'
    | 'shield'
    | 'draw-card'
    | 'gain-resource'
    | 'stat-buff'
    | 'teleport'
    | 'outpost-capture-boost'
    | 'repair'
    | 'aoe-damage';
  powerValue?: number;
}

export type TargetingMode =
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

export type CardPlayMode =
  | 'deploy-unit'
  | 'build-structure'
  | 'cast-spell'
  | 'equip-relic'
  | 'activate-domain';

export interface CardTargetRule {
  mode: TargetingMode;
  ownership?: 'friendly' | 'enemy' | 'any';
  range?: number; // -1 or undefined for unrestricted range
  validRows?: number[]; // row restrictions for deployment
  areaRadius?: number; // for cell-area blast radius
  effectType?: 'heal' | 'damage' | 'buff' | 'spawn' | 'capture-boost' | 'repair' | 'resource' | 'aoe-damage';
  powerValue?: number;
  promptText?: string;
}

export interface CardDefinition {
  id: string;
  name: string;
  universe: Universe;
  cardType: CardType;
  rarity: Rarity;
  cost: CardCost;
  playMode?: CardPlayMode;
  targetRule?: CardTargetRule;
  attack?: number;
  health?: number;
  defense?: number;
  move?: number;
  range?: number;
  keywords?: string[];
  abilities?: CardAbility[];
  canCapture?: boolean;
  artwork?: string;
  flavor?: string;
  isCustom?: boolean;
  customAuthor?: string;
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  owner: 'player1' | 'player2';
  currentZone: 'deck' | 'hand' | 'battlefield' | 'discard';
  attachedRelicIds?: string[];
}

export interface StatusEffect {
  type: StatusEffectType;
  duration: number; // in turns
  value?: number;
}

export interface UnitInstance {
  id: string;
  cardInstanceId: string;
  definitionId: string;
  name: string;
  owner: 'player1' | 'player2';
  universe: Universe;
  attack: number;
  currentHealth: number;
  maxHealth: number;
  defense: number;
  movePoints: number;
  maxMove: number;
  range: number;
  canCapture: boolean;
  keywords: string[];
  statusEffects: StatusEffect[];
  hasMovedThisTurn: boolean;
  hasAttackedThisTurn: boolean;
  lane: Lane;
  row: number; // 0 (top/opponent base) to 6 (bottom/player base)
  col: number; // 0 (left), 1 (center), 2 (right)
  isFlying?: boolean;
}

export interface StructureInstance {
  id: string;
  cardInstanceId: string;
  definitionId: string;
  name: string;
  owner: 'player1' | 'player2';
  universe: Universe;
  currentHealth: number;
  maxHealth: number;
  defense: number;
  lane: Lane;
  row: number;
  col: number;
  structureType: 'airbase' | 'bunker' | 'obelisk' | 'fabricator' | 'turret';
  cooldown?: number;
}

export interface OutpostState {
  id: string;
  name: string;
  type: OutpostType;
  lane: Lane;
  row: number; // Row 3
  col: number; // 0, 1, 2
  owner: 'player1' | 'player2' | null;
  captureProgress: number; // 0 to 100
  capturingPlayer: 'player1' | 'player2' | null;
  isContested: boolean;
  description: string;
}

export interface TerrainCell {
  id: string;
  lane: Lane;
  row: number;
  col: number;
  terrainType: TerrainType;
  movementCost: number;
  coverBonus: number; // defense modifier
  unitId: string | null;
  structureId: string | null;
  outpostId: string | null;
  isBaseZone?: boolean;
  baseOwner?: 'player1' | 'player2';
}

export interface PlayerResources {
  charge: number;
  maxCharge: number;
  rift: number;
  resolve: number;
}

export interface PlayerState {
  id: 'player1' | 'player2';
  name: string;
  isAI: boolean;
  baseHealth: number; // starts at 30
  maxBaseHealth: number;
  resources: PlayerResources;
  deck: CardInstance[];
  hand: CardInstance[];
  discard: CardInstance[];
  partner: CardDefinition;
  origin: CardDefinition;
  elo: number;
  rankTitle: string;
}

export interface DeckConfig {
  id: string;
  name: string;
  partnerId: string;
  originId: string;
  cardIds: string[]; // exactly 50
  universes: Universe[];
  isCustom?: boolean;
}

export interface GameState {
  id: string;
  turn: number;
  activePlayerId: 'player1' | 'player2';
  phase: TurnPhase;
  player1: PlayerState;
  player2: PlayerState;
  cells: Record<string, TerrainCell>;
  units: Record<string, UnitInstance>;
  structures: Record<string, StructureInstance>;
  outposts: Record<string, OutpostState>;
  selectedCellId: string | null;
  selectedCardInstanceId: string | null;
  selectedUnitId: string | null;
  selectedStructureId: string | null;
  reachableCellIds: string[];
  attackableCellIds: string[];
  airborneLandingCellIds: string[];
  validTargetCellIds?: string[];
  targetedLane?: Lane | null;
  actionMode: 'idle' | 'deploy' | 'move' | 'attack' | 'airbase-target' | 'tactic-target' | 'card-targeting';
  combatLog: string[];
  winner: 'player1' | 'player2' | null;
  winReason?: string;
  mode: 'tactical-rts' | 'ai-skirmish' | 'hotseat' | 'airborne-scenario' | 'room-lobby';
  roomCode?: string;
}
