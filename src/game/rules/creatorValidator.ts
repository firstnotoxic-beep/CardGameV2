import { CardDefinition, CardAbility, Universe } from '../../types/game';
import { CreatorContentRecord, ContentType } from '../../types/creator';
import { GAME_RULES_REGISTRY, SupportedActionType, AbilityTrigger } from './gameRulesRegistry';

export interface ContentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedRecord?: CreatorContentRecord;
}

export function validateCreatorContent(input: any): ContentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== 'object') {
    return { isValid: false, errors: ['ข้อมูลเนื้อหาต้องเป็น Object ที่ถูกต้อง'], warnings: [] };
  }

  // 1. Content Type
  const validTypes: ContentType[] = ['unit', 'spell', 'tactic', 'structure', 'relic'];
  const contentType: ContentType = validTypes.includes(input.contentType) ? input.contentType : 'unit';

  // 2. Name
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length < 2) {
    errors.push('ชื่อการ์ด/ยูนิตต้องมีความยาวอย่างน้อย 2 ตัวอักษร');
  } else if (name.length > 50) {
    errors.push('ชื่อต้องไม่เกิน 50 ตัวอักษร');
  }

  // 3. Universe
  const validUniverses: Universe[] = [
    'iron-frontier',
    'arcane-dominion',
    'neo-genesis',
    'mythic-wilds',
    'creators-circle',
  ];
  let universe: Universe = validUniverses.includes(input.universe) ? input.universe : 'creators-circle';

  // 4. Cost
  const charge = Math.max(1, Math.min(10, Number(input.cost?.charge) || Number(input.chargeCost) || 2));
  const rift = Math.max(0, Math.min(4, Number(input.cost?.rift) || Number(input.riftCost) || 0));

  // 5. Stats (if unit or structure)
  let stats: CreatorContentRecord['stats'] = undefined;
  if (contentType === 'unit') {
    const atk = Math.max(0, Math.min(12, Number(input.stats?.attack ?? input.attack ?? 3)));
    const hp = Math.max(1, Math.min(20, Number(input.stats?.health ?? input.health ?? 4)));
    const def = Math.max(0, Math.min(6, Number(input.stats?.defense ?? input.defense ?? 1)));
    const mv = Math.max(0, Math.min(4, Number(input.stats?.move ?? input.move ?? 2)));
    const rng = Math.max(1, Math.min(4, Number(input.stats?.range ?? input.range ?? 1)));
    const canCap = typeof input.stats?.canCapture === 'boolean' ? input.stats.canCapture : (input.canCapture ?? true);
    stats = { attack: atk, health: hp, defense: def, move: mv, range: rng, canCapture: canCap };
  } else if (contentType === 'structure') {
    const hp = Math.max(3, Math.min(25, Number(input.stats?.health ?? input.health ?? 6)));
    const def = Math.max(0, Math.min(6, Number(input.stats?.defense ?? input.defense ?? 2)));
    stats = { health: hp, defense: def, attack: 0, move: 0, range: 0, canCapture: false };
  }

  // 6. Abilities validation against Game Rules Registry
  const validatedAbilities: CardAbility[] = [];
  const rawAbilities = Array.isArray(input.abilities) ? input.abilities : [];
  if (rawAbilities.length > 2) {
    warnings.push('รองรับความสามารถสูงสุด 2 อย่าง ความสามารถที่เหลือถูกตัดออก');
  }

  rawAbilities.slice(0, 2).forEach((ab: any, idx: number) => {
    if (!ab || typeof ab !== 'object') return;
    const actionKey = String(ab.actionType || 'buff').toLowerCase().replace(/-/g, '_') as SupportedActionType;
    const rule = GAME_RULES_REGISTRY[actionKey] || GAME_RULES_REGISTRY.buff;

    const abName = typeof ab.name === 'string' && ab.name.trim() ? ab.name.trim() : rule.nameTh;
    const abDesc = typeof ab.description === 'string' && ab.description.trim() ? ab.description.trim() : rule.descriptionTh;

    let trigger: AbilityTrigger = ab.trigger;
    if (!rule.allowedTriggers.includes(trigger)) {
      trigger = rule.allowedTriggers[0];
    }

    const power = Math.max(rule.minPower, Math.min(rule.maxPower, Number(ab.powerValue) || rule.defaultPower));

    let engineAction: any = 'stat-buff';
    if (actionKey === 'heal') engineAction = 'heal';
    else if (actionKey === 'damage') engineAction = 'deal-damage';
    else if (actionKey === 'shield') engineAction = 'shield';
    else if (actionKey === 'move') engineAction = 'teleport';
    else if (actionKey === 'summon') engineAction = 'airborne-drop';
    else if (actionKey === 'area_effect') engineAction = 'aoe-damage';
    else if (actionKey === 'deploy_structure') engineAction = 'repair';

    validatedAbilities.push({
      id: ab.id || `ab-${Date.now()}-${idx}`,
      name: abName,
      description: abDesc,
      trigger,
      actionType: engineAction,
      powerValue: power,
    });
  });

  // 7. Keywords & Description
  const keywords = Array.isArray(input.keywords)
    ? input.keywords.map((k: any) => String(k).trim()).filter(Boolean).slice(0, 4)
    : [];

  const description = typeof input.description === 'string'
    ? input.description.trim().slice(0, 200)
    : (input.flavor || 'ยุทธภัณฑ์สรรค์สร้างแห่งเน็กซัส');

  // 8. Visibility & Provenance
  const visibility = input.visibility === 'public' ? 'public' : 'private';
  const publicationStatus = input.publicationStatus === 'published' ? 'published' : 'draft';

  const contentId = input.id && typeof input.id === 'string' && input.id.startsWith('cr-')
    ? input.id
    : `cr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  // Determine Rarity
  let rarity: CardDefinition['rarity'] = 'common';
  if (charge >= 6) rarity = 'legendary';
  else if (charge >= 5) rarity = 'epic';
  else if (charge >= 4) rarity = 'rare';
  else if (charge >= 3) rarity = 'uncommon';

  // Target Rule depending on Content Type
  let targetRule: CreatorContentRecord['targetRule'] = input.targetRule;
  if (!targetRule) {
    if (contentType === 'unit' || contentType === 'structure') {
      targetRule = { mode: 'empty-cell' };
    } else if (contentType === 'spell') {
      targetRule = { mode: 'cell-area', areaRadius: 1 };
    } else {
      targetRule = { mode: 'no-target' };
    }
  }

  const sanitized: CreatorContentRecord = {
    id: contentId,
    ownerId: input.ownerId || 'current-user',
    ownerDisplayName: input.ownerDisplayName || 'จอมทัพนิรนาม',
    contentType,
    name,
    description,
    universe,
    rarity,
    cost: { charge, rift: rift > 0 ? rift : undefined },
    stats,
    abilities: validatedAbilities,
    targetRule,
    keywords,
    flavorText: input.flavorText || input.flavor || description,
    artwork: input.artwork,
    visibility,
    publicationStatus,
    schemaVersion: '1.0',
    contentVersion: Number(input.contentVersion) || 1,
    createdAt: input.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    originalContentId: input.originalContentId,
    forkedFromVersion: input.forkedFromVersion,
    forkedFromAuthor: input.forkedFromAuthor,
    remixCount: input.remixCount || 0,
    reportCount: input.reportCount || 0,
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedRecord: errors.length === 0 ? sanitized : undefined,
  };
}

/**
 * Converts a CreatorContentRecord into a playable CardDefinition for the game engine
 */
export function toCardDefinitionFromCreator(record: CreatorContentRecord): CardDefinition {
  return {
    id: record.id,
    name: record.name,
    universe: record.universe,
    cardType: record.contentType,
    rarity: record.rarity,
    cost: record.cost,
    attack: record.stats?.attack,
    health: record.stats?.health,
    defense: record.stats?.defense,
    move: record.stats?.move,
    range: record.stats?.range,
    canCapture: record.stats?.canCapture ?? true,
    targetRule: record.targetRule,
    abilities: record.abilities,
    keywords: record.keywords,
    flavor: record.flavorText || record.description,
    artwork: record.artwork?.url,
    isCustom: true,
    customAuthor: record.ownerDisplayName,
  };
}

/**
 * Validates a card before allowing it to enter a match
 */
export function validateCardForMatch(def: CardDefinition): { isPlayable: boolean; reason?: string } {
  if (!def || !def.id) return { isPlayable: false, reason: 'ข้อมูลการ์ดไม่สมบูรณ์' };
  if (!def.cost || typeof def.cost.charge !== 'number') return { isPlayable: false, reason: 'ไม่มีค่าร่าย Charge ที่ถูกต้อง' };
  if (def.cardType === 'unit' && (!def.health || def.health < 1)) return { isPlayable: false, reason: 'ยูนิตต้องมีค่า HP อย่างน้อย 1' };
  return { isPlayable: true };
}
