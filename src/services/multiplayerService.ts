import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  limit,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';
import { db, ensureAuth, handleFirestoreError, OperationType } from './firebase';
import { CardDefinition, DeckConfig, GameState } from '../types/game';

export interface MultiplayerAction {
  type: 'play-card' | 'move-unit' | 'attack-unit' | 'airborne-drop' | 'next-phase' | 'surrender' | 'sync-state';
  playerId: 'player1' | 'player2';
  description: string;
  timestamp: number;
}

export interface MultiplayerRoomData {
  id: string; // e.g. "NEXUS-8492"
  status: 'waiting' | 'ready' | 'in_progress' | 'finished' | 'abandoned';
  hostId: string;
  hostName: string;
  hostElo: number;
  hostRank: string;
  hostDeck: DeckConfig;
  hostCustomCards?: CardDefinition[];
  guestId?: string | null;
  guestName?: string | null;
  guestElo?: number | null;
  guestRank?: string | null;
  guestDeck?: DeckConfig | null;
  guestCustomCards?: CardDefinition[];
  mapPresetId: string;
  gameState?: GameState | null;
  lastAction?: MultiplayerAction | null;
  createdAt: string;
  updatedAt: string;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `NX-${rand}`;
}

export const multiplayerService = {
  /**
   * Create a new multiplayer room as host
   */
  async createRoom(params: {
    roomCode?: string;
    mapPresetId: string;
    hostDeck: DeckConfig;
    hostCustomCards?: CardDefinition[];
    hostName: string;
    hostElo: number;
    hostRank: string;
  }): Promise<MultiplayerRoomData> {
    const user = await ensureAuth();
    const code = (params.roomCode || generateRoomCode()).toUpperCase().trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const roomRef = doc(db, 'rooms', code);

    const roomData: MultiplayerRoomData = {
      id: code,
      status: 'waiting',
      hostId: user.uid,
      hostName: params.hostName || 'สถาปนิก 1',
      hostElo: params.hostElo || 1200,
      hostRank: params.hostRank || 'ผู้ช่ำชองริฟต์ (Rift Adept)',
      hostDeck: params.hostDeck,
      hostCustomCards: params.hostCustomCards || [],
      guestId: null,
      guestName: null,
      guestElo: null,
      guestRank: null,
      guestDeck: null,
      guestCustomCards: [],
      mapPresetId: params.mapPresetId,
      gameState: null,
      lastAction: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await setDoc(roomRef, roomData);
      return roomData;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `rooms/${code}`);
    }
  },

  /**
   * Join an existing room with room code as guest
   */
  async joinRoom(
    roomCode: string,
    params: {
      guestDeck: DeckConfig;
      guestCustomCards?: CardDefinition[];
      guestName: string;
      guestElo: number;
      guestRank: string;
    }
  ): Promise<MultiplayerRoomData> {
    const user = await ensureAuth();
    const code = roomCode.toUpperCase().trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const roomRef = doc(db, 'rooms', code);

    let snapshot;
    try {
      snapshot = await getDoc(roomRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `rooms/${code}`);
    }

    if (!snapshot.exists()) {
      throw new Error(`ไม่พบห้องรหัส "${code}" ในระบบ หรือห้องถูกปิดไปแล้ว`);
    }

    const room = snapshot.data() as MultiplayerRoomData;

    // Check if player is re-joining as host or guest
    if (room.hostId === user.uid) {
      return room;
    }

    if (room.guestId && room.guestId !== user.uid && room.status !== 'waiting') {
      throw new Error(`ห้องรหัส "${code}" มีผู้เล่นคนอื่นเข้าร่วมเต็มแล้ว`);
    }

    const updates: Partial<MultiplayerRoomData> = {
      guestId: user.uid,
      guestName: params.guestName || 'สถาปนิก 2',
      guestElo: params.guestElo || 1200,
      guestRank: params.guestRank || 'ผู้ช่ำชองริฟต์ (Rift Adept)',
      guestDeck: params.guestDeck,
      guestCustomCards: params.guestCustomCards || [],
      status: 'ready',
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateDoc(roomRef, updates);
      return {
        ...room,
        ...updates,
      } as MultiplayerRoomData;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${code}`);
    }
  },

  /**
   * Listen to real-time room updates via onSnapshot
   */
  subscribeToRoom(
    roomCode: string,
    onUpdate: (room: MultiplayerRoomData) => void,
    onError?: (err: Error) => void
  ): () => void {
    const code = roomCode.toUpperCase().trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const roomRef = doc(db, 'rooms', code);

    const unsubscribe = onSnapshot(
      roomRef,
      (docSnap) => {
        if (docSnap.exists()) {
          onUpdate(docSnap.data() as MultiplayerRoomData);
        }
      },
      (error) => {
        console.error('Room subscription error:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  },

  /**
   * Host starts the match once both players are ready
   */
  async startMatch(roomCode: string, initialGameState: GameState): Promise<void> {
    await ensureAuth();
    const code = roomCode.toUpperCase().trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const roomRef = doc(db, 'rooms', code);

    try {
      await updateDoc(roomRef, {
        gameState: initialGameState,
        status: 'in_progress',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${code}`);
    }
  },

  /**
   * Sync active game state and action log to Firestore
   */
  async updateRoomGameState(
    roomCode: string,
    nextGameState: GameState,
    action: MultiplayerAction
  ): Promise<void> {
    await ensureAuth();
    const code = roomCode.toUpperCase().trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const roomRef = doc(db, 'rooms', code);

    const updates: Partial<MultiplayerRoomData> = {
      gameState: nextGameState,
      lastAction: action,
      status: nextGameState.winner ? 'finished' : 'in_progress',
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateDoc(roomRef, updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `rooms/${code}`);
    }
  },

  /**
   * Fetch open rooms waiting for opponent
   */
  async getOpenRooms(): Promise<MultiplayerRoomData[]> {
    try {
      const q = query(
        collection(db, 'rooms'),
        where('status', '==', 'waiting'),
        limit(10)
      );
      const snapshot = await getDocs(q);
      const rooms: MultiplayerRoomData[] = [];
      snapshot.forEach((docSnap) => {
        rooms.push(docSnap.data() as MultiplayerRoomData);
      });
      return rooms;
    } catch (err) {
      console.warn('Could not query open rooms:', err);
      return [];
    }
  },

  /**
   * Delete or abandon a room
   */
  async leaveOrCloseRoom(roomCode: string, isHost: boolean): Promise<void> {
    const user = await ensureAuth();
    const code = roomCode.toUpperCase().trim().replace(/[^a-zA-Z0-9_-]/g, '');
    const roomRef = doc(db, 'rooms', code);

    try {
      if (isHost) {
        await deleteDoc(roomRef);
      } else {
        await updateDoc(roomRef, {
          guestId: null,
          guestName: null,
          status: 'waiting',
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Error leaving room:', err);
    }
  },
};
