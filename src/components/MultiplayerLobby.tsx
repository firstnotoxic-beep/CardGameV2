import React, { useState, useEffect } from 'react';
import { CardDefinition, DeckConfig } from '../types/game';
import { MAP_PRESETS, MapPreset } from '../game/battlefield';
import {
  Bot,
  Users,
  Plane,
  Globe,
  Play,
  Sparkles,
  Shield,
  Layers,
  HelpCircle,
  FolderHeart,
  Copy,
  Check,
  Loader2,
  RefreshCw,
  Radio,
  ArrowRight,
  LogOut,
  Swords,
} from 'lucide-react';
import { soundFx } from '../utils/audio';
import {
  multiplayerService,
  MultiplayerRoomData,
  generateRoomCode,
} from '../services/multiplayerService';

export type GamePlayMode = 'tactical-rts' | 'ai-skirmish' | 'hotseat' | 'airborne-scenario' | 'room-lobby';

interface MultiplayerLobbyProps {
  decks: DeckConfig[];
  selectedDeckId: string;
  onSelectDeckId: (id: string) => void;
  onStartGame: (mode: GamePlayMode, mapId: string, roomCode?: string) => void;
  onStartMultiplayerMatch?: (room: MultiplayerRoomData, role: 'player1' | 'player2') => void;
  onStartTacticalMatch?: (preset?: 'frontline' | 'citadel' | 'glade') => void;
  customCards?: CardDefinition[];
  onOpenDeckBuilder: () => void;
  onOpenCardCreator: () => void;
  onOpenMyCollection: () => void;
  onOpenPublicGallery: () => void;
  onOpenRanked: () => void;
  onOpenRules: () => void;
  userElo: number;
  userRank: string;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  decks,
  selectedDeckId,
  onSelectDeckId,
  onStartGame,
  onStartMultiplayerMatch,
  onStartTacticalMatch,
  customCards = [],
  onOpenDeckBuilder,
  onOpenCardCreator,
  onOpenMyCollection,
  onOpenPublicGallery,
  onOpenRanked,
  onOpenRules,
  userElo,
  userRank,
}) => {
  const [mode, setMode] = useState<GamePlayMode>('tactical-rts');
  const [selectedMapId, setSelectedMapId] = useState<string>('map-forest-frontier');

  // Multiplayer sub-tab: 'create' | 'join' | 'browse'
  const [multiplayerTab, setMultiplayerTab] = useState<'create' | 'join' | 'browse'>('create');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Active Hosted or Joined Room state in lobby
  const [activeRoom, setActiveRoom] = useState<MultiplayerRoomData | null>(null);
  const [userRole, setUserRole] = useState<'player1' | 'player2' | null>(null);
  const [openRooms, setOpenRooms] = useState<MultiplayerRoomData[]>([]);
  const [isRefreshingRooms, setIsRefreshingRooms] = useState<boolean>(false);

  const selectedDeck = decks.find((d) => d.id === selectedDeckId) || decks[0];
  const selectedMap = MAP_PRESETS.find((m) => m.id === selectedMapId) || MAP_PRESETS[0];

  // Subscribe to room changes when in an active room
  useEffect(() => {
    if (!activeRoom) return;

    const unsubscribe = multiplayerService.subscribeToRoom(
      activeRoom.id,
      (updatedRoom) => {
        setActiveRoom(updatedRoom);

        // If Guest is waiting and Host starts match, launch for Guest!
        if (
          userRole === 'player2' &&
          updatedRoom.status === 'in_progress' &&
          updatedRoom.gameState &&
          onStartMultiplayerMatch
        ) {
          soundFx.playDeploy();
          onStartMultiplayerMatch(updatedRoom, 'player2');
        }
      },
      (error) => {
        console.error('Lobby room subscription error:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [activeRoom?.id, userRole, onStartMultiplayerMatch]);

  // Load open rooms when switching to 'browse' tab
  const refreshOpenRooms = async () => {
    setIsRefreshingRooms(true);
    setErrorMessage(null);
    try {
      const rooms = await multiplayerService.getOpenRooms();
      setOpenRooms(rooms);
    } catch {
      setErrorMessage('ไม่สามารถโหลดรายชื่อห้องสาธารณะได้');
    } finally {
      setIsRefreshingRooms(false);
    }
  };

  useEffect(() => {
    if (mode === 'room-lobby' && multiplayerTab === 'browse') {
      refreshOpenRooms();
    }
  }, [mode, multiplayerTab]);

  const handleCopyCode = (code: string) => {
    try {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
      soundFx.playCardSelect();
    } catch {
      // Fallback
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  // Host: Create a new room
  const handleCreateRoom = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    soundFx.playCardSelect();

    try {
      const generatedCode = generateRoomCode();
      const room = await multiplayerService.createRoom({
        roomCode: generatedCode,
        mapPresetId: selectedMapId,
        hostDeck: selectedDeck,
        hostCustomCards: customCards,
        hostName: `สถาปนิก (${userRank.split(' ')[0]})`,
        hostElo: userElo,
        hostRank: userRank,
      });

      setActiveRoom(room);
      setUserRole('player1');
      soundFx.playPhaseChange();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการสร้างห้อง');
      soundFx.playAttack('kinetic');
    } finally {
      setIsLoading(false);
    }
  };

  // Guest: Join room by code
  const handleJoinRoom = async (codeToJoin?: string) => {
    const targetCode = (codeToJoin || joinCodeInput).trim().toUpperCase();
    if (!targetCode) {
      setErrorMessage('กรุณากรอกรหัสห้อง เช่น NX-4291');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    soundFx.playCardSelect();

    try {
      const room = await multiplayerService.joinRoom(targetCode, {
        guestDeck: selectedDeck,
        guestCustomCards: customCards,
        guestName: `ผู้ท้าชิง (${userRank.split(' ')[0]})`,
        guestElo: userElo,
        guestRank: userRank,
      });

      setActiveRoom(room);
      setUserRole('player2');
      soundFx.playPhaseChange();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'ไม่สามารถเข้าร่วมห้องได้');
      soundFx.playAttack('kinetic');
    } finally {
      setIsLoading(false);
    }
  };

  // Host: Launch match when guest is ready
  const handleHostLaunchMatch = () => {
    if (!activeRoom || !onStartMultiplayerMatch) return;
    soundFx.playDeploy();
    onStartMultiplayerMatch(activeRoom, 'player1');
  };

  // Cancel or Leave room
  const handleCancelRoom = async () => {
    if (activeRoom && userRole) {
      await multiplayerService.leaveOrCloseRoom(activeRoom.id, userRole === 'player1');
    }
    setActiveRoom(null);
    setUserRole(null);
    setErrorMessage(null);
    soundFx.playCardSelect();
  };

  const handleStartStandard = () => {
    soundFx.playDeploy();
    if (mode === 'tactical-rts' && onStartTacticalMatch) {
      const preset = selectedMapId === 'map-ashen-desert' ? 'citadel' : selectedMapId === 'map-arcane-ruins' ? 'glade' : 'frontline';
      onStartTacticalMatch(preset);
      return;
    }
    onStartGame(mode, selectedMapId);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between p-4 md:p-8 bg-slate-950 text-slate-100 select-none overflow-x-hidden">
      {/* Background Graphic */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none bg-cover bg-center"
        style={{ backgroundImage: `url('/src/assets/images/riftbound_nexus_title_1792637672325.jpg')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/90 pointer-events-none" />

      {/* TOP BAR: Brand Wordmark - Nav Links - Primary Status */}
      <header className="relative z-10 flex items-center justify-between gap-4 pb-4 border-b border-slate-800 flex-wrap">
        {/* Brand Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center font-display font-black text-xl text-slate-950 shadow-lg shadow-cyan-500/20">
            R
          </div>
          <div>
            <h1 className="font-display font-black text-lg md:text-xl tracking-wider text-slate-100 uppercase whitespace-nowrap shrink-0">
              RIFTBOUND
            </h1>
            <div className="text-[10px] uppercase font-bold tracking-widest text-cyan-400">
              แนวรบเน็กซัส (Frontline Nexus) · มหายุทธสงครามพหุภพ
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center gap-3 sm:gap-5 text-xs font-semibold text-slate-400 flex-wrap">
          <button
            onClick={onOpenDeckBuilder}
            className="hover:text-cyan-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Layers className="w-4 h-4 text-cyan-400" /> จัดเด็ค
          </button>
          <button
            onClick={onOpenCardCreator}
            className="hover:text-cyan-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-950/60 to-cyan-950/60 border border-purple-500/40 text-purple-200 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" /> เตาหลอม AI
          </button>
          <button
            onClick={onOpenMyCollection}
            className="hover:text-sky-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderHeart className="w-4 h-4 text-sky-400" /> คลังฉัน
          </button>
          <button
            onClick={onOpenPublicGallery}
            className="hover:text-purple-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Globe className="w-4 h-4 text-purple-400" /> หอสมุดพหุภพ
          </button>
          <button
            onClick={onOpenRanked}
            className="hover:text-amber-300 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Shield className="w-4 h-4 text-amber-400" /> อันดับ
          </button>
          <button
            onClick={onOpenRules}
            className="hover:text-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-slate-400" /> วิธีเล่น
          </button>
        </nav>

        {/* Player Elo & Mode Quick Launch */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="text-[10px] uppercase font-bold text-slate-400">คะแนนอันดับ</div>
            <div className="text-xs font-mono-nums font-bold text-amber-300">
              {userRank} · {userElo} Elo
            </div>
          </div>
          {mode !== 'room-lobby' && (
            <button
              onClick={handleStartStandard}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-display font-black text-xs uppercase tracking-wider shadow-xl shadow-cyan-900/40 transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 fill-current" /> เข้าสู่สนามรบ (Deploy)
            </button>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {errorMessage && (
        <div className="relative z-10 max-w-4xl mx-auto w-full mt-3 p-3 bg-rose-950/90 border border-rose-500/80 rounded-xl text-xs text-rose-200 flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-bold">
            ปิด
          </button>
        </div>
      )}

      {/* MAIN CONTENT: MODE SELECTION & SETUP */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 my-auto py-6 max-w-6xl mx-auto w-full">
        {/* LEFT: GAME MODE SELECTION (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              เลือกโหมดการประลองยุทธวิธี (Tactical Mode)
            </h2>
            {mode === 'room-lobby' && (
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-700/50">
                <Radio className="w-3 h-3 animate-ping text-emerald-400" /> มัลติเพลเยอร์ข้ามเครื่อง ออนไลน์
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Mode 0: Tactical RTS Overhaul (Featured & Default) */}
            <button
              onClick={() => {
                setMode('tactical-rts');
                soundFx.playCardSelect();
              }}
              className={`p-4 rounded-xl border text-left transition-all col-span-1 sm:col-span-2 ${
                mode === 'tactical-rts'
                  ? 'border-cyan-400 bg-gradient-to-r from-cyan-950/70 via-slate-900/90 to-blue-950/70 ring-2 ring-cyan-400 shadow-xl shadow-cyan-950/60'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300">
                  <Swords className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-300 bg-cyan-900/80 px-2.5 py-0.5 rounded border border-cyan-400/60 animate-pulse">
                  ⭐ ระบบหลักใหม่: RTS แผนที่กริด & หมอกสงคราม (Fog of War)
                </span>
              </div>
              <div className="font-extrabold text-base text-cyan-200">
                สมรภูมิยุทธวิธี RTS (Tactical Grid, AP & Fog of War)
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                สนามรบเทิร์นเบสแผนที่กริด 2D พร้อมหมอกสงครามสมจริง, ออกคำสั่งยูนิตโดยตรงด้วย Action Points (AP), สร้างกองทัพจากกองบัญชาการเน็กซัส (HQ), ซูม/เลื่อนมุมมอง และตั้งแนวระวังภัยดักยิง Overwatch
              </p>
            </button>

            {/* Mode 1: AI Skirmish */}
            <button
              onClick={() => {
                setMode('ai-skirmish');
                soundFx.playCardSelect();
              }}
              className={`p-4 rounded-xl border text-left transition-all ${
                mode === 'ai-skirmish'
                  ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400 shadow-lg shadow-cyan-950'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300">
                  <Bot className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                  เล่นคนเดียว
                </span>
              </div>
              <div className="font-bold text-sm text-slate-100">ดวลกับ AI สถาปนิก (AI Skirmish)</div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                ต่อสู้กับบอท AI ยุทธวิธีที่เดินทัพผ่าน 3 เลน ยึดครองจุดยุทธศาสตร์ และประสานการโจมตีอย่างชาญฉลาด
              </p>
            </button>

            {/* Mode 4: Cross-Device Multiplayer (Online Room Sync) */}
            <button
              onClick={() => {
                setMode('room-lobby');
                soundFx.playCardSelect();
              }}
              className={`p-4 rounded-xl border text-left transition-all ${
                mode === 'room-lobby'
                  ? 'border-purple-400 bg-purple-950/40 ring-2 ring-purple-400 shadow-xl shadow-purple-950'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-lg bg-purple-500/20 text-purple-300">
                  <Globe className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300 bg-purple-900/80 px-2 py-0.5 rounded border border-purple-500/60 animate-pulse">
                  เล่นข้ามเครื่อง 2 คน
                </span>
              </div>
              <div className="font-bold text-sm text-purple-200">ประลองข้ามเครื่อง (Cross-Device Online)</div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                สร้างห้องหรือใส่รหัส 6 หลักเพื่อประลองกับผู้เล่นบนมือถือ แท็บเล็ต หรือคอมพิวเตอร์เครื่องอื่นแบบเรียลไทม์
              </p>
            </button>

            {/* Mode 2: Local Hotseat */}
            <button
              onClick={() => {
                setMode('hotseat');
                soundFx.playCardSelect();
              }}
              className={`p-4 rounded-xl border text-left transition-all ${
                mode === 'hotseat'
                  ? 'border-indigo-400 bg-indigo-950/40 ring-1 ring-indigo-400 shadow-lg shadow-indigo-950'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300">
                  <Users className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                  เล่น 2 คนในเครื่องเดียว
                </span>
              </div>
              <div className="font-bold text-sm text-slate-100">ผลัดกันเล่น (Pass & Play Hotseat)</div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                ผู้เล่นสองคนประลองฝีมือบนอุปกรณ์เครื่องเดียวกัน สลับเทิร์นและตรวจดูกลยุทธ์ของกันและกัน
              </p>
            </button>

            {/* Mode 3: Airborne Paratrooper Scenario */}
            <button
              onClick={() => {
                setMode('airborne-scenario');
                soundFx.playCardSelect();
              }}
              className={`p-4 rounded-xl border text-left transition-all ${
                mode === 'airborne-scenario'
                  ? 'border-amber-400 bg-amber-950/40 ring-1 ring-amber-400 shadow-lg shadow-amber-950'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
                  <Plane className="w-5 h-5" />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                  สถานการณ์จำลองพิเศษ
                </span>
              </div>
              <div className="font-bold text-sm text-slate-100">ปฏิบัติการทิ้งร่มทางอากาศ (Airborne Drop)</div>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                เข้าสู่เกมพร้อมฐานทัพอากาศและหน่วยพลร่ม เพื่อทดลองระบบทิ้งร่มทางอากาศยึดฐานแนวหลังได้ทันที
              </p>
            </button>
          </div>

          {/* ============================================================== */}
          {/* MULTIPLAYER ROOM HUB (When mode === 'room-lobby')               */}
          {/* ============================================================== */}
          {mode === 'room-lobby' && (
            <div className="p-5 rounded-2xl bg-gradient-to-b from-purple-950/40 to-slate-900/90 border border-purple-800/60 space-y-4 shadow-2xl">
              {/* Active Room In-Lobby View */}
              {activeRoom ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-purple-800/50 pb-3">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-300">
                        {userRole === 'player1' ? 'ห้องประลองของคุณ (เจ้าของห้อง)' : 'เข้าร่วมห้องสำเร็จ (ผู้ท้าชิง)'}
                      </span>
                    </div>
                    <button
                      onClick={handleCancelRoom}
                      className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-semibold"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      {userRole === 'player1' ? 'ปิดห้อง' : 'ออกจากห้อง'}
                    </button>
                  </div>

                  {/* Room Code Display Card */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-purple-600/40 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        รหัสห้องประลอง (Room Code)
                      </div>
                      <div className="text-2xl font-mono font-black text-cyan-300 tracking-widest mt-0.5">
                        {activeRoom.id}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        ส่งรหัสนี้ให้เพื่อนเปิดในอีกเบราว์เซอร์หรือเครื่องอื่นเพื่อประลอง
                      </div>
                    </div>

                    <button
                      onClick={() => handleCopyCode(activeRoom.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        copiedCode
                          ? 'bg-emerald-600 text-white'
                          : 'bg-purple-900/70 hover:bg-purple-800 text-purple-200 border border-purple-500/50'
                      }`}
                    >
                      {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedCode ? 'คัดลอกรหัสแล้ว!' : 'คัดลอกรหัสห้อง'}</span>
                    </button>
                  </div>

                  {/* Player Status Cards (Host vs Guest) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono-nums">
                    {/* Player 1 (Host) */}
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-800/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-cyan-400">ผู้เล่น 1 (Host)</span>
                        <span className="text-[10px] text-emerald-400 font-bold">● พร้อมรบ</span>
                      </div>
                      <div className="text-sm font-bold text-slate-100">{activeRoom.hostName}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        เด็ค: {activeRoom.hostDeck.name} ({activeRoom.hostDeck.cardIds.length} ใบ)
                      </div>
                      <div className="text-[11px] text-amber-300 mt-1">{activeRoom.hostElo} Elo</div>
                    </div>

                    {/* Player 2 (Guest) */}
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-purple-800/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-bold text-purple-400">ผู้เล่น 2 (Guest)</span>
                        {activeRoom.guestId ? (
                          <span className="text-[10px] text-emerald-400 font-bold">● เข้าร่วมแล้ว</span>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-bold animate-pulse">○ กำลังรอคู่ต่อสู้...</span>
                        )}
                      </div>
                      {activeRoom.guestId ? (
                        <>
                          <div className="text-sm font-bold text-slate-100">{activeRoom.guestName || 'สถาปนิก 2'}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            เด็ค: {activeRoom.guestDeck?.name || 'เด็คมาตรฐาน'}
                          </div>
                          <div className="text-[11px] text-amber-300 mt-1">{activeRoom.guestElo || 1200} Elo</div>
                        </>
                      ) : (
                        <div className="text-xs text-slate-500 italic py-2 flex items-center gap-2">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                          <span>กำลังรอให้ผู้เล่นอีกคนใส่รหัสห้อง...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Launch button for Host or Waiting for Host message for Guest */}
                  {userRole === 'player1' ? (
                    <button
                      onClick={handleHostLaunchMatch}
                      disabled={!activeRoom.guestId}
                      className={`w-full py-3.5 rounded-xl font-display font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl ${
                        activeRoom.guestId
                          ? 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 shadow-emerald-950/60 animate-bounce'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                      }`}
                    >
                      <Swords className="w-4 h-4" />
                      <span>
                        {activeRoom.guestId
                          ? '🚀 เริ่มการประลองข้ามเครื่องทันที (Launch Match)'
                          : 'รอผู้เล่นคนที่ 2 เข้าร่วมห้องก่อนเริ่มการรบ...'}
                      </span>
                    </button>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-purple-950/50 border border-purple-700/60 text-center space-y-1">
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-purple-200">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                        <span>เข้าร่วมห้องแล้ว! กำลังรอให้เจ้าของห้อง ({activeRoom.hostName}) กดเริ่มการรบ...</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        เกมจะเริ่มและนำท่านเข้าสู่สมรภูมิอัตโนมัติเมื่อเจ้าของห้องเริ่มศึก
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Sub-Tabs: Create Room / Join Room / Browse Rooms */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-purple-800/40 pb-2.5">
                    <button
                      onClick={() => {
                        setMultiplayerTab('create');
                        soundFx.playCardSelect();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        multiplayerTab === 'create'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-purple-300'
                      }`}
                    >
                      สร้างห้องประลอง (Host Room)
                    </button>
                    <button
                      onClick={() => {
                        setMultiplayerTab('join');
                        soundFx.playCardSelect();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        multiplayerTab === 'join'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-purple-300'
                      }`}
                    >
                      เข้าร่วมด้วยรหัส (Join with Code)
                    </button>
                    <button
                      onClick={() => {
                        setMultiplayerTab('browse');
                        soundFx.playCardSelect();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        multiplayerTab === 'browse'
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-purple-300'
                      }`}
                    >
                      ห้องที่เปิดรอ ({openRooms.length})
                    </button>
                  </div>

                  {/* Sub-tab 1: Create Room */}
                  {multiplayerTab === 'create' && (
                    <div className="space-y-3">
                      <div className="text-xs text-slate-300 leading-relaxed">
                        เปิดห้องต่อสู้ใหม่เพื่อชวนเพื่อนหรือผู้เล่นอื่นข้ามเครื่อง ระบบจะสุ่มรหัสห้องให้เพื่อนนำไปกรอกเข้าร่วม
                      </div>
                      <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl text-xs space-y-1">
                        <div className="text-slate-400">
                          เด็คที่ใช้: <span className="text-cyan-300 font-bold">{selectedDeck.name}</span> ({selectedDeck.cardIds.length} ใบ)
                        </div>
                        <div className="text-slate-400">
                          สมรภูมิ: <span className="text-amber-300 font-bold">{selectedMap.name}</span>
                        </div>
                      </div>
                      <button
                        onClick={handleCreateRoom}
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-display font-black text-xs uppercase tracking-wider shadow-lg shadow-purple-950 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>กำลังเปิดห้อง...</span>
                          </>
                        ) : (
                          <>
                            <Radio className="w-4 h-4" />
                            <span>เปิดห้องประลอง (Host Room)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Sub-tab 2: Join Room */}
                  {multiplayerTab === 'join' && (
                    <div className="space-y-3">
                      <div className="text-xs text-slate-300 leading-relaxed">
                        กรอกรหัสห้อง 6 หลักที่ได้รับจากเจ้าของห้อง (เช่น NX-4921) เพื่อเข้าร่วมประลอง
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={joinCodeInput}
                          onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                          placeholder="เช่น NX-4921"
                          maxLength={12}
                          className="flex-1 bg-slate-950 border border-purple-700/60 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-cyan-300 uppercase tracking-widest focus:outline-none focus:border-cyan-400"
                        />
                        <button
                          onClick={() => handleJoinRoom()}
                          disabled={isLoading || !joinCodeInput.trim()}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-display font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <ArrowRight className="w-4 h-4" />
                          )}
                          <span>เข้าร่วม (Join)</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sub-tab 3: Browse Open Rooms */}
                  {multiplayerTab === 'browse' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">ห้องที่กำลังรอผู้เล่นเข้าร่วม:</span>
                        <button
                          onClick={refreshOpenRooms}
                          disabled={isRefreshingRooms}
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px] font-semibold"
                        >
                          <RefreshCw className={`w-3 h-3 ${isRefreshingRooms ? 'animate-spin' : ''}`} />
                          รีเฟรช
                        </button>
                      </div>

                      {openRooms.length === 0 ? (
                        <div className="p-6 text-center bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-500">
                          ยังไม่มีห้องเปิดรออยู่ในขณะนี้ คุณสามารถเป็นผู้สร้างห้องใหม่ได้เลย!
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {openRooms.map((r) => (
                            <div
                              key={r.id}
                              className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-purple-600/50 flex items-center justify-between gap-3 transition-colors"
                            >
                              <div>
                                <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
                                  <span className="font-mono text-cyan-300">{r.id}</span>
                                  <span>· {r.hostName}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  เด็ค: {r.hostDeck.name} · {r.hostElo} Elo
                                </div>
                              </div>
                              <button
                                onClick={() => handleJoinRoom(r.id)}
                                disabled={isLoading}
                                className="px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold transition-colors cursor-pointer"
                              >
                                เข้าร่วมทันที
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: DECK & MAP CONFIGURATION (5 cols) */}
        <div className="lg:col-span-5 space-y-4 bg-slate-900/70 p-5 rounded-2xl border border-slate-800">
          {/* Deck Configuration */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                เด็คยุทธวิธีที่เลือก
              </span>
              <button
                onClick={onOpenDeckBuilder}
                className="text-xs text-cyan-400 hover:underline font-semibold cursor-pointer"
              >
                แก้ไขในสตูดิโอ
              </button>
            </div>

            <select
              value={selectedDeckId}
              onChange={(e) => onSelectDeckId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-cyan-500"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.cardIds.length} ใบ)
                </option>
              ))}
            </select>
          </div>

          {/* Map Preset Selector */}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              พื้นที่สมรภูมิ (Battlefield Sector)
            </span>

            <select
              value={selectedMapId}
              onChange={(e) => setSelectedMapId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-bold focus:outline-none focus:border-cyan-500 mb-2"
            >
              {MAP_PRESETS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs space-y-1">
              <div className="font-semibold text-slate-200">{selectedMap.name}</div>
              <p className="text-[11px] text-slate-400">{selectedMap.description}</p>
              <div className="text-[11px] text-amber-300 font-semibold pt-1 border-t border-slate-800">
                กฎพิเศษ: {selectedMap.specialRules}
              </div>
            </div>
          </div>

          {/* Primary Action Button (for non-room-lobby modes) */}
          {mode !== 'room-lobby' && (
            <button
              onClick={handleStartStandard}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-display font-black text-sm uppercase tracking-wider shadow-xl shadow-cyan-950/60 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" /> เริ่มต้นการจำลองสงคราม (Start Game)
            </button>
          )}
        </div>
      </div>

      {/* FOOTER: Flat Control Hints */}
      <footer className="relative z-10 pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
        สมรภูมิ 3 เลนยุทธศาสตร์ · มัลติเพลเยอร์ข้ามเครื่องเรียลไทม์ · พหุภพไร้ขอบเขต · ส่งกำลังพลร่มทางอากาศ
      </footer>
    </div>
  );
};
