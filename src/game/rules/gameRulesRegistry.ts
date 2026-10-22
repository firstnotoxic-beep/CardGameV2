import { Universe } from '../../types/game';

export type SupportedActionType =
  | 'heal'
  | 'damage'
  | 'shield'
  | 'move'
  | 'summon'
  | 'push'
  | 'buff'
  | 'debuff'
  | 'deploy_structure'
  | 'area_effect';

export type AbilityTrigger =
  | 'deploy'      // Triggers upon placement onto battlefield
  | 'active'      // Can be activated manually in turn
  | 'combat'      // Triggers before/after attacking or defending
  | 'turn-start'  // Triggers at start of player turn
  | 'death'       // Triggers when unit dies
  | 'passive';    // Continuous passive effect / aura

export type AbilityTarget =
  | 'self'
  | 'friendly-unit'
  | 'enemy-unit'
  | 'any-unit'
  | 'all-friendly-in-lane'
  | 'all-enemies-in-lane'
  | 'adjacent-cells'
  | 'empty-cell'
  | 'outpost'
  | 'global';

export interface AbilitySchemaDefinition {
  type: SupportedActionType;
  name: string;
  nameTh: string;
  description: string;
  descriptionTh: string;
  defaultPower: number;
  minPower: number;
  maxPower: number;
  allowedTriggers: AbilityTrigger[];
  allowedTargets: AbilityTarget[];
  powerLabelTh: string;
  parameters: {
    name: string;
    labelTh: string;
    type: 'number' | 'string' | 'boolean' | 'enum';
    options?: string[];
    default: any;
  }[];
}

export const GAME_RULES_REGISTRY: Record<SupportedActionType, AbilitySchemaDefinition> = {
  heal: {
    type: 'heal',
    name: 'Heal / Repair',
    nameTh: 'ฟื้นฟูพลังชีวิต / ซ่อมแซม (Heal)',
    description: 'Restores health to target friendly unit or structure up to max HP.',
    descriptionTh: 'ฟื้นฟูพลังชีวิตให้ยูนิตฝ่ายเราที่บาดเจ็บหรือซ่อมแซมโครงสร้าง ไม่เกินค่า HP สูงสุด',
    defaultPower: 3,
    minPower: 1,
    maxPower: 8,
    allowedTriggers: ['deploy', 'active', 'turn-start', 'death'],
    allowedTargets: ['friendly-unit', 'self', 'all-friendly-in-lane'],
    powerLabelTh: 'ปริมาณฟื้นฟู HP',
    parameters: [
      { name: 'healAmount', labelTh: 'จำนวน HP ที่ฟื้นฟู', type: 'number', default: 3 },
    ],
  },
  damage: {
    type: 'damage',
    name: 'Direct Strike',
    nameTh: 'โจมตีสร้างความเสียหาย (Damage)',
    description: 'Deals immediate kinetic, arcane, or laser damage to an enemy.',
    descriptionTh: 'ยิงจู่โจมสร้างความเสียหายโดยตรงแก่ยูนิตหรือเป้าหมายศัตรู',
    defaultPower: 3,
    minPower: 1,
    maxPower: 8,
    allowedTriggers: ['deploy', 'active', 'combat', 'death'],
    allowedTargets: ['enemy-unit', 'outpost'],
    powerLabelTh: 'พลังจู่โจม DMG',
    parameters: [
      { name: 'damageType', labelTh: 'ชนิดความเสียหาย', type: 'enum', options: ['kinetic', 'arcane', 'laser'], default: 'kinetic' },
    ],
  },
  shield: {
    type: 'shield',
    name: 'Barrier Matrix',
    nameTh: 'สร้างเกราะบาเรียป้องกัน (Shield)',
    description: 'Grants temporary barrier shield points that absorb incoming damage before HP.',
    descriptionTh: 'มอบบาเรียดูดซับความเสียหาย ช่วยปกป้อง HP ของเป้าหมาย',
    defaultPower: 3,
    minPower: 1,
    maxPower: 6,
    allowedTriggers: ['deploy', 'turn-start', 'active'],
    allowedTargets: ['self', 'friendly-unit', 'all-friendly-in-lane'],
    powerLabelTh: 'ความจุเกราะบาเรีย',
    parameters: [
      { name: 'durationTurns', labelTh: 'ระยะเวลา (เทิร์น)', type: 'number', default: 2 },
    ],
  },
  move: {
    type: 'move',
    name: 'Maneuver / Teleport',
    nameTh: 'เคลื่อนพลพิเศษ / เทเลพอร์ต (Move)',
    description: 'Grants sudden extra movement points, tactical repositioning, or void teleportation.',
    descriptionTh: 'เพิ่มแต้มการเดินทัพฉับพลัน หรือข้ามมิติไปยังช่องว่างในสนาม',
    defaultPower: 2,
    minPower: 1,
    maxPower: 3,
    allowedTriggers: ['deploy', 'active'],
    allowedTargets: ['self', 'empty-cell'],
    powerLabelTh: 'ระยะทาง / แต้มเดินทัพ',
    parameters: [
      { name: 'isTeleport', labelTh: 'กระโดดข้ามสิ่งกีดขวาง (Teleport)', type: 'boolean', default: false },
    ],
  },
  summon: {
    type: 'summon',
    name: 'Deploy Vanguard Token',
    nameTh: 'อัญเชิญยูนิตสนับสนุน (Summon)',
    description: 'Deploys a combat drone, frontline escort, or void vanguard onto an adjacent tile.',
    descriptionTh: 'เรียกยูนิตโดรน กองหน้าเสริม หรือสิ่งมีชีวิตมิติลงในช่องว่างติดกัน',
    defaultPower: 2,
    minPower: 1,
    maxPower: 4,
    allowedTriggers: ['deploy', 'death'],
    allowedTargets: ['empty-cell'],
    powerLabelTh: 'ระดับพลังยูนิตเสริม',
    parameters: [
      { name: 'tokenType', labelTh: 'ประเภทยูนิตเสริม', type: 'enum', options: ['recon-drone', 'void-vanguard', 'sentry-turret'], default: 'recon-drone' },
    ],
  },
  push: {
    type: 'push',
    name: 'Shockwave Push',
    nameTh: 'คลื่นกระแทกผลักถอย (Push)',
    description: 'Pushes an enemy unit back 1 cell along its lane, disrupting tactical formations.',
    descriptionTh: 'ผลักยูนิตเป้าหมายให้ถอยร่นไปด้านหลัง 1 ช่องในเลนเดียวกัน ทำลายกระบวนทัพ',
    defaultPower: 1,
    minPower: 1,
    maxPower: 2,
    allowedTriggers: ['deploy', 'combat', 'active'],
    allowedTargets: ['enemy-unit'],
    powerLabelTh: 'ระยะผลัก (ช่อง)',
    parameters: [
      { name: 'shockDamage', labelTh: 'ดาเมจกระแทกเพิ่มเติม', type: 'number', default: 1 },
    ],
  },
  buff: {
    type: 'buff',
    name: 'Combat Enhancement',
    nameTh: 'เพิ่มขีดความสามารถการรบ (Buff)',
    description: 'Increases attack, defense, or movement speed of friendly units.',
    descriptionTh: 'เพิ่มค่า Attack, Defense หรือความเร็วการเคลื่อนที่ให้เพื่อนร่วมรบ',
    defaultPower: 2,
    minPower: 1,
    maxPower: 4,
    allowedTriggers: ['deploy', 'turn-start', 'active'],
    allowedTargets: ['friendly-unit', 'self', 'all-friendly-in-lane'],
    powerLabelTh: 'ค่าบัฟที่เพิ่ม',
    parameters: [
      { name: 'stat', labelTh: 'สถานะที่เสริมพลัง', type: 'enum', options: ['attack', 'defense', 'move'], default: 'attack' },
      { name: 'durationTurns', labelTh: 'ระยะเวลาบัฟ (เทิร์น)', type: 'number', default: 2 },
    ],
  },
  debuff: {
    type: 'debuff',
    name: 'Disruption / Suppress',
    nameTh: 'สกัดกั้น / ลดทอนพลัง (Debuff)',
    description: 'Weakens enemy attack, reduces movement, or imposes frozen/stunned status.',
    descriptionTh: 'ลดทอนพลังโจมตี ปลดอาวุธ หรือแช่แข็งยูนิตข้าศึกให้อัมพาตชั่วคราว',
    defaultPower: 2,
    minPower: 1,
    maxPower: 4,
    allowedTriggers: ['deploy', 'combat', 'active'],
    allowedTargets: ['enemy-unit', 'all-enemies-in-lane'],
    powerLabelTh: 'ระดับการสกัดกั้น',
    parameters: [
      { name: 'effect', labelTh: 'สถานะขัดขวาง', type: 'enum', options: ['frozen', 'stunned', 'burning', 'weakened'], default: 'weakened' },
      { name: 'durationTurns', labelTh: 'ระยะเวลา (เทิร์น)', type: 'number', default: 1 },
    ],
  },
  deploy_structure: {
    type: 'deploy_structure',
    name: 'Field Fortification',
    nameTh: 'สร้างสิ่งกีดขวางสนามรบ (Deploy Structure)',
    description: 'Installs a tactical barrier, defensive bunker, or radar beacon on an empty tile.',
    descriptionTh: 'ติดตั้งบังเกอร์สนาม บาเรียป้องกัน หรือเสาส่งสัญญาณบนช่องว่าง',
    defaultPower: 4,
    minPower: 2,
    maxPower: 8,
    allowedTriggers: ['deploy', 'death'],
    allowedTargets: ['empty-cell'],
    powerLabelTh: 'ความคงทนโครงสร้าง HP',
    parameters: [
      { name: 'structureType', labelTh: 'ชนิดสิ่งปลูกสร้าง', type: 'enum', options: ['bunker', 'barricade', 'relay'], default: 'barricade' },
    ],
  },
  area_effect: {
    type: 'area_effect',
    name: 'Area Blast / Zone Pulse',
    nameTh: 'ระเบิดพื้นที่วงกว้าง (Area Effect)',
    description: 'Affects the target cell and adjacent tiles with blast damage or suppression.',
    descriptionTh: 'ส่งคลื่นระเบิดหรือรัศมีส่งผลกระทบต่อช่องเป้าหมายและช่องข้างเคียง',
    defaultPower: 2,
    minPower: 1,
    maxPower: 5,
    allowedTriggers: ['deploy', 'death', 'active'],
    allowedTargets: ['adjacent-cells', 'all-enemies-in-lane'],
    powerLabelTh: 'พลังรัศมีระเบิด DMG',
    parameters: [
      { name: 'radius', labelTh: 'รัศมีผลกระทบ (ช่อง)', type: 'number', default: 1 },
    ],
  },
};

/**
 * Unsupported mechanics dictionary for AI explanations.
 * When players ask for unsupported mechanics, AI must honestly declare limitations and suggest alternatives.
 */
export const UNSUPPORTED_MECHANICS_GUIDE: Record<string, { limitationTh: string; suggestedAlternativeTh: string; alternativeAction: SupportedActionType }> = {
  steal_card: {
    limitationTh: 'เกมยังไม่รองรับการขโมยการ์ดจากเด็คหรือมือของคู่ต่อสู้โดยตรงเพื่อรักษาความยุติธรรมของเด็ค 50 ใบ',
    suggestedAlternativeTh: 'ใช้กลไกลดทอนพลังข้าศึก (Debuff/Disruption) หรือเพิ่มทรัพยากร/จั่วการ์ดให้ฝ่ายเราแทน',
    alternativeAction: 'debuff',
  },
  mind_control: {
    limitationTh: 'เกมยังไม่รองรับการยึดครองหรือควบคุมยูนิตข้าศึกแบบถาวร (Mind Control)',
    suggestedAlternativeTh: 'ใช้กลไกแช่แข็งหยุดการเคลื่อนไหว (Stun/Freeze Debuff) หรือคลื่นกระแทกผลักถอย (Push) แทน',
    alternativeAction: 'debuff',
  },
  instant_win: {
    limitationTh: 'เกมไม่อนุญาตความสามารถประเภททำลายฐานทัพเน็กซัสทันทีโดยไม่มีการปะทะ (Instant Win)',
    suggestedAlternativeTh: 'ใช้การสร้างความเสียหายโดยตรงรุนแรง (Direct Strike Damage) หรือการเพิ่มพลังโจมตีก้าวกระโดด (Buff) แทน',
    alternativeAction: 'damage',
  },
  time_travel: {
    limitationTh: 'เกมยังไม่รองรับการย้อนเทิร์นหรือข้ามเฟสการเล่นของคู่ต่อสู้',
    suggestedAlternativeTh: 'ใช้การเคลื่อนพลแบบฉับพลัน (Move/Teleport) หรือปลดอาวุธคู่ต่อสู้ในรอบนั้นแทน',
    alternativeAction: 'move',
  },
  invincibility: {
    limitationTh: 'เกมไม่อนุญาตยูนิตอมตะถาวรที่ไม่รับความเสียหายใดๆ',
    suggestedAlternativeTh: 'ใช้เกราะบาเรียชั่วคราว (Shield) หรือการฟื้นฟูเลือดต่อเนื่อง (Heal) แทน',
    alternativeAction: 'shield',
  },
};

export const UNIVERSE_LIST: { id: Universe; nameTh: string; theme: string }[] = [
  { id: 'iron-frontier', nameTh: 'พรมแดนเหล็กกล้า (Iron Frontier)', theme: 'ดีเซลพังค์ เกราะหนา ปืนใหญ่ สนามเพลาะ' },
  { id: 'arcane-dominion', nameTh: 'อาณาจักรอาร์เคน (Arcane Dominion)', theme: 'มนตราโบราณ เทเลพอร์ต ประตูมิติริฟต์' },
  { id: 'neo-genesis', nameTh: 'นีโอเจเนซิส (Neo-Genesis)', theme: 'ไซเบอร์พังค์ โดรน อาวุธเลเซอร์ บาเรียพลังงาน' },
  { id: 'mythic-wilds', nameTh: 'พงไพรบรรพกาล (Mythic Wilds)', theme: 'สัตว์อสูรชีวภาพ ฟื้นฟูเลือด พลังพุ่งชน' },
  { id: 'creators-circle', nameTh: 'วงแหวนผู้สรรค์สร้าง (Creator’s Circle)', theme: 'ยูนิตพิเศษที่ออกแบบโดยผู้เล่น' },
];
