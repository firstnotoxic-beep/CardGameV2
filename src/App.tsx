import React, { useState, useEffect } from 'react';
import {
  CardDefinition,
  CardInstance,
  DeckConfig,
  GameState,
  PlayerState,
  StructureInstance,
  TurnPhase,
  UnitInstance,
} from './types/game';
import { CARD_DATABASE } from './data/cards';
import { STARTER_DECKS } from './data/starterDecks';
import {
  generateBattlefield,
  getAirborneLandingCells,
  getAttackableCells,
  getCellId,
  getReachableCells,
} from './game/battlefield';
import {
  canPlayCard,
  resolveCardPlay,
  executeUnitMovement,
} from './game/cardEngine';
import {
  executeCombat,
  performAirborneDeployment,
  resolveEconomyIncome,
  resolveOutpostCaptures,
} from './game/combat';
import { Lane } from './types/game';
import { runAITurn } from './game/ai';
import { BattlefieldView } from './components/BattlefieldView';
import { TacticalMapView } from './components/TacticalMapView';
import { TacticalGameState } from './types/tactical';
import { initializeTacticalGame } from './game/tactical/turnManager';
import { CardView } from './components/CardView';
import { DeckBuilder } from './components/DeckBuilder';
import { UnitForge } from './components/UnitForge/UnitForge';
import { MyCollection } from './components/Creator/MyCollection';
import { PublicGallery } from './components/Creator/PublicGallery';
import { MultiplayerLobby, GamePlayMode } from './components/MultiplayerLobby';
import { RankedModal } from './components/RankedModal';
import { RulesModal } from './components/RulesModal';
import { dbService } from './services/db';
import { cardRegistry, getCardDef } from './game/cardRegistry';
import { CreatorContentRecord } from './types/creator';
import { validateCardForMatch } from './game/rules/creatorValidator';
import { soundFx } from './utils/audio';
import {
  multiplayerService,
  MultiplayerRoomData,
  MultiplayerAction,
} from './services/multiplayerService';
import {
  Shield,
  Swords,
  Heart,
  Zap,
  Radio,
  Volume2,
  VolumeX,
  RotateCcw,
  Flag,
  ArrowRight,
  Plane,
  AlertOctagon,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Timer,
  Target,
  X,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';

export default function App() {
  // Navigation Screens
  const [screen, setScreen] = useState<'lobby' | 'battle' | 'deckbuilder' | 'creator' | 'my-collection' | 'public-gallery'>('lobby');

  // Cross-Device Multiplayer State
  const [multiplayerRoom, setMultiplayerRoom] = useState<MultiplayerRoomData | null>(null);
  const [multiplayerRole, setMultiplayerRole] = useState<'player1' | 'player2' | null>(null);
  const [copiedRoomCode, setCopiedRoomCode] = useState<boolean>(false);

  // Creator Platform editing & remix states
  const [editingContentId, setEditingContentId] = useState<string | undefined>(undefined);
  const [remixDraft, setRemixDraft] = useState<CreatorContentRecord | undefined>(undefined);
  const [validationErrorBanner, setValidationErrorBanner] = useState<string | null>(null);

  // Turn Timer state (60 seconds limit for deployment and movement phases)
  const [turnTimeLeft, setTurnTimeLeft] = useState<number>(60);

  // Decks & Custom Cards Persistence from dbService & cardRegistry
  const [customCards, setCustomCards] = useState<CardDefinition[]>(() => {
    try {
      const dbUnits = dbService.getAllUnits();
      if (dbUnits.length > 0) {
        const defs = dbUnits.map((u) => dbService.toCardDefinition(u));
        cardRegistry.registerMany(defs);
        return defs;
      }
      const saved = localStorage.getItem('riftbound_custom_cards');
      const parsed = saved ? JSON.parse(saved) : [];
      cardRegistry.registerMany(parsed);
      return parsed;
    } catch {
      return [];
    }
  });

  const [decks, setDecks] = useState<DeckConfig[]>(() => {
    try {
      const saved = localStorage.getItem('riftbound_user_decks');
      return saved ? JSON.parse(saved) : STARTER_DECKS;
    } catch {
      return STARTER_DECKS;
    }
  });

  const [selectedDeckId, setSelectedDeckId] = useState<string>(decks[0]?.id || STARTER_DECKS[0].id);

  // Ranked Progression & Elo
  const [userElo, setUserElo] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('riftbound_user_elo');
      return saved ? Number(saved) : 1200;
    } catch {
      return 1200;
    }
  });

  const [matchHistory, setMatchHistory] = useState<
    {
      id: string;
      date: string;
      opponent: string;
      result: 'Victory' | 'Defeat';
      eloDelta: number;
      laneWinner: string;
    }[]
  >(() => {
    try {
      const saved = localStorage.getItem('riftbound_match_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Modals
  const [showRankedModal, setShowRankedModal] = useState<boolean>(false);
  const [showRulesModal, setShowRulesModal] = useState<boolean>(false);
  const [showSurrenderDialog, setShowSurrenderDialog] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(soundFx.getMuted());
  const [showCombatLog, setShowCombatLog] = useState<boolean>(false);

  // Active Game State
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [tacticalGameState, setTacticalGameState] = useState<TacticalGameState | null>(null);
  const [selectedAirbase, setSelectedAirbase] = useState<StructureInstance | null>(null);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);

  const handleStartTacticalMatch = (preset: 'frontline' | 'citadel' | 'glade' = 'frontline') => {
    const initialState = initializeTacticalGame(preset);
    setTacticalGameState(initialState);
    setGameState(null);
    setScreen('battle');
  };

  // Elo Tier Calculation in Thai
  const getUserRankTitle = (elo: number) => {
    if (elo >= 1800) return 'ยอดฝีมือสูงสุด (Eternal)';
    if (elo >= 1600) return 'สถาปนิกมิติ (World Architect)';
    if (elo >= 1400) return 'ปรมาจารย์เน็กซัส (Nexus Master)';
    if (elo >= 1200) return 'ผู้ช่ำชองริฟต์ (Rift Adept)';
    if (elo >= 1000) return 'กองหน้าจู่โจม (Striker)';
    return 'ทหารเกณฑ์ใหม่ (Recruit)';
  };

  // Turn Timer Countdown: 60 seconds limit for deployment & movement phases
  useEffect(() => {
    if (!gameState || gameState.winner || isAiThinking) return;

    // Only tick down during deployment or movement phases
    if (gameState.phase !== 'deployment' && gameState.phase !== 'movement') {
      return;
    }

    const timer = setInterval(() => {
      setTurnTimeLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.phase, gameState?.turn, gameState?.activePlayerId, gameState?.winner, isAiThinking]);

  // When timer reaches 0 during deployment or movement phases, auto-trigger End Turn
  useEffect(() => {
    if (
      gameState &&
      !gameState.winner &&
      !isAiThinking &&
      turnTimeLeft === 0 &&
      (gameState.phase === 'deployment' || gameState.phase === 'movement')
    ) {
      handleForceEndTurn();
    }
  }, [turnTimeLeft]);

  // Save to localStorage when state changes
  useEffect(() => {
    localStorage.setItem('riftbound_custom_cards', JSON.stringify(customCards));
  }, [customCards]);

  useEffect(() => {
    localStorage.setItem('riftbound_user_decks', JSON.stringify(decks));
  }, [decks]);

  useEffect(() => {
    localStorage.setItem('riftbound_user_elo', userElo.toString());
  }, [userElo]);

  useEffect(() => {
    localStorage.setItem('riftbound_match_history', JSON.stringify(matchHistory));
  }, [matchHistory]);

  // Listen for Escape key to cancel card targeting without resource penalty
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && gameState?.actionMode === 'card-targeting') {
        handleCancelTargeting();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState?.actionMode]);

  // Cross-device multiplayer real-time synchronization
  useEffect(() => {
    if (!multiplayerRoom || !multiplayerRole || screen !== 'battle') return;

    const unsubscribe = multiplayerService.subscribeToRoom(
      multiplayerRoom.id,
      (updatedRoom) => {
        // If room was abandoned or opponent left
        if (updatedRoom.status === 'abandoned' && gameState && !gameState.winner) {
          const wonByAbandonState: GameState = {
            ...gameState,
            winner: multiplayerRole,
            winReason: 'คู่ต่อสู้ออกจากสมรภูมิหรือตัดการเชื่อมต่อ — คุณได้รับชัยชนะ!',
          };
          setGameState(wonByAbandonState);
          handleGameOver(multiplayerRole, wonByAbandonState);
          return;
        }

        if (!updatedRoom.gameState) return;

        // If remote player performed an action, play appropriate audio feedback
        if (
          updatedRoom.lastAction &&
          updatedRoom.lastAction.playerId !== multiplayerRole
        ) {
          switch (updatedRoom.lastAction.type) {
            case 'play-card':
            case 'airborne-drop':
              soundFx.playDeploy();
              break;
            case 'move-unit':
              soundFx.playMove();
              break;
            case 'attack-unit':
              soundFx.playAttack('kinetic');
              break;
            case 'next-phase':
              soundFx.playPhaseChange();
              break;
            case 'surrender':
              soundFx.playVictory();
              break;
            default:
              break;
          }
        }

        setGameState(updatedRoom.gameState);

        // Check winner update
        if (updatedRoom.gameState.winner) {
          const isWinner = updatedRoom.gameState.winner === multiplayerRole;
          if (isWinner) {
            soundFx.playVictory();
          } else {
            soundFx.playDefeat();
          }
        }
      },
      (error) => {
        console.warn('Multiplayer sync error:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [multiplayerRoom?.id, multiplayerRole, screen]);

  // Central state committer for syncing multiplayer state
  const commitGameState = (
    nextState: GameState,
    action: {
      type: MultiplayerAction['type'];
      description: string;
    }
  ) => {
    setGameState(nextState);
    if (multiplayerRoom && multiplayerRole) {
      multiplayerService
        .updateRoomGameState(multiplayerRoom.id, nextState, {
          type: action.type,
          playerId: multiplayerRole,
          description: action.description,
          timestamp: Date.now(),
        })
        .catch((err) => {
          console.warn('Failed to sync multiplayer state:', err);
        });
    }
  };

  // Launch a real-time cross-device multiplayer match
  const startMultiplayerMatch = async (room: MultiplayerRoomData, role: 'player1' | 'player2') => {
    // Cross-register custom cards from both players so both clients can resolve & render them!
    if (room.hostCustomCards && room.hostCustomCards.length > 0) {
      cardRegistry.registerMany(room.hostCustomCards);
    }
    if (room.guestCustomCards && room.guestCustomCards.length > 0) {
      cardRegistry.registerMany(room.guestCustomCards);
    }

    setMultiplayerRoom(room);
    setMultiplayerRole(role);

    if (role === 'player1') {
      const { cells, outposts } = generateBattlefield(room.mapPresetId);

      const makeDeckInstances = (deckCfg: DeckConfig, owner: 'player1' | 'player2'): CardInstance[] => {
        const shuffled = [...deckCfg.cardIds].sort(() => Math.random() - 0.5);
        return shuffled.map((cardId, idx) => ({
          instanceId: `inst-${owner}-${idx}-${Date.now()}`,
          definitionId: cardId,
          owner,
          currentZone: 'deck',
        }));
      };

      const hostDeck = room.hostDeck;
      const guestDeck = room.guestDeck || STARTER_DECKS[1];

      const p1Deck = makeDeckInstances(hostDeck, 'player1');
      const p2Deck = makeDeckInstances(guestDeck, 'player2');

      const p1Hand = p1Deck.splice(0, 4);
      const p2Hand = p2Deck.splice(0, 4);

      const partner1 = getCardDef(hostDeck.partnerId) || CARD_DATABASE['PARTNER-01'];
      const origin1 = getCardDef(hostDeck.originId) || CARD_DATABASE['ORIGIN-01'];
      const partner2 = getCardDef(guestDeck.partnerId) || CARD_DATABASE['PARTNER-02'];
      const origin2 = getCardDef(guestDeck.originId) || CARD_DATABASE['ORIGIN-02'];

      const initialP1: PlayerState = {
        id: 'player1',
        name: room.hostName || 'ผู้เล่น 1 (Host)',
        isAI: false,
        baseHealth: 30,
        maxBaseHealth: 30,
        resources: { charge: 2, maxCharge: 2, rift: 0, resolve: 2 },
        deck: p1Deck,
        hand: p1Hand,
        discard: [],
        partner: partner1,
        origin: origin1,
        elo: room.hostElo || 1200,
        rankTitle: room.hostRank || getUserRankTitle(room.hostElo || 1200),
      };

      const initialP2: PlayerState = {
        id: 'player2',
        name: room.guestName || 'ผู้เล่น 2 (Guest)',
        isAI: false,
        baseHealth: 30,
        maxBaseHealth: 30,
        resources: { charge: 2, maxCharge: 2, rift: 0, resolve: 2 },
        deck: p2Deck,
        hand: p2Hand,
        discard: [],
        partner: partner2,
        origin: origin2,
        elo: room.guestElo || 1200,
        rankTitle: room.guestRank || getUserRankTitle(room.guestElo || 1200),
      };

      const initialGameState: GameState = {
        id: `match-${room.id}-${Date.now()}`,
        turn: 1,
        activePlayerId: 'player1',
        phase: 'deployment',
        player1: initialP1,
        player2: initialP2,
        cells,
        units: {},
        structures: {},
        outposts,
        selectedCellId: null,
        selectedCardInstanceId: null,
        selectedUnitId: null,
        selectedStructureId: null,
        reachableCellIds: [],
        attackableCellIds: [],
        airborneLandingCellIds: [],
        actionMode: 'idle',
        combatLog: [
          `[เริ่มการประลองออนไลน์] สมรภูมิรหัส ${room.id} เชื่อมต่อสำเร็จ! ${initialP1.name} VS ${initialP2.name}`,
        ],
        winner: null,
        mode: 'room-lobby',
        roomCode: room.id,
      };

      try {
        await multiplayerService.startMatch(room.id, initialGameState);
        setGameState(initialGameState);
        setSelectedAirbase(null);
        setTurnTimeLeft(60);
        setScreen('battle');
      } catch (err) {
        console.error('Failed to start multiplayer match:', err);
      }
    } else {
      // Guest: Launch into battle with current room.gameState
      if (room.gameState) {
        setGameState(room.gameState);
        setSelectedAirbase(null);
        setTurnTimeLeft(60);
        setScreen('battle');
      }
    }
  };

  // Exit match handler for multiplayer and standard
  const handleExitBattle = async () => {
    if (multiplayerRoom && multiplayerRole) {
      await multiplayerService.leaveOrCloseRoom(multiplayerRoom.id, multiplayerRole === 'player1');
    }
    setMultiplayerRoom(null);
    setMultiplayerRole(null);
    setGameState(null);
    setTacticalGameState(null);
    setScreen('lobby');
  };

  // Factory function to start a new game match
  const startMatch = (mode: GamePlayMode, mapPresetId: string, roomCode?: string) => {
    setMultiplayerRoom(null);
    setMultiplayerRole(null);
    setTacticalGameState(null);
    const activeDeck = decks.find((d) => d.id === selectedDeckId) || STARTER_DECKS[0];
    const opponentDeck = STARTER_DECKS[1];

    // Pre-match Card Validation: ensure all cards exist and comply with engine mechanics
    const invalidReasons: string[] = [];
    for (const cardId of activeDeck.cardIds) {
      const def = getCardDef(cardId);
      if (!def) {
        invalidReasons.push(`ไม่พบข้อมูลการ์ดรหัส: ${cardId}`);
        continue;
      }
      const val = validateCardForMatch(def);
      if (!val.isPlayable) {
        invalidReasons.push(`${def.name}: ${val.reason || 'กลไกการ์ดยังไม่ผ่านเกณฑ์สมรภูมิ'}`);
      }
    }

    if (invalidReasons.length > 0) {
      soundFx.playError();
      setValidationErrorBanner(
        `เด็ค '${activeDeck.name}' มีการ์ดที่ไม่ผ่านกฎสมรภูมิ: ${invalidReasons.slice(0, 2).join(' | ')} (กรุณาปรับแก้ในจัดเด็คหรือเตาหลอม)`
      );
      return;
    }
    setValidationErrorBanner(null);

    const { cells, outposts } = generateBattlefield(mapPresetId);

    // Helper to instantiate deck
    const makeDeckInstances = (deckCfg: DeckConfig, owner: 'player1' | 'player2'): CardInstance[] => {
      // Shuffle 50 cards
      const shuffled = [...deckCfg.cardIds].sort(() => Math.random() - 0.5);
      return shuffled.map((cardId, idx) => ({
        instanceId: `inst-${owner}-${idx}-${Date.now()}`,
        definitionId: cardId,
        owner,
        currentZone: 'deck',
      }));
    };

    const p1Deck = makeDeckInstances(activeDeck, 'player1');
    const p2Deck = makeDeckInstances(opponentDeck, 'player2');

    // Draw initial 4 cards for each player
    const p1Hand = p1Deck.splice(0, 4);
    const p2Hand = p2Deck.splice(0, 4);

    const partner1 = getCardDef(activeDeck.partnerId) || CARD_DATABASE['PARTNER-01'];
    const origin1 = getCardDef(activeDeck.originId) || CARD_DATABASE['ORIGIN-01'];
    const partner2 = getCardDef(opponentDeck.partnerId) || CARD_DATABASE['PARTNER-02'];
    const origin2 = getCardDef(opponentDeck.originId) || CARD_DATABASE['ORIGIN-02'];

    const initialUnits: Record<string, UnitInstance> = {};
    const initialStructures: Record<string, StructureInstance> = {};

    // Starting resource values: 2 Charge, 0 Rift, 2 Resolve
    let p1Charge = 2;
    let p1Rift = 0;
    let p2Charge = 2;
    let p2Rift = 0;

    // SCENARIO MODE: Airborne Deployment Setup
    if (mode === 'airborne-scenario') {
      p1Charge = 4;
      p1Rift = 2;
      p2Charge = 4;

      // Spawn Airbase for Player 1 at Row 5, Col 0 (Left Lane Rear)
      const airbaseId = `airbase-p1-${Date.now()}`;
      initialStructures[airbaseId] = {
        id: airbaseId,
        cardInstanceId: `inst-airbase`,
        definitionId: 'IF-04',
        name: 'Tactical Airbase',
        owner: 'player1',
        universe: 'iron-frontier',
        currentHealth: 8,
        maxHealth: 8,
        defense: 2,
        lane: 'left',
        row: 5,
        col: 0,
        structureType: 'airbase',
      };
      cells[getCellId(5, 0)].structureId = airbaseId;

      // Spawn Player 1 Riflemen
      const p1RifleId = `unit-rifle-p1-${Date.now()}`;
      initialUnits[p1RifleId] = {
        id: p1RifleId,
        cardInstanceId: `inst-rifle-p1`,
        definitionId: 'IF-01',
        name: 'Frontline Riflemen',
        owner: 'player1',
        universe: 'iron-frontier',
        attack: 3,
        currentHealth: 4,
        maxHealth: 4,
        defense: 1,
        movePoints: 2,
        maxMove: 2,
        range: 1,
        canCapture: true,
        keywords: ['Infantry'],
        statusEffects: [],
        hasMovedThisTurn: false,
        hasAttackedThisTurn: false,
        lane: 'center',
        row: 4,
        col: 1,
      };
      cells[getCellId(4, 1)].unitId = p1RifleId;

      // Spawn Opponent Guard Mech
      const p2GuardId = `unit-guard-p2-${Date.now()}`;
      initialUnits[p2GuardId] = {
        id: p2GuardId,
        cardInstanceId: `inst-guard-p2`,
        definitionId: 'IF-02',
        name: 'Ironclad Trench Walker',
        owner: 'player2',
        universe: 'iron-frontier',
        attack: 4,
        currentHealth: 7,
        maxHealth: 7,
        defense: 3,
        movePoints: 1,
        maxMove: 1,
        range: 1,
        canCapture: true,
        keywords: ['Heavy Armor'],
        statusEffects: [],
        hasMovedThisTurn: false,
        hasAttackedThisTurn: false,
        lane: 'left',
        row: 2,
        col: 0,
      };
      cells[getCellId(2, 0)].unitId = p2GuardId;
    }

    const initialP1: PlayerState = {
      id: 'player1',
      name: 'ผู้เล่น 1 (สถาปนิก)',
      isAI: false,
      baseHealth: 30,
      maxBaseHealth: 30,
      resources: {
        charge: p1Charge,
        maxCharge: 2,
        rift: p1Rift,
        resolve: 2,
      },
      deck: p1Deck,
      hand: p1Hand,
      discard: [],
      partner: partner1,
      origin: origin1,
      elo: userElo,
      rankTitle: getUserRankTitle(userElo),
    };

    const initialP2: PlayerState = {
      id: 'player2',
      name: mode === 'hotseat' ? 'ผู้เล่น 2 (สถาปนิก)' : 'สถาปนิก AI อัลฟ่า',
      isAI: mode === 'ai-skirmish' || mode === 'airborne-scenario',
      baseHealth: 30,
      maxBaseHealth: 30,
      resources: {
        charge: p2Charge,
        maxCharge: 2,
        rift: p2Rift,
        resolve: 2,
      },
      deck: p2Deck,
      hand: p2Hand,
      discard: [],
      partner: partner2,
      origin: origin2,
      elo: 1220,
      rankTitle: 'ผู้ช่ำชองริฟต์ (Rift Adept)',
    };

    const newGameState: GameState = {
      id: `match-${Date.now()}`,
      turn: 1,
      activePlayerId: 'player1',
      phase: 'deployment',
      player1: initialP1,
      player2: initialP2,
      cells,
      units: initialUnits,
      structures: initialStructures,
      outposts,
      selectedCellId: null,
      selectedCardInstanceId: null,
      selectedUnitId: null,
      selectedStructureId: null,
      reachableCellIds: [],
      attackableCellIds: [],
      airborneLandingCellIds: [],
      actionMode: 'idle',
      combatLog: [
        `[เริ่มการรบ] เริ่มต้นปฏิบัติการในสมรภูมิ! โหมด: ${mode.toUpperCase()} เข้ายึดครองฐานยุทธศาสตร์แถวที่ 3 เพื่อเก็บเกี่ยวพลังงานและครองความได้เปรียบ`,
      ],
      winner: null,
      mode,
      roomCode,
    };

    setGameState(newGameState);
    setSelectedAirbase(null);
    setTurnTimeLeft(60);
    setScreen('battle');
  };

  // Automatically trigger End Turn when 60-second timer expires during deployment/movement
  const handleForceEndTurn = () => {
    if (!gameState || gameState.winner || isAiThinking) return;
    if (multiplayerRole && gameState.activePlayerId !== multiplayerRole) return;

    soundFx.playPhaseChange();
    let current = JSON.parse(JSON.stringify(gameState)) as GameState;

    // Reset selection highlights
    current.selectedCellId = null;
    current.selectedCardInstanceId = null;
    current.selectedUnitId = null;
    current.selectedStructureId = null;
    current.reachableCellIds = [];
    current.attackableCellIds = [];
    current.airborneLandingCellIds = [];
    current.actionMode = 'idle';
    setSelectedAirbase(null);

    const timedOutPlayerName =
      current.activePlayerId === 'player1' ? current.player1.name : current.player2.name;
    current.combatLog.unshift(
      `[หมดเวลา 60 วินาที] หมดเวลาสำหรับ ${timedOutPlayerName} — ระบบทำการส่งเทิร์นและสรุปผลอัตโนมัติ`
    );

    // Auto-resolve outpost captures on forced end
    current = resolveOutpostCaptures(current);

    // Switch active player
    const nextPlayerId = current.activePlayerId === 'player1' ? 'player2' : 'player1';
    current.activePlayerId = nextPlayerId;
    if (nextPlayerId === 'player1') {
      current.turn += 1;
    }

    // Start Phase & Economy Phase for new active player
    current = resolveEconomyIncome(current, nextPlayerId);

    // Draw 1 card for new active player
    const activeP = nextPlayerId === 'player1' ? current.player1 : current.player2;
    if (activeP.deck.length > 0 && activeP.hand.length < 7) {
      const drawn = activeP.deck.shift()!;
      activeP.hand.push(drawn);
      current.combatLog.unshift(`[จั่วการ์ด] ${activeP.name} ได้รับการ์ดยุทธวิธีใหม่ 1 ใบ`);
    }

    // Reset unit actions
    Object.values(current.units).forEach((u) => {
      if (u.owner === nextPlayerId) {
        u.hasMovedThisTurn = false;
        u.hasAttackedThisTurn = false;
        u.movePoints = u.maxMove;
      }
    });

    current.phase = 'deployment';
    setTurnTimeLeft(60);

    // Check if next player is AI
    if (activeP.isAI) {
      setGameState(current);
      setIsAiThinking(true);
      setTimeout(() => {
        let aiResolved = runAITurn(current);
        aiResolved = resolveOutpostCaptures(aiResolved);

        aiResolved.activePlayerId = 'player1';
        aiResolved.turn += 1;
        aiResolved = resolveEconomyIncome(aiResolved, 'player1');

        if (aiResolved.player1.deck.length > 0 && aiResolved.player1.hand.length < 7) {
          const drawn = aiResolved.player1.deck.shift()!;
          aiResolved.player1.hand.push(drawn);
        }

        Object.values(aiResolved.units).forEach((u) => {
          if (u.owner === 'player1') {
            u.hasMovedThisTurn = false;
            u.hasAttackedThisTurn = false;
            u.movePoints = u.maxMove;
          }
        });

        aiResolved.phase = 'deployment';
        aiResolved.combatLog.unshift(`[เทิร์น ${aiResolved.turn}] ผู้เล่น 1 เริ่มต้นเทิร์นใหม่`);
        setGameState(aiResolved);
        setIsAiThinking(false);
        setTurnTimeLeft(60);
        soundFx.playDeploy();
      }, 900);
      return;
    }

    commitGameState(current, {
      type: 'next-phase',
      description: `หมดเวลา 60 วินาที — สลับสู่เทิร์นของ ${activeP.name}`,
    });
  };

  // Handle phase advance or End Turn manually
  const handleNextPhase = () => {
    if (!gameState || gameState.winner || isAiThinking) return;
    if (multiplayerRole && gameState.activePlayerId !== multiplayerRole) {
      soundFx.playAttack('kinetic');
      return;
    }

    soundFx.playPhaseChange();
    let current = JSON.parse(JSON.stringify(gameState)) as GameState;

    // Reset selection highlights
    current.selectedCellId = null;
    current.selectedCardInstanceId = null;
    current.selectedUnitId = null;
    current.selectedStructureId = null;
    current.reachableCellIds = [];
    current.attackableCellIds = [];
    current.airborneLandingCellIds = [];
    current.actionMode = 'idle';
    setSelectedAirbase(null);

    const phases: TurnPhase[] = ['deployment', 'movement', 'combat', 'capture', 'end'];
    const currentPhaseIdx = phases.indexOf(current.phase);

    if (currentPhaseIdx < phases.length - 2) {
      // Step to next phase within same turn
      current.phase = phases[currentPhaseIdx + 1];
      setTurnTimeLeft(60);
      commitGameState(current, {
        type: 'next-phase',
        description: `ก้าวสู่เฟส ${current.phase}`,
      });
    } else {
      // End of turn reached! Run Capture Phase and End Phase resolution
      current = resolveOutpostCaptures(current);

      // Switch active player
      const nextPlayerId = current.activePlayerId === 'player1' ? 'player2' : 'player1';
      current.activePlayerId = nextPlayerId;
      if (nextPlayerId === 'player1') {
        current.turn += 1;
      }

      // Start Phase & Economy Phase for new active player
      current = resolveEconomyIncome(current, nextPlayerId);

      // Draw 1 card for new active player if deck has cards
      const activeP = nextPlayerId === 'player1' ? current.player1 : current.player2;
      if (activeP.deck.length > 0 && activeP.hand.length < 7) {
        const drawn = activeP.deck.shift()!;
        activeP.hand.push(drawn);
        current.combatLog.unshift(`[จั่วการ์ด] ${activeP.name} ได้รับการ์ดยุทธวิธีใหม่ 1 ใบ`);
      }

      // Reset unit action flags for new active player's units
      Object.values(current.units).forEach((u) => {
        if (u.owner === nextPlayerId) {
          u.hasMovedThisTurn = false;
          u.hasAttackedThisTurn = false;
          u.movePoints = u.maxMove;
        }
      });

      current.phase = 'deployment';
      current.combatLog.unshift(`[เทิร์น ${current.turn}] เทิร์นของ ${activeP.name} เริ่มต้นขึ้นแล้ว`);
      setTurnTimeLeft(60);

      // Check if next player is AI
      if (activeP.isAI) {
        setGameState(current);
        setIsAiThinking(true);
        setTimeout(() => {
          let aiResolved = runAITurn(current);
          aiResolved = resolveOutpostCaptures(aiResolved);

          // Return control to Player 1
          aiResolved.activePlayerId = 'player1';
          aiResolved.turn += 1;
          aiResolved = resolveEconomyIncome(aiResolved, 'player1');

          if (aiResolved.player1.deck.length > 0 && aiResolved.player1.hand.length < 7) {
            const drawn = aiResolved.player1.deck.shift()!;
            aiResolved.player1.hand.push(drawn);
          }

          Object.values(aiResolved.units).forEach((u) => {
            if (u.owner === 'player1') {
              u.hasMovedThisTurn = false;
              u.hasAttackedThisTurn = false;
              u.movePoints = u.maxMove;
            }
          });

          aiResolved.phase = 'deployment';
          aiResolved.combatLog.unshift(`[เทิร์น ${aiResolved.turn}] ผู้เล่น 1 เริ่มต้นเทิร์นใหม่`);
          setGameState(aiResolved);
          setIsAiThinking(false);
          setTurnTimeLeft(60);
          soundFx.playDeploy();
        }, 900);
        return;
      }

      commitGameState(current, {
        type: 'next-phase',
        description: `จบเทิร์น — ส่งมอบการบัญชาการให้ ${activeP.name}`,
      });
    }
  };

  // Cancel Targeting Action
  const handleCancelTargeting = () => {
    if (!gameState) return;
    soundFx.playCardSelect();
    setGameState({
      ...gameState,
      selectedCardInstanceId: null,
      validTargetCellIds: [],
      reachableCellIds: [],
      attackableCellIds: [],
      actionMode: 'idle',
    });
  };

  // Card Selection from Hand
  const handleHandCardClick = (cardInst: CardInstance) => {
    if (!gameState || gameState.winner || isAiThinking) return;
    if (multiplayerRole && gameState.activePlayerId !== multiplayerRole) {
      soundFx.playAttack('kinetic');
      return;
    }

    soundFx.playCardSelect();
    const check = canPlayCard(gameState, gameState.activePlayerId, cardInst.instanceId);

    if (!check.canPlay) {
      soundFx.playAttack('kinetic');
      const errLog = `[แจ้งเตือน] ไม่สามารถใช้การ์ด "${check.cardDef?.name || ''}": ${check.reason || 'เงื่อนไขไม่ถูกต้อง'}`;
      setGameState({
        ...gameState,
        combatLog: [errLog, ...gameState.combatLog],
      });
      return;
    }

    // If card has no target or global targeting, resolve immediately
    if (check.targetType === 'no-target' || check.targetType === 'global') {
      const res = resolveCardPlay(gameState, gameState.activePlayerId, cardInst.instanceId, {});
      if (res.success) {
        let next = res.nextState;
        if (res.logMessage) next.combatLog.unshift(res.logMessage);
        if (next.winner) {
          handleGameOver(next.winner, next);
          commitGameState(next, {
            type: 'play-card',
            description: res.logMessage || `ใช้งานการ์ด ${check.cardDef?.name || ''}`,
          });
          return;
        }
        commitGameState(next, {
          type: 'play-card',
          description: res.logMessage || `ใช้งานการ์ด ${check.cardDef?.name || ''}`,
        });
      }
      return;
    }

    // Otherwise enter card-targeting mode
    setGameState({
      ...gameState,
      selectedCardInstanceId: cardInst.instanceId,
      selectedUnitId: null,
      selectedCellId: null,
      reachableCellIds: [],
      attackableCellIds: [],
      airborneLandingCellIds: [],
      validTargetCellIds: check.validCellIds,
      actionMode: 'card-targeting',
    });
  };

  // Lane click targeting (for spells like Battle Cry or Carpet Bombing)
  const handleLaneClick = (lane: Lane) => {
    if (!gameState || gameState.winner || isAiThinking) return;
    if (multiplayerRole && gameState.activePlayerId !== multiplayerRole) return;
    if (gameState.actionMode !== 'card-targeting' || !gameState.selectedCardInstanceId) return;

    const res = resolveCardPlay(gameState, gameState.activePlayerId, gameState.selectedCardInstanceId, {
      lane,
    });
    if (res.success) {
      let next = res.nextState;
      if (res.logMessage) next.combatLog.unshift(res.logMessage);
      next.selectedCardInstanceId = null;
      next.validTargetCellIds = [];
      next.actionMode = 'idle';
      if (next.winner) {
        handleGameOver(next.winner, next);
      }
      commitGameState(next, {
        type: 'play-card',
        description: res.logMessage || `ร่ายการ์ดลงเลน ${lane}`,
      });
    }
  };

  // Unit click on battlefield
  const handleUnitClick = (unit: UnitInstance) => {
    if (!gameState || gameState.winner || isAiThinking) return;
    if (multiplayerRole && gameState.activePlayerId !== multiplayerRole) return;

    // If in card-targeting mode, allow clicking unit as target if its cell is valid
    if (gameState.actionMode === 'card-targeting') {
      const unitCellId = getCellId(unit.row, unit.col);
      if (gameState.validTargetCellIds?.includes(unitCellId)) {
        handleCellClick(unitCellId);
        return;
      }
    }

    if (unit.owner !== gameState.activePlayerId) return;

    soundFx.playCardSelect();

    let reachable: string[] = [];
    let attackable: string[] = [];

    if (gameState.phase === 'movement' && !unit.hasMovedThisTurn) {
      reachable = getReachableCells(unit, gameState.cells, gameState.units);
    }

    if (gameState.phase === 'combat' && !unit.hasAttackedThisTurn) {
      attackable = getAttackableCells(
        unit,
        gameState.cells,
        gameState.units,
        unit.owner === 'player1' ? 'player2' : 'player1'
      );
    }

    setGameState({
      ...gameState,
      selectedUnitId: unit.id,
      selectedCardInstanceId: null,
      selectedCellId: getCellId(unit.row, unit.col),
      reachableCellIds: reachable,
      attackableCellIds: attackable,
      airborneLandingCellIds: [],
      validTargetCellIds: [],
      actionMode: gameState.phase === 'movement' ? 'move' : gameState.phase === 'combat' ? 'attack' : 'idle',
    });
  };

  // Airbase Airborne Drop Action
  const handleAirbaseDropClick = (structure: StructureInstance) => {
    if (!gameState || gameState.winner || isAiThinking) return;
    if (multiplayerRole && gameState.activePlayerId !== multiplayerRole) return;

    const player = gameState.activePlayerId === 'player1' ? gameState.player1 : gameState.player2;
    if (player.resources.charge < 3 || player.resources.rift < 1) {
      alert('Airborne Deployment requires 3 Charge and 1 Rift.');
      return;
    }

    soundFx.playCardSelect();
    const landingCells = getAirborneLandingCells(gameState.cells, player.id);

    setSelectedAirbase(structure);
    setGameState({
      ...gameState,
      selectedStructureId: structure.id,
      selectedUnitId: null,
      selectedCardInstanceId: null,
      reachableCellIds: [],
      attackableCellIds: [],
      validTargetCellIds: [],
      airborneLandingCellIds: landingCells,
      actionMode: 'airbase-target',
    });
  };

  // Cell click on battlefield
  const handleCellClick = (cellId: string) => {
    if (!gameState || gameState.winner || isAiThinking) return;
    if (multiplayerRole && gameState.activePlayerId !== multiplayerRole) return;

    const {
      actionMode,
      selectedCardInstanceId,
      selectedUnitId,
      reachableCellIds,
      attackableCellIds,
      airborneLandingCellIds,
      validTargetCellIds,
    } = gameState;

    // 0. CARD TARGETING RESOLUTION
    if (
      actionMode === 'card-targeting' &&
      selectedCardInstanceId &&
      validTargetCellIds?.includes(cellId)
    ) {
      const targetCell = gameState.cells[cellId];
      const res = resolveCardPlay(gameState, gameState.activePlayerId, selectedCardInstanceId, {
        cellId,
        unitId: targetCell?.unitId || undefined,
        structureId: targetCell?.structureId || undefined,
        outpostId: targetCell?.outpostId || undefined,
        lane: targetCell?.lane,
      });

      if (res.success) {
        let next = res.nextState;
        if (res.logMessage) next.combatLog.unshift(res.logMessage);
        next.selectedCardInstanceId = null;
        next.validTargetCellIds = [];
        next.actionMode = 'idle';
        if (next.winner) {
          handleGameOver(next.winner, next);
        }
        commitGameState(next, {
          type: 'play-card',
          description: res.logMessage || 'ใช้งานการ์ดบนเป้าหมาย',
        });
      }
      return;
    }

    // 1. DEPLOYMENT CONFIRMATION (Legacy fallback if deploy mode)
    if (actionMode === 'deploy' && selectedCardInstanceId && reachableCellIds.includes(cellId)) {
      const res = resolveCardPlay(gameState, gameState.activePlayerId, selectedCardInstanceId, {
        cellId,
      });
      if (res.success) {
        let next = res.nextState;
        if (res.logMessage) next.combatLog.unshift(res.logMessage);
        next.selectedCardInstanceId = null;
        next.reachableCellIds = [];
        next.actionMode = 'idle';
        commitGameState(next, {
          type: 'play-card',
          description: res.logMessage || 'จัดวางกำลังพล',
        });
      }
      return;
    }

    // 2. MOVEMENT CONFIRMATION (Using robust BFS engine)
    if (actionMode === 'move' && selectedUnitId && reachableCellIds.includes(cellId)) {
      const { nextState, logMessage } = executeUnitMovement(gameState, selectedUnitId, cellId);
      if (logMessage) nextState.combatLog.unshift(logMessage);
      const next = {
        ...nextState,
        selectedUnitId: null,
        selectedCellId: null,
        reachableCellIds: [],
        actionMode: 'idle' as const,
      };
      commitGameState(next, {
        type: 'move-unit',
        description: logMessage || 'เคลื่อนย้ายกำลังพล',
      });
      return;
    }

    // 3. COMBAT ATTACK CONFIRMATION
    if (actionMode === 'attack' && selectedUnitId && attackableCellIds.includes(cellId)) {
      const attacker = gameState.units[selectedUnitId];
      if (!attacker) return;

      try {
        const combat = executeCombat(attacker, cellId, gameState);
        let next = combat.nextState;

        const nextAfterCombat = {
          ...next,
          selectedUnitId: null,
          selectedCellId: null,
          attackableCellIds: [],
          actionMode: 'idle' as const,
        };

        if (nextAfterCombat.winner) {
          handleGameOver(nextAfterCombat.winner, nextAfterCombat);
        }

        commitGameState(nextAfterCombat, {
          type: 'attack-unit',
          description: 'โจมตีเป้าหมายในการรบ',
        });
      } catch (err: unknown) {
        console.error('Combat execution error:', err);
      }
      return;
    }

    // 4. AIRBASE AIRBORNE DEPLOYMENT CONFIRMATION
    if (actionMode === 'airbase-target' && airborneLandingCellIds.includes(cellId)) {
      try {
        const next = performAirborneDeployment(gameState, gameState.activePlayerId, cellId);
        setSelectedAirbase(null);
        const nextAfterDrop = {
          ...next,
          selectedStructureId: null,
          airborneLandingCellIds: [],
          actionMode: 'idle' as const,
        };
        commitGameState(nextAfterDrop, {
          type: 'airborne-drop',
          description: 'ส่งกำลังพลร่มทางอากาศลงสู่เป้าหมาย',
        });
      } catch (err: unknown) {
        alert(err instanceof Error ? err.message : 'Airborne drop failed');
      }
      return;
    }

    // Default cell selection
    setGameState({
      ...gameState,
      selectedCellId: cellId,
      reachableCellIds: [],
      attackableCellIds: [],
      airborneLandingCellIds: [],
      actionMode: 'idle',
    });
  };

  // Surrender Handler
  const handleSurrender = () => {
    if (!gameState) return;
    const winnerId: 'player1' | 'player2' = gameState.activePlayerId === 'player1' ? 'player2' : 'player1';
    const next: GameState = { ...gameState, winner: winnerId, winReason: 'ฝ่ายตรงข้ามขอยอมแพ้' };
    setShowSurrenderDialog(false);
    handleGameOver(winnerId, next);
    if (multiplayerRoom && multiplayerRole) {
      multiplayerService
        .updateRoomGameState(multiplayerRoom.id, next, {
          type: 'surrender',
          playerId: multiplayerRole,
          description: 'ผู้เล่นขอยอมแพ้ในการรบ',
          timestamp: Date.now(),
        })
        .catch(console.warn);
    }
  };

  // Game Over Handler
  const handleGameOver = (winnerId: 'player1' | 'player2', stateToUpdate: GameState) => {
    const isPlayerWin = winnerId === 'player1';
    const eloChange = isPlayerWin ? 25 : -18;
    const newElo = Math.max(800, userElo + eloChange);
    setUserElo(newElo);

    const record = {
      id: `match-${Date.now()}`,
      date: new Date().toLocaleDateString(),
      opponent: stateToUpdate.player2.name,
      result: isPlayerWin ? ('Victory' as const) : ('Defeat' as const),
      eloDelta: eloChange,
      laneWinner: `${stateToUpdate.player1.baseHealth} - ${stateToUpdate.player2.baseHealth} HP`,
    };
    setMatchHistory([record, ...matchHistory]);
    setGameState(stateToUpdate);
  };

  // Active player resources
  const activeP = gameState?.activePlayerId === 'player1' ? gameState.player1 : gameState?.player2;
  const inspectedCard = gameState?.selectedCardInstanceId
    ? getCardDef(
        activeP?.hand.find((c) => c.instanceId === gameState.selectedCardInstanceId)?.definitionId || ''
      ) || null
    : gameState?.selectedUnitId && gameState.units[gameState.selectedUnitId]
    ? getCardDef(gameState.units[gameState.selectedUnitId].definitionId) || null
    : null;

  // Render Screens
  if (screen === 'deckbuilder') {
    return (
      <DeckBuilder
        currentDeck={decks.find((d) => d.id === selectedDeckId) || decks[0]}
        customCards={customCards}
        onSaveDeck={(saved) => {
          const idx = decks.findIndex((d) => d.id === saved.id);
          if (idx >= 0) {
            const copy = [...decks];
            copy[idx] = saved;
            setDecks(copy);
          } else {
            setDecks([...decks, saved]);
          }
          setSelectedDeckId(saved.id);
        }}
        onClose={() => setScreen('lobby')}
      />
    );
  }

  if (screen === 'my-collection') {
    return (
      <MyCollection
        onOpenForge={(contentId) => {
          setEditingContentId(contentId);
          setRemixDraft(undefined);
          setScreen('creator');
        }}
        onAddToDeck={(cardDef) => {
          cardRegistry.registerCard(cardDef);
          setCustomCards((prev) => {
            const filtered = prev.filter((c) => c.id !== cardDef.id);
            return [cardDef, ...filtered];
          });
        }}
        onClose={() => setScreen('lobby')}
      />
    );
  }

  if (screen === 'public-gallery') {
    return (
      <PublicGallery
        onRemixCard={(forked) => {
          setRemixDraft(forked);
          setEditingContentId(undefined);
          setScreen('creator');
        }}
        onClose={() => setScreen('lobby')}
      />
    );
  }

  if (screen === 'creator') {
    return (
      <UnitForge
        initialContentId={editingContentId}
        initialDraft={remixDraft}
        onSaveUnit={(newCard) => {
          setCustomCards((prev) => {
            const filtered = prev.filter((c) => c.id !== newCard.id);
            return [newCard, ...filtered];
          });
          cardRegistry.registerCard(newCard);
        }}
        onClose={() => {
          setEditingContentId(undefined);
          setRemixDraft(undefined);
          setScreen('lobby');
        }}
      />
    );
  }

  if (screen === 'battle' && tacticalGameState) {
    return (
      <TacticalMapView
        state={tacticalGameState}
        onStateChange={setTacticalGameState}
        viewerRole={multiplayerRole || 'player1'}
        onExitMatch={() => {
          setTacticalGameState(null);
          setScreen('lobby');
        }}
      />
    );
  }

  if (screen === 'lobby' || !gameState) {
    return (
      <>
        {validationErrorBanner && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-xl w-[92%] bg-rose-950/95 border border-rose-500/80 rounded-xl p-3.5 shadow-2xl backdrop-blur-md flex items-start justify-between gap-3 text-rose-100">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <div className="font-bold text-rose-200">ไม่สามารถเริ่มสมรภูมิได้</div>
                <div>{validationErrorBanner}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setScreen('deckbuilder')}
                className="text-[11px] font-bold px-2.5 py-1 rounded bg-rose-800 hover:bg-rose-700 text-white transition"
              >
                จัดเด็ค
              </button>
              <button
                onClick={() => setValidationErrorBanner(null)}
                className="text-xs p-1 text-rose-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        <MultiplayerLobby
          decks={decks}
          selectedDeckId={selectedDeckId}
          onSelectDeckId={setSelectedDeckId}
          onStartGame={startMatch}
          onStartMultiplayerMatch={startMultiplayerMatch}
          onStartTacticalMatch={handleStartTacticalMatch}
          customCards={customCards}
          onOpenDeckBuilder={() => setScreen('deckbuilder')}
          onOpenCardCreator={() => {
            setEditingContentId(undefined);
            setRemixDraft(undefined);
            setScreen('creator');
          }}
          onOpenMyCollection={() => setScreen('my-collection')}
          onOpenPublicGallery={() => setScreen('public-gallery')}
          onOpenRanked={() => setShowRankedModal(true)}
          onOpenRules={() => setShowRulesModal(true)}
          userElo={userElo}
          userRank={getUserRankTitle(userElo)}
        />
        {showRankedModal && (
          <RankedModal
            userElo={userElo}
            userRank={getUserRankTitle(userElo)}
            matchHistory={matchHistory}
            onClose={() => setShowRankedModal(false)}
          />
        )}
        {showRulesModal && <RulesModal onClose={() => setShowRulesModal(false)} />}
      </>
    );
  }

  // ==========================================
  // ==========================================
  // ACTIVE BATTLE SCREEN
  // ==========================================
  const myPlayer = multiplayerRole === 'player2' ? gameState.player2 : gameState.player1;
  const opponentPlayer = multiplayerRole === 'player2' ? gameState.player1 : gameState.player2;
  const isMyTurn = !multiplayerRole || gameState.activePlayerId === (multiplayerRole || 'player1');

  const canAffordAirborne =
    (myPlayer.resources.charge ?? 0) >= 3 && (myPlayer.resources.rift ?? 0) >= 1 && isMyTurn;

  const targetingCardDef = gameState?.selectedCardInstanceId
    ? getCardDef(
        myPlayer.hand.find((c) => c.instanceId === gameState.selectedCardInstanceId)?.definitionId || ''
      ) || null
    : null;

  return (
    <div className="rift-game-screen flex flex-col min-h-screen w-full bg-slate-950 text-slate-100 select-none overflow-x-hidden">
      {/* 1. แถบสถานะส่วนบนและตัวจับเวลาเทิร์น (TOP STATUS BAR & TURN TIMER) */}
      <header className="rift-game-header flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800 z-20 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleExitBattle}
            className="text-xs font-bold text-slate-400 hover:text-cyan-300 transition-colors uppercase tracking-wider cursor-pointer"
          >
            ← ออกจากสมรภูมิ
          </button>
          <span className="text-slate-600">|</span>
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-sm text-cyan-400">
              เทิร์น {gameState.turn}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-950 text-indigo-300 border border-indigo-700/50">
              {gameState.phase === 'deployment'
                ? 'เฟสจัดวางกำลัง'
                : gameState.phase === 'movement'
                ? 'เฟสเคลื่อนพล'
                : gameState.phase === 'combat'
                ? 'เฟสประจัญบาน'
                : gameState.phase === 'capture'
                ? 'เฟสยึดครอง'
                : 'จบเทิร์น'}
            </span>
          </div>

          {/* TURN TIMER BADGE (60s countdown for deployment & movement phases) */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono-nums text-xs font-bold transition-all ${
              gameState.phase !== 'deployment' && gameState.phase !== 'movement'
                ? 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                : turnTimeLeft <= 10
                ? 'bg-rose-950/90 border-rose-600 text-rose-300 animate-pulse shadow-md shadow-rose-950/80 ring-1 ring-rose-500'
                : turnTimeLeft <= 20
                ? 'bg-amber-950/70 border-amber-600 text-amber-300'
                : 'bg-cyan-950/60 border-cyan-700 text-cyan-300'
            }`}
            title="ตัวจับเวลาเฟสจัดวางกำลังและเคลื่อนพล (จำกัด 60 วินาที ระบบจะจบเทิร์นอัตโนมัติเมื่อหมดเวลา)"
          >
            <Timer
              className={`w-3.5 h-3.5 ${
                turnTimeLeft <= 10 &&
                (gameState.phase === 'deployment' || gameState.phase === 'movement')
                  ? 'text-rose-400 animate-spin'
                  : 'text-cyan-400'
              }`}
            />
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-sans hidden sm:inline">
              เวลาคงเหลือ:
            </span>
            <span className="tracking-wider">
              {gameState.phase === 'deployment' || gameState.phase === 'movement'
                ? `00:${turnTimeLeft < 10 ? `0${turnTimeLeft}` : turnTimeLeft}`
                : '--:--'}
            </span>
          </div>
        </div>

        {/* Center: Turn Ownership & Multiplayer Status */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {multiplayerRole ? (
            <>
              {/* Multiplayer Room Badge */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-950/80 border border-purple-600/50 text-[11px] font-mono font-bold text-purple-200">
                <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                <span>ห้อง: {multiplayerRoom?.id}</span>
                <button
                  onClick={() => {
                    if (multiplayerRoom?.id) {
                      navigator.clipboard.writeText(multiplayerRoom.id);
                      setCopiedRoomCode(true);
                      setTimeout(() => setCopiedRoomCode(false), 2000);
                    }
                  }}
                  className="text-purple-300 hover:text-white cursor-pointer ml-0.5"
                  title="คัดลอกรหัสห้อง"
                >
                  {copiedRoomCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Dynamic Turn Indicator */}
              <div
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isMyTurn
                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500 shadow-md shadow-emerald-950/80 animate-pulse'
                    : 'bg-slate-800/80 text-slate-400 border border-slate-700'
                }`}
              >
                <span>
                  {isMyTurn ? '⚡ เทิร์นของคุณ (ออกคำสั่งการรบ)' : `⏳ กำลังรอฝ่ายตรงข้าม (${opponentPlayer.name})...`}
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="text-slate-400">ผู้บัญชาการ:</span>
              <span
                className={`font-bold ${
                  gameState.activePlayerId === 'player1' ? 'text-sky-400' : 'text-rose-400'
                }`}
              >
                {activeP?.name}
              </span>
              {isAiThinking && (
                <span className="text-amber-400 font-semibold animate-pulse text-xs">
                  (AI กำลังคำนวณกลยุทธ์...)
                </span>
              )}
            </>
          )}
        </div>

        {/* Right: Opponent HP Summary & Controls */}
        <div className="flex items-center gap-2">
          {multiplayerRole && (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs">
              <span className="text-slate-400">คู่ต่อสู้:</span>
              <span className="font-bold text-rose-400">{opponentPlayer.name}</span>
              <span className="text-rose-300 font-mono font-bold">({opponentPlayer.baseHealth} HP)</span>
            </div>
          )}

          <button
            onClick={() => {
              const muted = soundFx.toggleMute();
              setIsMuted(muted);
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            title={isMuted ? 'เปิดเสียงเอฟเฟกต์' : 'ปิดเสียง'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          <button
            onClick={() => setShowRulesModal(true)}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold cursor-pointer"
          >
            คู่มือรบ
          </button>

          <button
            onClick={() => setShowSurrenderDialog(true)}
            className="px-2.5 py-1 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-bold border border-rose-800/40 cursor-pointer"
          >
            ยอมแพ้
          </button>
        </div>
      </header>

      {/* 2. MAIN BATTLE AREA & SIDEBAR */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 p-3 max-w-7xl mx-auto w-full overflow-hidden">
        {/* BATTLEFIELD GRID (8 cols) */}
        <div className="lg:col-span-8 flex flex-col justify-center relative">
          {/* FLOATING TARGETING BANNER */}
          {gameState.actionMode === 'card-targeting' && targetingCardDef && (
            <div className="rift-targeting-banner mb-2 p-3 bg-purple-950/95 border border-purple-500 rounded-xl shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md z-30 animate-pulse">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-purple-900 border border-purple-400 flex items-center justify-center shrink-0">
                  <Target className="w-5 h-5 text-purple-200" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-100 truncate">
                      กำลังเลือกเป้าหมาย: {targetingCardDef.name}
                    </span>
                    <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-500/40 shrink-0">
                      ⚡{targetingCardDef.cost.charge || 0}
                      {targetingCardDef.cost.rift ? ` 🌀${targetingCardDef.cost.rift}` : ''}
                    </span>
                  </div>
                  <div className="text-[11px] text-purple-300/90 truncate">
                    {targetingCardDef.targetRule?.promptText || 'คลิกเลือกช่อง ยูนิต หรือเลนที่ถูกไฮไลต์ในสนามรบ'}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCancelTargeting}
                className="px-3 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>ยกเลิก (Cancel)</span>
                <span className="text-[9px] opacity-75 font-mono hidden sm:inline">[ESC]</span>
              </button>
            </div>
          )}

          <BattlefieldView
            state={gameState}
            onCellClick={handleCellClick}
            onUnitClick={handleUnitClick}
            onAirbaseDropClick={handleAirbaseDropClick}
            onLaneClick={handleLaneClick}
            canPerformAirborneDrop={canAffordAirborne}
            selectedAirbase={selectedAirbase}
          />
        </div>

        {/* RIGHT CONTROL COLUMN: INSPECTOR & LOGS (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-3 justify-between">
          {/* Active / Local Player Resource Hub */}
          <div className="rift-panel rift-resource-panel p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                คลังพลังงาน ({myPlayer.name})
              </span>
              <span className="text-[10px] text-slate-500 font-mono-nums">
                ฐานที่ยึด: +รายได้ประจำเทิร์น
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center font-mono-nums">
              <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-800/40">
                <div className="text-[10px] uppercase font-bold text-amber-400 flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3" /> ประจุไฟฟ้า
                </div>
                <div className="text-base font-bold text-amber-300 mt-0.5">
                  {myPlayer.resources.charge} / {myPlayer.resources.maxCharge}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-800/40">
                <div className="text-[10px] uppercase font-bold text-purple-400 flex items-center justify-center gap-1">
                  <Radio className="w-3 h-3" /> พลังริฟต์
                </div>
                <div className="text-base font-bold text-purple-300 mt-0.5">
                  {myPlayer.resources.rift}
                </div>
              </div>

              <div className="p-2 rounded-lg bg-sky-950/30 border border-sky-800/40">
                <div className="text-[10px] uppercase font-bold text-sky-400 flex items-center justify-center gap-1">
                  <Shield className="w-3 h-3" /> มุ่งมั่น
                </div>
                <div className="text-base font-bold text-sky-300 mt-0.5">
                  {myPlayer.resources.resolve}
                </div>
              </div>
            </div>
          </div>

          {/* Card / Unit Tactical Inspector */}
          <div className="rift-inspector flex-1 flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900/70 border border-slate-800">
            {inspectedCard ? (
              <div className="scale-90 sm:scale-95 transition-transform">
                <CardView card={inspectedCard} variant="detail" />
              </div>
            ) : (
              <div className="text-center p-6 text-slate-500 text-xs italic">
                {isMyTurn
                  ? 'เลือกการ์ดในมือเพื่อดูตัวอย่างการจัดวางกำลัง หรือคลิกยูนิตในสนามเพื่อออกคำสั่งเดินทัพและโจมตี'
                  : 'กำลังรอฝ่ายตรงข้ามออกคำสั่ง... คุณสามารถคลิกดูรายละเอียดการ์ดหรือยูนิตในสนามได้'}
              </div>
            )}
          </div>

          {/* Phase Advance / End Turn Big CTA Button */}
          <button
            onClick={handleNextPhase}
            disabled={isAiThinking || !isMyTurn}
            className={`rift-phase-cta w-full py-3.5 px-4 rounded-xl font-display font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl transition-all ${
              !isMyTurn
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                : gameState.phase === 'capture' || gameState.phase === 'end'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 shadow-emerald-950/60 cursor-pointer'
                : 'bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 shadow-cyan-950/60 cursor-pointer'
            }`}
          >
            <span>
              {!isMyTurn
                ? `รอ ${opponentPlayer.name}...`
                : gameState.phase === 'deployment'
                ? 'ก้าวสู่เฟสเคลื่อนพล'
                : gameState.phase === 'movement'
                ? 'ก้าวสู่เฟสประจัญบาน'
                : gameState.phase === 'combat'
                ? 'ก้าวสู่เฟสยึดครอง'
                : 'สรุปผลและจบเทิร์น'}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. แถบการ์ดบนมือ (BOTTOM HAND CAROUSEL DOCK - Renders local player's hand) */}
      <div className="rift-hand-dock sticky bottom-0 z-20 w-full bg-slate-950/95 border-t border-slate-800 p-2.5 backdrop-blur-md">
        <div className="flex items-center justify-between max-w-7xl mx-auto gap-3">
          <div className="text-xs font-bold text-slate-400 shrink-0 hidden sm:block">
            <span>การ์ดบนมือของคุณ ({myPlayer.hand.length || 0})</span>
            <div className="text-[10px] text-slate-500">
              กองการ์ด: {myPlayer.deck.length || 0} ใบ
            </div>
          </div>

          {/* Horizontal scrollable cards */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 flex-1">
            {myPlayer.hand.map((cardInst) => {
              const def = getCardDef(cardInst.definitionId);
              if (!def) return null;
              const canAfford =
                (myPlayer.resources.charge >= (def.cost.charge || 0)) &&
                (myPlayer.resources.rift >= (def.cost.rift || 0)) &&
                isMyTurn;

              return (
                <CardView
                  key={cardInst.instanceId}
                  card={def}
                  variant="hand"
                  isSelected={gameState.selectedCardInstanceId === cardInst.instanceId}
                  canAfford={canAfford}
                  onClick={() => {
                    if (!isMyTurn) {
                      soundFx.playAttack('kinetic');
                      return;
                    }
                    handleHandCardClick(cardInst);
                  }}
                />
              );
            })}
          </div>

          {/* Toggle Combat Log Drawer Button */}
          <button
            onClick={() => setShowCombatLog(!showCombatLog)}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 font-semibold shrink-0 cursor-pointer"
          >
            <span>บันทึกรบ</span>
            {showCombatLog ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* COMBAT LOG SLIDE-OVER */}
      {showCombatLog && (
        <div className="rift-combat-log fixed bottom-24 right-4 z-40 max-w-md w-full bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-2xl max-h-60 overflow-y-auto font-mono-nums text-xs">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 mb-2">
            <span className="font-bold text-slate-300">บันทึกการปะทะทางยุทธวิธี</span>
            <button onClick={() => setShowCombatLog(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
              ✕
            </button>
          </div>
          <div className="space-y-1">
            {gameState.combatLog.map((log, i) => (
              <div key={i} className="text-[11px] text-slate-400 leading-tight">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SURRENDER CONFIRMATION MODAL */}
      {showSurrenderDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-rose-900/60 rounded-xl p-5 max-w-sm w-full text-center">
            <AlertOctagon className="w-10 h-10 text-rose-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-100">ต้องการยอมจำนนหรือไม่?</h3>
            <p className="text-xs text-slate-400 mt-1">
              การยอมแพ้จะถือว่าสิ้นสุดการรบทันที และส่งผลให้ฝ่ายตรงข้ามเป็นผู้ชนะ
            </p>
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setShowSurrenderDialog(false)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 cursor-pointer"
              >
                สู้รบต่อไป
              </button>
              <button
                onClick={handleSurrender}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white cursor-pointer"
              >
                ยืนยันการยอมแพ้
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VICTORY / DEFEAT GAME OVER MODAL */}
      {gameState.winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 max-w-md w-full text-center shadow-2xl">
            {(() => {
              const isLocalPlayerWinner = multiplayerRole
                ? gameState.winner === multiplayerRole
                : gameState.winner === 'player1';

              return (
                <>
                  <div
                    className={`font-display font-black text-3xl tracking-widest uppercase mb-1 ${
                      isLocalPlayerWinner ? 'text-cyan-400' : 'text-rose-500'
                    }`}
                  >
                    {isLocalPlayerWinner ? 'ยึดครองสมรภูมิสำเร็จ!' : 'แนวรบถูกตีแตกพ่าย!'}
                  </div>
                  <div className="text-sm text-slate-300 font-semibold mb-4">
                    {gameState.winReason || (isLocalPlayerWinner ? 'คว้าชัยชนะอย่างเด็ดขาด!' : 'พ่ายแพ้ในการรบ')}
                  </div>

                  <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-1 mb-5">
                    <div className="flex justify-between text-slate-400">
                      <span>อัปเดตระดับคะแนน:</span>
                      <span className="font-mono-nums font-bold text-amber-300">
                        {userElo} ELO ({isLocalPlayerWinner ? '+25' : '-18'})
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>เทิร์นสุดท้าย:</span>
                      <span className="font-mono-nums text-slate-200">{gameState.turn}</span>
                    </div>
                    {multiplayerRoom && (
                      <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800">
                        <span>ห้องประลอง:</span>
                        <span className="font-mono text-purple-300">{multiplayerRoom.id}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleExitBattle}
                      className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                    >
                      กลับสู่ล็อบบี้
                    </button>
                    {!multiplayerRole && (
                      <button
                        onClick={() => startMatch(gameState.mode, 'map-forest-frontier')}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-xs font-bold text-slate-950 shadow-lg shadow-cyan-950/40 cursor-pointer"
                      >
                        เล่นนัดล้างตา
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {showRulesModal && <RulesModal onClose={() => setShowRulesModal(false)} />}
    </div>
  );
}
