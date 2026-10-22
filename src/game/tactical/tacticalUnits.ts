import { TacticalUnitInstance, TacticalSkill } from '../../types/tactical';
import { CardDefinition, Universe } from '../../types/game';

export interface TacticalBlueprint {
  id: string;
  name: string;
  universe: Universe;
  category: 'infantry' | 'vehicle' | 'specialist' | 'mech';
  cost: { charge: number; rift?: number; resolve?: number };
  buildTurns: number;
  maxHealth: number;
  defense: number;
  attack: number;
  range: number;
  minRange: number;
  maxAP: number;
  maxAmmo: number;
  maxMana: number;
  visionRange: number;
  isFlying?: boolean;
  skills: TacticalSkill[];
  artwork: string;
  description: string;
}

export const TACTICAL_BLUEPRINTS: Record<string, TacticalBlueprint> = {
  'tactical-vanguard-infantry': {
    id: 'tactical-vanguard-infantry',
    name: 'กองพลทหารราบแนวหน้า (Frontline Vanguard)',
    universe: 'iron-frontier',
    category: 'infantry',
    cost: { charge: 3 },
    buildTurns: 1,
    maxHealth: 16,
    defense: 1,
    attack: 6,
    range: 1,
    minRange: 1,
    maxAP: 4,
    maxAmmo: 4,
    maxMana: 0,
    visionRange: 4,
    skills: [
      {
        id: 'skill-sprint',
        name: 'เร่งฝีเท้า (Tactical Sprint)',
        description: 'ได้รับ +2 AP เพิ่มเติมในเทิร์นนี้ แต่เสียพลังป้องกัน 1 หน่วย',
        apCost: 1,
        cooldown: 2,
        currentCooldown: 0,
        range: 0,
        skillType: 'sprint',
      },
    ],
    artwork: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=400&q=80',
    description: 'ทหารราบภาคพื้นดิน ยืดหยุ่น เข้ายึดจุดยุทธศาสตร์และสร้างแนวรับได้อย่างรวดเร็ว',
  },

  'tactical-scout-drone': {
    id: 'tactical-scout-drone',
    name: 'โดรนลาดตระเวนสังหาร (Recon Falcon Drone)',
    universe: 'neo-genesis',
    category: 'vehicle',
    cost: { charge: 2, rift: 1 },
    buildTurns: 1,
    maxHealth: 10,
    defense: 0,
    attack: 4,
    range: 2,
    minRange: 1,
    maxAP: 5,
    maxAmmo: 3,
    maxMana: 2,
    visionRange: 6, // High vision for clearing Fog of War!
    isFlying: true,
    skills: [
      {
        id: 'skill-emp-pulse',
        name: 'คลื่นรบกวน EMP (EMP Jammer)',
        description: 'ปิดการทำงานของยูนิตเป้าหมาย ลด AP ของเป้าหมายลง 2 จุดในเทิร์นถัดไป',
        apCost: 2,
        manaCost: 1,
        cooldown: 3,
        currentCooldown: 0,
        range: 3,
        skillType: 'emp-blast',
      },
    ],
    artwork: 'https://images.unsplash.com/photo-1527977966376-1c8408f9f108?auto=format&fit=crop&w=400&q=80',
    description: 'โดรนความเร็วสูง บินข้ามแม่น้ำและภูมิประเทศสิ่งกีดขวาง เปิดหมอกสงครามได้กว้างไกล',
  },

  'tactical-sniper-specialist': {
    id: 'tactical-sniper-specialist',
    name: 'พลซุ่มยิงเรเซอร์แม่นยำ (Ghost Marksman)',
    universe: 'neo-genesis',
    category: 'specialist',
    cost: { charge: 4, rift: 1 },
    buildTurns: 2,
    maxHealth: 12,
    defense: 0,
    attack: 9,
    range: 4,
    minRange: 2, // Cannot hit adjacent enemies
    maxAP: 3,
    maxAmmo: 2,
    maxMana: 2,
    visionRange: 5,
    skills: [
      {
        id: 'skill-snipe',
        name: 'กระสุนเจาะเกราะสังหาร (Hyper Velocity Snipe)',
        description: 'ยิงสังหารระยะไกล 5 ช่อง ละเลยค่าพลังป้องกันของเป้าหมาย',
        apCost: 2,
        ammoCost: 1,
        cooldown: 2,
        currentCooldown: 0,
        range: 5,
        skillType: 'sniper-shot',
      },
    ],
    artwork: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
    description: 'พลแม่นปืนสังหารระยะไกล เชี่ยวชาญการยิงสนับสนุนจากบนเนินสูงและแนวป่า',
  },

  'tactical-heavy-tank': {
    id: 'tactical-heavy-tank',
    name: 'รถถังประจัญบานหนัก (Iron Goliath Tank)',
    universe: 'iron-frontier',
    category: 'vehicle',
    cost: { charge: 6, rift: 2 },
    buildTurns: 2,
    maxHealth: 30,
    defense: 3,
    attack: 11,
    range: 2,
    minRange: 1,
    maxAP: 3,
    maxAmmo: 3,
    maxMana: 0,
    visionRange: 4,
    skills: [
      {
        id: 'skill-artillery-barrage',
        name: 'ระดมยิงปืนใหญ่ระเบิด (High-Explosive Barrage)',
        description: 'ยิงกระสุนระเบิดพื้นที่ สร้างความเสียหายรอบจุดตก 1 ช่อง',
        apCost: 3,
        ammoCost: 2,
        cooldown: 3,
        currentCooldown: 0,
        range: 3,
        areaRadius: 1,
        skillType: 'artillery-barrage',
      },
    ],
    artwork: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=80',
    description: 'ยานเกราะหนักติดปืนใหญ่ลำกล้องคู่ พลังทำลายล้างมหาศาลและเกราะหนาต้านทานความเสียหาย',
  },

  'tactical-arcane-mech': {
    id: 'tactical-arcane-mech',
    name: 'หุ่นยนต์รบเวทมนตร์อาร์เคน (Aether Titan Mech)',
    universe: 'arcane-dominion',
    category: 'mech',
    cost: { charge: 7, rift: 3, resolve: 1 },
    buildTurns: 3,
    maxHealth: 36,
    defense: 2,
    attack: 13,
    range: 2,
    minRange: 1,
    maxAP: 4,
    maxAmmo: 3,
    maxMana: 4,
    visionRange: 4,
    skills: [
      {
        id: 'skill-heal-pulse',
        name: 'ระลอกคลื่นฟื้นฟูมนตรา (Aether Resonance Pulse)',
        description: 'ฟื้นฟูพลังชีวิตยูนิตฝ่ายเดียวกันในระยะ 2 ช่อง จำนวน 8 หน่วย',
        apCost: 2,
        manaCost: 2,
        cooldown: 2,
        currentCooldown: 0,
        range: 2,
        areaRadius: 1,
        skillType: 'heal-pulse',
      },
    ],
    artwork: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=80',
    description: 'อาวุธจักรกลผสมผสานวิทยาการและเวทมนตร์อาร์เคน สามารถควบคุมสนามรบและฟื้นฟูกองทัพ',
  },
};

/**
 * Converts a CardDefinition (such as from Creator Platform or Starter Decks) into a Tactical Unit Instance
 */
export function createTacticalUnitFromCard(
  cardDef: CardDefinition,
  owner: 'player1' | 'player2',
  x: number,
  y: number,
  instanceId?: string
): TacticalUnitInstance {
  const hp = Math.max(10, (cardDef.health || 10) * 2);
  const atk = Math.max(4, cardDef.attack || 5);
  const def = cardDef.defense || 1;
  const rng = Math.max(1, cardDef.range || 1);
  const isFly = cardDef.keywords?.some((k) => k.toLowerCase().includes('airborne') || k.toLowerCase().includes('flying'));

  const skills: TacticalSkill[] = [];

  // Map card abilities to tactical skills
  if (cardDef.abilities && cardDef.abilities.length > 0) {
    cardDef.abilities.forEach((ab, idx) => {
      skills.push({
        id: `skill-${ab.id || idx}`,
        name: ab.name || 'ทักษะยุทธวิธี',
        description: ab.description || '',
        apCost: 2,
        cooldown: 2,
        currentCooldown: 0,
        range: rng + 1,
        skillType: ab.actionType === 'heal' ? 'heal-pulse' : 'artillery-barrage',
      });
    });
  }

  // Add default sprint if no skills
  if (skills.length === 0) {
    skills.push({
      id: `skill-sprint-${cardDef.id}`,
      name: 'เร่งฝีเท้า (Tactical Sprint)',
      description: 'ได้รับ +2 AP เพิ่มเติมในเทิร์นนี้',
      apCost: 1,
      cooldown: 2,
      currentCooldown: 0,
      range: 0,
      skillType: 'sprint',
    });
  }

  return {
    id: instanceId || `unit-${owner}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    definitionId: cardDef.id,
    name: cardDef.name,
    owner,
    universe: cardDef.universe || 'iron-frontier',
    x,
    y,
    maxHealth: hp,
    currentHealth: hp,
    defense: def,
    attack: atk,
    range: rng,
    minRange: rng > 2 ? 2 : 1,
    maxAP: 4,
    currentAP: 4,
    movementCostPerTile: 1,
    visionRange: isFly ? 6 : Math.max(3, rng + 2),
    maxAmmo: 4,
    currentAmmo: 4,
    maxMana: 3,
    currentMana: 3,
    stance: 'normal',
    reactionsUsedThisTurn: 0,
    hasMovedThisTurn: false,
    hasAttackedThisTurn: false,
    isFlying: isFly,
    skills,
    statusEffects: [],
    artwork: cardDef.artwork,
    flavor: cardDef.flavor,
  };
}

/**
 * Creates an instance from our built-in tactical blueprints
 */
export function createTacticalUnitFromBlueprint(
  blueprintId: string,
  owner: 'player1' | 'player2',
  x: number,
  y: number
): TacticalUnitInstance {
  const bp = TACTICAL_BLUEPRINTS[blueprintId] || TACTICAL_BLUEPRINTS['tactical-vanguard-infantry'];
  return {
    id: `unit-${owner}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    definitionId: bp.id,
    name: bp.name,
    owner,
    universe: bp.universe,
    x,
    y,
    maxHealth: bp.maxHealth,
    currentHealth: bp.maxHealth,
    defense: bp.defense,
    attack: bp.attack,
    range: bp.range,
    minRange: bp.minRange,
    maxAP: bp.maxAP,
    currentAP: bp.maxAP,
    movementCostPerTile: 1,
    visionRange: bp.visionRange,
    maxAmmo: bp.maxAmmo,
    currentAmmo: bp.maxAmmo,
    maxMana: bp.maxMana,
    currentMana: bp.maxMana,
    stance: 'normal',
    reactionsUsedThisTurn: 0,
    hasMovedThisTurn: false,
    hasAttackedThisTurn: false,
    isFlying: bp.isFlying,
    skills: JSON.parse(JSON.stringify(bp.skills)),
    statusEffects: [],
    artwork: bp.artwork,
    flavor: bp.description,
  };
}
