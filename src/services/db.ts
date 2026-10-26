import { CardDefinition, DeckConfig, Universe } from '../types/game';
import { cardRegistry } from '../game/cardRegistry';
import { db, auth, initAuthSession, testFirestoreConnection } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  elo: number;
  rankTitle: string;
  createdAt: string;
  updatedAt: string;
}

export interface UnitRecord {
  id: string;
  ownerId: string;
  name: string;
  universe: Universe;
  attack: number;
  health: number;
  defense: number;
  move: number;
  range: number;
  chargeCost: number;
  riftCost?: number;
  canCapture: boolean;
  keywords: string[];
  flavor: string;
  abilities: any[];
  artworkUrl?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface UnitVersionRecord {
  id: string;
  unitId: string;
  version: number;
  snapshot: UnitRecord;
  modifiedBy: string;
  timestamp: string;
}

export interface DeckRecord {
  id: string;
  name: string;
  ownerId: string;
  partnerId: string;
  originId: string;
  cardIds: string[];
  universes: Universe[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssetRecord {
  id: string;
  ownerId: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

const STORAGE_KEYS = {
  USER: 'riftbound_db_current_user',
  UNITS: 'riftbound_db_units',
  UNIT_VERSIONS: 'riftbound_db_unit_versions',
  DECKS: 'riftbound_db_decks',
  ASSETS: 'riftbound_db_assets',
};

class GameDatabaseService {
  private currentUser: UserProfile;
  private firebaseReady: boolean = false;

  constructor() {
    this.currentUser = this.loadOrCreateUser();
    this.initFirebase();
  }

  private userListeners: Set<(user: UserProfile) => void> = new Set();

  private initFirebase() {
    // Test Firestore connection on boot
    testFirestoreConnection().catch(() => {});

    // Initialize Auth Session
    initAuthSession(async (user) => {
      if (user) {
        this.firebaseReady = true;
        const uid = user.uid;
        this.currentUser = {
          ...this.currentUser,
          uid,
          email: user.email || this.currentUser.email,
          displayName: user.displayName || this.currentUser.displayName,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(this.currentUser));
        this.notifyUserListeners();

        // Sync Firestore profile document
        try {
          const userRef = doc(db, 'users', uid);
          await setDoc(
            userRef,
            {
              uid,
              displayName: this.currentUser.displayName,
              elo: this.currentUser.elo,
              rankTitle: this.currentUser.rankTitle,
              email: this.currentUser.email || '',
              updatedAt: new Date().toISOString(),
              createdAt: this.currentUser.createdAt,
            },
            { merge: true }
          );

          // Sync remote units from Firestore
          await this.syncFromFirestore(uid);
        } catch (err) {
          console.warn('Firestore sync note:', err);
        }
      } else {
        this.firebaseReady = false;
        this.notifyUserListeners();
      }
    });
  }

  public subscribeUser(listener: (user: UserProfile) => void): () => void {
    this.userListeners.add(listener);
    listener(this.currentUser);
    return () => this.userListeners.delete(listener);
  }

  private notifyUserListeners() {
    this.userListeners.forEach((l) => {
      try {
        l(this.currentUser);
      } catch (e) {
        console.warn('User listener error:', e);
      }
    });
  }

  private async syncFromFirestore(uid: string) {
    try {
      const unitsCol = collection(db, 'users', uid, 'units');
      const snap = await getDocs(unitsCol);
      if (!snap.empty) {
        const firestoreUnits: UnitRecord[] = [];
        snap.forEach((d) => {
          firestoreUnits.push(d.data() as UnitRecord);
        });

        const localUnits = this.getAllUnits(false);
        // Merge without losing local records
        const unitMap = new Map<string, UnitRecord>();
        localUnits.forEach((u) => unitMap.set(u.id, u));
        firestoreUnits.forEach((u) => unitMap.set(u.id, u));

        const merged = Array.from(unitMap.values());
        localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(merged));
        const cardDefs = merged.map((u) => this.toCardDefinition(u));
        cardRegistry.registerMany(cardDefs);
      }
    } catch (e) {
      console.warn('Sync from firestore error:', e);
    }
  }

  public getCurrentUser(): UserProfile {
    return this.currentUser;
  }

  public setCurrentUser(user: Partial<UserProfile>) {
    this.currentUser = {
      ...this.currentUser,
      ...user,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(this.currentUser));

    if (this.firebaseReady && auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      setDoc(userRef, this.currentUser, { merge: true }).catch(() => {});
    }
  }

  private loadOrCreateUser(): UserProfile {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USER);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to load user, creating new', e);
    }
    const defaultUser: UserProfile = {
      uid: `usr-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      email: 'commander@riftbound.nexus',
      displayName: 'จอมทัพเน็กซัส (Nexus Commander)',
      elo: 1200,
      rankTitle: 'ผู้ช่ำชองริฟต์ (Rift Adept)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(defaultUser));
    return defaultUser;
  }

  // --- UNITS CRUD WITH PERMISSIONS & VERSIONING ---
  public getAllUnits(ownerOnly = true): UnitRecord[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.UNITS);
      const units: UnitRecord[] = saved ? JSON.parse(saved) : [];
      if (ownerOnly) {
        return units.filter((u) => u.ownerId === this.currentUser.uid || !u.ownerId);
      }
      return units;
    } catch {
      return [];
    }
  }

  public getUnitById(id: string): UnitRecord | undefined {
    const all = this.getAllUnits(false);
    return all.find((u) => u.id === id);
  }

  public saveUnit(
    unitData: Omit<UnitRecord, 'id' | 'ownerId' | 'version' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      version?: number;
    }
  ): UnitRecord {
    const allUnits = this.getAllUnits(false);
    const now = new Date().toISOString();
    let existingIndex = -1;

    if (unitData.id) {
      existingIndex = allUnits.findIndex((u) => u.id === unitData.id);
    }

    let savedRecord: UnitRecord;

    if (existingIndex >= 0) {
      const oldUnit = allUnits[existingIndex];
      // Check permissions: only owner can update
      if (oldUnit.ownerId && oldUnit.ownerId !== this.currentUser.uid) {
        throw new Error('คุณไม่มีสิทธิ์แก้ไขยูนิตของผู้อื่น (Permission Denied)');
      }

      const nextVersion = (oldUnit.version || 1) + 1;
      savedRecord = {
        ...oldUnit,
        ...unitData,
        id: oldUnit.id,
        ownerId: oldUnit.ownerId,
        version: nextVersion,
        updatedAt: now,
      };
      allUnits[existingIndex] = savedRecord;

      // Save version snapshot
      this.saveUnitVersionSnapshot(oldUnit);
    } else {
      const newId = unitData.id || `unit-custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      savedRecord = {
        ...unitData,
        id: newId,
        ownerId: this.currentUser.uid,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      allUnits.push(savedRecord);
    }

    localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(allUnits));

    // Register into CardRegistry and sync to legacy custom cards storage for compatibility
    const cardDef = this.toCardDefinition(savedRecord);
    cardRegistry.registerCard(cardDef);
    this.syncLegacyStorage(allUnits);

    // Sync to Firestore
    if (this.firebaseReady && auth.currentUser) {
      const unitDocRef = doc(db, 'users', auth.currentUser.uid, 'units', savedRecord.id);
      setDoc(unitDocRef, savedRecord, { merge: true }).catch((err) => {
        console.warn('Firestore unit save note:', err);
      });
    }

    return savedRecord;
  }

  public duplicateUnit(id: string): UnitRecord {
    const original = this.getUnitById(id);
    if (!original) throw new Error('ไม่พบยูนิตต้นฉบับ');

    return this.saveUnit({
      name: `${original.name} (สำเนา)`,
      universe: original.universe,
      attack: original.attack,
      health: original.health,
      defense: original.defense,
      move: original.move,
      range: original.range,
      chargeCost: original.chargeCost,
      riftCost: original.riftCost,
      canCapture: original.canCapture,
      keywords: [...original.keywords],
      flavor: original.flavor,
      abilities: JSON.parse(JSON.stringify(original.abilities || [])),
      artworkUrl: original.artworkUrl,
    });
  }

  public deleteUnit(id: string): boolean {
    const allUnits = this.getAllUnits(false);
    const target = allUnits.find((u) => u.id === id);
    if (!target) return false;

    if (target.ownerId && target.ownerId !== this.currentUser.uid) {
      throw new Error('คุณไม่มีสิทธิ์ลบยูนิตของผู้อื่น');
    }

    const filtered = allUnits.filter((u) => u.id !== id);
    localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(filtered));
    cardRegistry.removeCustomCard(id);
    this.syncLegacyStorage(filtered);

    // Delete from Firestore
    if (this.firebaseReady && auth.currentUser) {
      const unitDocRef = doc(db, 'users', auth.currentUser.uid, 'units', id);
      deleteDoc(unitDocRef).catch(() => {});
    }

    return true;
  }

  private saveUnitVersionSnapshot(unit: UnitRecord) {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.UNIT_VERSIONS);
      const versions: UnitVersionRecord[] = saved ? JSON.parse(saved) : [];
      versions.push({
        id: `ver-${unit.id}-${unit.version}-${Date.now()}`,
        unitId: unit.id,
        version: unit.version,
        snapshot: JSON.parse(JSON.stringify(unit)),
        modifiedBy: this.currentUser.uid,
        timestamp: new Date().toISOString(),
      });
      // Keep last 15 versions
      const trimmed = versions.slice(-15);
      localStorage.setItem(STORAGE_KEYS.UNIT_VERSIONS, JSON.stringify(trimmed));
    } catch (e) {
      console.warn('Failed to snapshot version', e);
    }
  }

  public getUnitVersions(unitId: string): UnitVersionRecord[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.UNIT_VERSIONS);
      const versions: UnitVersionRecord[] = saved ? JSON.parse(saved) : [];
      return versions.filter((v) => v.unitId === unitId);
    } catch {
      return [];
    }
  }

  // --- ASSETS CRUD ---
  public saveAsset(asset: Omit<AssetRecord, 'id' | 'ownerId' | 'createdAt'>): AssetRecord {
    const saved = localStorage.getItem(STORAGE_KEYS.ASSETS);
    const assets: AssetRecord[] = saved ? JSON.parse(saved) : [];
    const newAsset: AssetRecord = {
      ...asset,
      id: `asset-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ownerId: this.currentUser.uid,
      createdAt: new Date().toISOString(),
    };
    assets.push(newAsset);
    localStorage.setItem(STORAGE_KEYS.ASSETS, JSON.stringify(assets));

    // Sync asset reference to Firestore
    if (this.firebaseReady && auth.currentUser) {
      const assetDocRef = doc(db, 'users', auth.currentUser.uid, 'assets', newAsset.id);
      setDoc(assetDocRef, newAsset).catch(() => {});
    }

    return newAsset;
  }

  public getAssets(): AssetRecord[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ASSETS);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  // Helper converter
  public toCardDefinition(record: UnitRecord): CardDefinition {
    const charge = record.chargeCost || 2;
    const statTotal = record.attack + record.health + record.defense + record.move + record.range;
    let rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common';
    if (statTotal >= 24 || charge >= 6) rarity = 'legendary';
    else if (statTotal >= 20 || charge >= 5) rarity = 'epic';
    else if (statTotal >= 16 || charge >= 4) rarity = 'rare';
    else if (statTotal >= 12 || charge >= 3) rarity = 'uncommon';

    return {
      id: record.id,
      name: record.name,
      universe: record.universe,
      cardType: 'unit',
      rarity,
      cost: {
        charge,
        rift: record.riftCost || 0,
      },
      attack: record.attack,
      health: record.health,
      defense: record.defense,
      move: record.move,
      range: record.range,
      canCapture: record.canCapture,
      keywords: record.keywords || [],
      abilities: record.abilities || [],
      flavor: record.flavor,
      artwork: record.artworkUrl,
      isCustom: true,
      customAuthor: record.ownerId === this.currentUser.uid ? this.currentUser.displayName : 'Creator',
    };
  }

  private syncLegacyStorage(units: UnitRecord[]) {
    try {
      const cardDefs = units.map((u) => this.toCardDefinition(u));
      localStorage.setItem('riftbound_custom_cards', JSON.stringify(cardDefs));
    } catch (e) {
      console.warn('Failed legacy sync', e);
    }
  }
}

export const dbService = new GameDatabaseService();
