import { CardDefinition, CardAbility, Universe } from '../../types/game';
import { GAME_RULES_REGISTRY, SupportedActionType, AbilityTrigger, AbilityTarget } from './gameRulesRegistry';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedCard?: CardDefinition;
  limitationsNotes?: string[];
}

export interface UnitDraftInput {
  name: string;
  universe: Universe;
  attack: number;
  health: number;
  defense: number;
  move: number;
  range: number;
  chargeCost?: number;
  riftCost?: number;
  canCapture?: boolean;
  flavor?: string;
  keywords?: string[];
  artwork?: string;
  abilities?: {
    id?: string;
    name: string;
    description: string;
    trigger: AbilityTrigger;
    actionType: SupportedActionType | string;
    powerValue?: number;
    target?: AbilityTarget;
    parameters?: Record<string, any>;
  }[];
  customAuthor?: string;
}

/**
 * Validates a unit definition strictly according to Game Rules Registry.
 * Returns errors if invalid, or a safe, sanitized CardDefinition.
 */
export function validateUnitDraft(input: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const limitationsNotes: string[] = [];

  if (!input || typeof input !== 'object') {
    return { isValid: false, errors: ['ข้อมูลยูนิตต้องเป็น JSON Object ที่ถูกต้อง'], warnings: [] };
  }

  // 1. Name validation
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length < 2) {
    errors.push('ชื่อยูนิตต้องมีความยาวอย่างน้อย 2 ตัวอักษร');
  } else if (name.length > 40) {
    errors.push('ชื่อยูนิตต้องมีความยาวไม่เกิน 40 ตัวอักษร');
  }

  // 2. Universe validation
  const validUniverses: Universe[] = [
    'iron-frontier',
    'arcane-dominion',
    'neo-genesis',
    'mythic-wilds',
    'creators-circle',
  ];
  let universe: Universe = input.universe;
  if (!validUniverses.includes(universe)) {
    warnings.push(`จักรวาล '${input.universe}' ไม่ถูกต้อง กำหนดให้เป็น 'creators-circle'`);
    universe = 'creators-circle';
  }

  // 3. Combat Stats validation
  const attack = Number(input.attack);
  if (isNaN(attack) || attack < 0 || attack > 12) {
    errors.push('พลังโจมตี (Attack) ต้องอยู่ระหว่าง 0 ถึง 12');
  }

  const health = Number(input.health);
  if (isNaN(health) || health < 1 || health > 20) {
    errors.push('พลังชีวิต (Health) ต้องอยู่ระหว่าง 1 ถึง 20');
  }

  const defense = Number(input.defense);
  if (isNaN(defense) || defense < 0 || defense > 6) {
    errors.push('พลังป้องกัน (Defense) ต้องอยู่ระหว่าง 0 ถึง 6');
  }

  const move = Number(input.move);
  if (isNaN(move) || move < 0 || move > 4) {
    errors.push('ระยะเดินทัพ (Move) ต้องอยู่ระหว่าง 0 ถึง 4 ช่อง');
  }

  const range = Number(input.range);
  if (isNaN(range) || range < 1 || range > 4) {
    errors.push('ระยะโจมตี (Range) ต้องอยู่ระหว่าง 1 ถึง 4 ช่อง');
  }

  // 4. Ability Validation against Game Rules Registry
  const validatedAbilities: CardAbility[] = [];
  const rawAbilities = Array.isArray(input.abilities) ? input.abilities : [];

  if (rawAbilities.length > 2) {
    warnings.push('ยูนิตรองรับความสามารถสูงสุด 2 อย่าง ความสามารถลำดับที่ 3 ขึ้นไปจะถูกตัดออก');
  }

  const abilitiesToProcess = rawAbilities.slice(0, 2);

  abilitiesToProcess.forEach((rawAb: any, index: number) => {
    if (!rawAb || typeof rawAb !== 'object') return;

    const actionTypeStr = String(rawAb.actionType || '').trim().toLowerCase() as SupportedActionType;
    const rule = GAME_RULES_REGISTRY[actionTypeStr];

    if (!rule) {
      errors.push(
        `ความสามารถ #${index + 1} ใช้กลไก '${rawAb.actionType}' ซึ่งระบบยังไม่รองรับ (รองรับ: heal, damage, shield, move, summon, push, buff, debuff, deploy_structure, area_effect)`
      );
      limitationsNotes.push(
        `ความสามารถ '${rawAb.name || actionTypeStr}' ไม่ตรงกับกลไกที่ระบบรองรับ โปรดเลือกความสามารถจาก Game Rules Registry`
      );
      return;
    }

    const abilityName = typeof rawAb.name === 'string' && rawAb.name.trim().length > 0
      ? rawAb.name.trim()
      : rule.nameTh;

    const abilityDesc = typeof rawAb.description === 'string' && rawAb.description.trim().length > 0
      ? rawAb.description.trim()
      : rule.descriptionTh;

    // Trigger validation
    const validTriggers: AbilityTrigger[] = ['deploy', 'active', 'combat', 'turn-start', 'death'];
    let trigger: AbilityTrigger = rawAb.trigger;
    if (!validTriggers.includes(trigger)) {
      trigger = rule.allowedTriggers[0];
      warnings.push(`จังหวะแสดงผลของ '${abilityName}' ไม่ถูกต้อง ถูกปรับเป็น '${trigger}'`);
    } else if (!rule.allowedTriggers.includes(trigger)) {
      warnings.push(
        `จังหวะ '${trigger}' ไม่แนะนำสำหรับความสามารถ '${rule.name}' ปรับเป็น '${rule.allowedTriggers[0]}'`
      );
      trigger = rule.allowedTriggers[0];
    }

    // Power Value clamp
    let power = Number(rawAb.powerValue);
    if (isNaN(power) || power < rule.minPower) {
      power = rule.defaultPower;
    } else if (power > rule.maxPower) {
      warnings.push(
        `ความแรงของ '${abilityName}' (${power}) เกินขีดจำกัดสูงสุด (${rule.maxPower}) ถูกจำกัดลงมาที่ ${rule.maxPower}`
      );
      power = rule.maxPower;
    }

    // Ability ID
    const abId = rawAb.id || `ab-custom-${Date.now()}-${index}`;

    // Map internal CardAbility actionType
    // For standard card abilities, map to known actionType enum
    let cardEngineActionType: any = 'stat-buff';
    switch (actionTypeStr) {
      case 'heal':
        cardEngineActionType = 'heal';
        break;
      case 'damage':
        cardEngineActionType = 'deal-damage';
        break;
      case 'shield':
        cardEngineActionType = 'shield';
        break;
      case 'move':
        cardEngineActionType = 'teleport';
        break;
      case 'summon':
        cardEngineActionType = 'airborne-drop';
        break;
      case 'push':
        cardEngineActionType = 'stat-buff';
        break;
      case 'buff':
        cardEngineActionType = 'stat-buff';
        break;
      case 'debuff':
        cardEngineActionType = 'stat-buff';
        break;
      case 'deploy_structure':
        cardEngineActionType = 'repair';
        break;
      case 'area_effect':
        cardEngineActionType = 'aoe-damage';
        break;
    }

    validatedAbilities.push({
      id: abId,
      name: abilityName,
      description: abilityDesc,
      trigger,
      actionType: cardEngineActionType,
      powerValue: power,
    });
  });

  // 5. Cost validation
  let chargeCost = Number(input.chargeCost);
  let riftCost = Number(input.riftCost || 0);

  if (isNaN(chargeCost) || chargeCost < 1) {
    chargeCost = 1;
  } else if (chargeCost > 10) {
    warnings.push('ค่าคอสต์ Charge เกิน 10 หน่วย ถูกปรับเป็น 10');
    chargeCost = 10;
  }

  if (isNaN(riftCost) || riftCost < 0) {
    riftCost = 0;
  } else if (riftCost > 4) {
    riftCost = 4;
  }

  // 6. Keywords & Flavor
  const keywords = Array.isArray(input.keywords)
    ? input.keywords.map((k: any) => String(k).trim()).filter(Boolean).slice(0, 4)
    : [];

  const flavor = typeof input.flavor === 'string'
    ? input.flavor.trim().slice(0, 150)
    : 'ยูนิตที่กำเนิดขึ้นจากเตาหลอมมิติเน็กซัส';

  const canCapture = typeof input.canCapture === 'boolean' ? input.canCapture : true;
  const artwork = typeof input.artwork === 'string' && input.artwork.trim().length > 0
    ? input.artwork.trim()
    : undefined;

  const cardId = input.id && typeof input.id === 'string' && input.id.startsWith('custom-')
    ? input.id
    : `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Determine rarity from stats
  const statTotal = attack + health + defense + move + range + (validatedAbilities.length * 3);
  let rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' = 'common';
  if (statTotal >= 24 || chargeCost >= 6) rarity = 'legendary';
  else if (statTotal >= 20 || chargeCost >= 5) rarity = 'epic';
  else if (statTotal >= 16 || chargeCost >= 4) rarity = 'rare';
  else if (statTotal >= 12 || chargeCost >= 3) rarity = 'uncommon';

  const sanitizedCard: CardDefinition = {
    id: cardId,
    name,
    universe,
    cardType: 'unit',
    rarity,
    cost: {
      charge: chargeCost,
      rift: riftCost > 0 ? riftCost : undefined,
    },
    attack,
    health,
    defense,
    move,
    range,
    canCapture,
    keywords,
    abilities: validatedAbilities,
    flavor,
    artwork,
    isCustom: true,
    customAuthor: input.customAuthor || 'Commander',
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    limitationsNotes,
    sanitizedCard: errors.length === 0 ? sanitizedCard : undefined,
  };
}
