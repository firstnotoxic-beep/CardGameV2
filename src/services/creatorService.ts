import { CreatorContentRecord, ContentReportRecord, VisibilityMode } from '../types/creator';
import { db, auth } from './firebase';
import { dbService } from './db';
import { cardRegistry } from '../game/cardRegistry';
import { validateCreatorContent, toCardDefinitionFromCreator } from '../game/rules/creatorValidator';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  query,
  where,
  limit,
} from 'firebase/firestore';

const STORAGE_KEY_CREATOR = 'riftbound_creator_records';
const STORAGE_KEY_REPORTS = 'riftbound_content_reports';

class CreatorContentService {
  private localRecords: Map<string, CreatorContentRecord> = new Map();

  constructor() {
    this.loadLocalRecords();
  }

  private loadLocalRecords() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CREATOR);
      if (saved) {
        const list: CreatorContentRecord[] = JSON.parse(saved);
        list.forEach((r) => this.localRecords.set(r.id, r));
        // Register into card registry
        list.forEach((r) => cardRegistry.registerCard(toCardDefinitionFromCreator(r)));
      }
    } catch (e) {
      console.warn('Failed to load local creator records:', e);
    }
  }

  private persistLocal() {
    try {
      const list = Array.from(this.localRecords.values());
      localStorage.setItem(STORAGE_KEY_CREATOR, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to persist local creator records:', e);
    }
  }

  // --- SAVE / UPDATE FLOW ---
  public async saveContent(record: CreatorContentRecord): Promise<CreatorContentRecord> {
    const user = dbService.getCurrentUser();
    const currentUid = auth.currentUser?.uid || user.uid;

    const validation = validateCreatorContent({
      ...record,
      ownerId: currentUid,
      ownerDisplayName: user.displayName,
    });

    if (!validation.isValid) {
      throw new Error(validation.errors[0] || 'ข้อมูลเนื้อหาไม่ถูกต้องตามกติกา');
    }

    const sanitized = validation.sanitizedRecord!;
    const existing = this.localRecords.get(sanitized.id);

    // Increment version if updating
    if (existing) {
      if (existing.ownerId && existing.ownerId !== currentUid) {
        throw new Error('คุณไม่มีสิทธิ์แก้ไขผลงานของผู้อื่น (Permission Denied)');
      }
      sanitized.contentVersion = (existing.contentVersion || 1) + 1;
    }

    sanitized.updatedAt = new Date().toISOString();

    // 1. Save to local storage & Card Registry
    this.localRecords.set(sanitized.id, sanitized);
    this.persistLocal();
    cardRegistry.registerCard(toCardDefinitionFromCreator(sanitized));

    // Also mirror to legacy units in dbService for compatibility
    if (sanitized.contentType === 'unit') {
      dbService.saveUnit({
        id: sanitized.id,
        name: sanitized.name,
        universe: sanitized.universe,
        attack: sanitized.stats?.attack || 3,
        health: sanitized.stats?.health || 4,
        defense: sanitized.stats?.defense || 1,
        move: sanitized.stats?.move || 2,
        range: sanitized.stats?.range || 1,
        chargeCost: sanitized.cost.charge,
        riftCost: sanitized.cost.rift,
        canCapture: sanitized.stats?.canCapture ?? true,
        keywords: sanitized.keywords,
        flavor: sanitized.flavorText || sanitized.description,
        abilities: sanitized.abilities,
        artworkUrl: sanitized.artwork?.url,
      });
    }

    // 2. Sync to Firestore if online
    if (auth.currentUser) {
      try {
        // Always save to user's private collection
        const userContentRef = doc(db, 'users', auth.currentUser.uid, 'content', sanitized.id);
        await setDoc(userContentRef, sanitized);

        // If public & published, write to public_content collection
        const publicContentRef = doc(db, 'public_content', sanitized.id);
        if (sanitized.visibility === 'public' && sanitized.publicationStatus === 'published') {
          await setDoc(publicContentRef, sanitized);
        } else {
          // If unpublished, delete from public collection
          await deleteDoc(publicContentRef).catch(() => {});
        }
      } catch (err) {
        console.warn('Firestore creator sync warning:', err);
      }
    }

    return sanitized;
  }

  // --- PUBLISH / UNPUBLISH FLOW ---
  public async publishContent(id: string): Promise<CreatorContentRecord> {
    const item = this.localRecords.get(id);
    if (!item) throw new Error('ไม่พบข้อมูลเนื้อหาที่ต้องการเผยแพร่');

    item.visibility = 'public';
    item.publicationStatus = 'published';
    return await this.saveContent(item);
  }

  public async unpublishContent(id: string): Promise<CreatorContentRecord> {
    const item = this.localRecords.get(id);
    if (!item) throw new Error('ไม่พบข้อมูลเนื้อหา');

    item.visibility = 'private';
    item.publicationStatus = 'draft';
    return await this.saveContent(item);
  }

  // --- REMIX / FORK FLOW ---
  public async remixContent(original: CreatorContentRecord): Promise<CreatorContentRecord> {
    const user = dbService.getCurrentUser();
    const currentUid = auth.currentUser?.uid || user.uid;

    const forkedId = `cr-remix-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const remixedRecord: CreatorContentRecord = {
      ...original,
      id: forkedId,
      ownerId: currentUid,
      ownerDisplayName: user.displayName,
      name: `${original.name} (รีมิกซ์)`,
      visibility: 'private',
      publicationStatus: 'draft',
      contentVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      originalContentId: original.id,
      forkedFromVersion: original.contentVersion,
      forkedFromAuthor: original.ownerDisplayName,
      remixCount: 0,
    };

    return await this.saveContent(remixedRecord);
  }

  // --- DUPLICATE FLOW ---
  public async duplicateContent(id: string): Promise<CreatorContentRecord> {
    const original = this.localRecords.get(id);
    if (!original) throw new Error('ไม่พบข้อมูล');

    const copyId = `cr-copy-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const copyRecord: CreatorContentRecord = {
      ...original,
      id: copyId,
      name: `${original.name} (สำเนา)`,
      visibility: 'private',
      publicationStatus: 'draft',
      contentVersion: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return await this.saveContent(copyRecord);
  }

  // --- DELETE FLOW ---
  public async deleteContent(id: string): Promise<boolean> {
    const item = this.localRecords.get(id);
    if (!item) return false;

    const user = dbService.getCurrentUser();
    const currentUid = auth.currentUser?.uid || user.uid;

    if (item.ownerId && item.ownerId !== currentUid) {
      throw new Error('คุณไม่มีสิทธิ์ลบผลงานของผู้อื่น');
    }

    this.localRecords.delete(id);
    this.persistLocal();
    cardRegistry.removeCustomCard(id);

    // Delete from Firestore
    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid, 'content', id);
      const publicRef = doc(db, 'public_content', id);
      await Promise.all([deleteDoc(userRef).catch(() => {}), deleteDoc(publicRef).catch(() => {})]);
    }

    return true;
  }

  // --- GET USER'S PRIVATE / DRAFT CONTENT ---
  public getMyContent(): CreatorContentRecord[] {
    const user = dbService.getCurrentUser();
    const currentUid = auth.currentUser?.uid || user.uid;
    return Array.from(this.localRecords.values()).filter(
      (r) => r.ownerId === currentUid || !r.ownerId
    );
  }

  // --- PUBLIC GALLERY DISCOVERY ---
  public async getPublicGallery(): Promise<CreatorContentRecord[]> {
    const results: CreatorContentRecord[] = [];

    // 1. Try Firestore public collection first
    try {
      const publicCol = collection(db, 'public_content');
      const snap = await getDocs(publicCol);
      if (!snap.empty) {
        snap.forEach((d) => {
          results.push(d.data() as CreatorContentRecord);
        });
      }
    } catch (e) {
      console.warn('Could not fetch remote public gallery, using local public records:', e);
    }

    // 2. Merge local published items
    Array.from(this.localRecords.values()).forEach((r) => {
      if (r.visibility === 'public' && r.publicationStatus === 'published') {
        if (!results.some((existing) => existing.id === r.id)) {
          results.push(r);
        }
      }
    });

    // 3. Fallback sample published creations if empty
    if (results.length === 0) {
      results.push(...this.getSampleCommunityCreations());
    }

    return results;
  }

  // --- REPORTING SYSTEM ---
  public async reportContent(contentId: string, reason: ContentReportRecord['reason'], notes: string): Promise<void> {
    const user = dbService.getCurrentUser();
    const reporterId = auth.currentUser?.uid || user.uid;

    const report: ContentReportRecord = {
      id: `rep-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      contentId,
      reporterId,
      reason,
      notes: notes.trim(),
      timestamp: new Date().toISOString(),
    };

    // Save locally
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REPORTS);
      const list: ContentReportRecord[] = saved ? JSON.parse(saved) : [];
      list.push(report);
      localStorage.setItem(STORAGE_KEY_REPORTS, JSON.stringify(list));
    } catch {}

    // Save to Firestore
    if (auth.currentUser) {
      const repRef = doc(db, 'reports', report.id);
      await setDoc(repRef, report).catch(() => {});
    }
  }

  private getSampleCommunityCreations(): CreatorContentRecord[] {
    return [
      {
        id: 'cr-sample-1',
        ownerId: 'community-architect',
        ownerDisplayName: 'จอมทัพเกราะทมิฬ (Steel General)',
        contentType: 'unit',
        name: 'หุ่นยนต์ขุดเจาะสนามเพลาะ (Trench Drill Rig)',
        description: 'จักรกลไอน้ำหนักติดตั้งหัวเจาะเพลาะ สามารถสร้างบาเรียให้เพื่อนร่วมเลนเมื่อลงสู่สนาม',
        universe: 'iron-frontier',
        rarity: 'rare',
        cost: { charge: 4 },
        stats: { attack: 4, health: 6, defense: 2, move: 1, range: 1, canCapture: true },
        abilities: [
          {
            id: 'ab-trench-drill',
            name: 'ขุดแนวป้องกันฉุกเฉิน',
            description: 'มอบบาเรียดูดซับ 3 หน่วยให้ยูนิตเราทั้งหมดในเลน',
            trigger: 'deploy',
            actionType: 'shield',
            powerValue: 3,
          },
        ],
        keywords: ['เกราะหนาพิเศษ', 'สนามเพลาะ'],
        visibility: 'public',
        publicationStatus: 'published',
        schemaVersion: '1.0',
        contentVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        artwork: {
          url: '/src/assets/images/battlefield_arena_texture_1792637672663.jpg',
          source: 'preset',
          createdAt: new Date().toISOString(),
        },
        remixCount: 12,
      },
      {
        id: 'cr-sample-2',
        ownerId: 'void-scholar',
        ownerDisplayName: 'นักปราชญ์มิติริฟต์ (Adept Lyra)',
        contentType: 'spell',
        name: 'คลื่นพลังมิติหักเห (Rift Warp Pulse)',
        description: 'เวทมนตร์ยุทธวิธีที่ปลดปล่อยคลื่นพลังสร้างความเสียหาย 3 หน่วยแก่อริในรัศมี',
        universe: 'arcane-dominion',
        rarity: 'epic',
        cost: { charge: 3, rift: 1 },
        abilities: [
          {
            id: 'ab-warp-pulse',
            name: 'ระเบิดคลื่นมิติ',
            description: 'สร้างความเสียหาย 3 หน่วยแก่ทุกยูนิตศัตรูในเลนที่กำหนด',
            trigger: 'deploy',
            actionType: 'aoe-damage',
            powerValue: 3,
          },
        ],
        targetRule: { mode: 'lane' },
        keywords: ['มนตรามิติ', 'ดาเมจวงกว้าง'],
        visibility: 'public',
        publicationStatus: 'published',
        schemaVersion: '1.0',
        contentVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        artwork: {
          url: '/src/assets/images/riftbound_nexus_title_1792637672325.jpg',
          source: 'preset',
          createdAt: new Date().toISOString(),
        },
        remixCount: 28,
      },
      {
        id: 'cr-sample-3',
        ownerId: 'cyber-designer',
        ownerDisplayName: 'วิศวกรไซเบอร์เนติก (Apex V)',
        contentType: 'unit',
        name: 'โดรนแม่ข่ายปล่อยแสง (Photon Carrier)',
        description: 'โดรนลาดตระเวนความเร็วสูง อัญเชิญโดรนคุ้มกันขนาดเล็กเมื่อลงสู่สนาม',
        universe: 'neo-genesis',
        rarity: 'uncommon',
        cost: { charge: 3 },
        stats: { attack: 2, health: 4, defense: 0, move: 3, range: 2, canCapture: true },
        abilities: [
          {
            id: 'ab-deploy-mini-drone',
            name: 'ปล่อยโดรนพี่เลี้ยง',
            description: 'อัญเชิญโดรนจู่โจมสนามในช่องว่างติดกัน',
            trigger: 'deploy',
            actionType: 'airborne-drop',
            powerValue: 2,
          },
        ],
        keywords: ['ความเร็วสูง', 'ปล่อยโดรน'],
        visibility: 'public',
        publicationStatus: 'published',
        schemaVersion: '1.0',
        contentVersion: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        artwork: {
          url: '/src/assets/images/airbase_deployment_art_1792637673708.jpg',
          source: 'preset',
          createdAt: new Date().toISOString(),
        },
        remixCount: 5,
      },
    ];
  }
}

export const creatorService = new CreatorContentService();
