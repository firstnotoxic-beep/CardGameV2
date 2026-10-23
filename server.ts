import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

// Game Rules Registry and Validator (Self-contained for Node ESM runtime)
const GAME_RULES_REGISTRY: Record<string, any> = {
  heal: {
    type: 'heal',
    name: 'Heal / Repair',
    nameTh: 'ฟื้นฟูพลังชีวิต / ซ่อมแซม (Heal)',
    description: 'Restores health to target friendly unit or structure up to max HP.',
    defaultPower: 3,
    minPower: 1,
    maxPower: 8,
    allowedTriggers: ['deploy', 'active', 'turn-start', 'death'],
    allowedTargets: ['friendly-unit', 'self', 'all-friendly-in-lane'],
  },
  damage: {
    type: 'damage',
    name: 'Direct Strike',
    nameTh: 'โจมตีสร้างความเสียหาย (Damage)',
    description: 'Deals immediate kinetic, arcane, or laser damage to an enemy.',
    defaultPower: 3,
    minPower: 1,
    maxPower: 8,
    allowedTriggers: ['deploy', 'active', 'combat', 'death'],
    allowedTargets: ['enemy-unit', 'outpost'],
  },
  shield: {
    type: 'shield',
    name: 'Barrier Matrix',
    nameTh: 'สร้างเกราะบาเรียป้องกัน (Shield)',
    description: 'Grants temporary barrier shield points that absorb incoming damage before HP.',
    defaultPower: 3,
    minPower: 1,
    maxPower: 6,
    allowedTriggers: ['deploy', 'turn-start', 'active'],
    allowedTargets: ['self', 'friendly-unit', 'all-friendly-in-lane'],
  },
  move: {
    type: 'move',
    name: 'Maneuver / Teleport',
    nameTh: 'เคลื่อนพลพิเศษ / เทเลพอร์ต (Move)',
    description: 'Grants sudden extra movement points, tactical repositioning, or void teleportation.',
    defaultPower: 2,
    minPower: 1,
    maxPower: 3,
    allowedTriggers: ['deploy', 'active'],
    allowedTargets: ['self', 'empty-cell'],
  },
  summon: {
    type: 'summon',
    name: 'Airborne / Reinforcements',
    nameTh: 'เรียกลูกสมุน / เสริมกำลังพล (Summon)',
    description: 'Summons tactical tokens, scout drones, or barricade defenders onto the battlefield.',
    defaultPower: 2,
    minPower: 1,
    maxPower: 4,
    allowedTriggers: ['deploy', 'active', 'death'],
    allowedTargets: ['empty-cell'],
  },
  push: {
    type: 'push',
    name: 'Shockwave Push',
    nameTh: 'คลื่นกระแทกผลักถอย (Push)',
    description: 'Knocks enemy back 1 cell away from frontline, interrupting charge.',
    defaultPower: 1,
    minPower: 1,
    maxPower: 2,
    allowedTriggers: ['combat', 'active', 'deploy'],
    allowedTargets: ['enemy-unit'],
  },
  buff: {
    type: 'buff',
    name: 'Tactical Overcharge',
    nameTh: 'เพิ่มพลังโจมตี / ป้องกัน (Buff)',
    description: 'Increases combat statistics of target friendly units for a limited duration.',
    defaultPower: 2,
    minPower: 1,
    maxPower: 4,
    allowedTriggers: ['deploy', 'turn-start', 'active'],
    allowedTargets: ['friendly-unit', 'self'],
  },
  debuff: {
    type: 'debuff',
    name: 'EMP / Disruption',
    nameTh: 'รบกวนคลื่น / ลดพลังข้าศึก (Debuff)',
    description: 'Suppresses enemy attack, movement, or disables special abilities.',
    defaultPower: 2,
    minPower: 1,
    maxPower: 4,
    allowedTriggers: ['combat', 'active', 'deploy'],
    allowedTargets: ['enemy-unit'],
  },
  deploy_structure: {
    type: 'deploy_structure',
    name: 'Fortification Deploy',
    nameTh: 'สร้างป้อม / บังเกอร์ป้องกัน (Structure)',
    description: 'Constructs a barricade, gun bunker, or energy relay on the lane.',
    defaultPower: 4,
    minPower: 2,
    maxPower: 8,
    allowedTriggers: ['deploy', 'active'],
    allowedTargets: ['empty-cell'],
  },
  area_effect: {
    type: 'area_effect',
    name: 'Area Blast / Zone Pulse',
    nameTh: 'ระเบิดพื้นที่วงกว้าง (Area Effect)',
    description: 'Affects the target cell and adjacent tiles with blast damage or suppression.',
    defaultPower: 2,
    minPower: 1,
    maxPower: 5,
    allowedTriggers: ['deploy', 'death', 'active'],
    allowedTargets: ['adjacent-cells', 'all-enemies-in-lane'],
  },
};

const UNSUPPORTED_MECHANICS_GUIDE: Record<string, any> = {
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

function validateUnitDraft(input: any) {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input || typeof input !== 'object') {
    return { isValid: false, errors: ['ข้อมูลยูนิตต้องเป็น JSON Object ที่ถูกต้อง'], warnings: [] };
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name || name.length < 2) {
    errors.push('ชื่อยูนิตต้องมีความยาวอย่างน้อย 2 ตัวอักษร');
  } else if (name.length > 40) {
    errors.push('ชื่อยูนิตต้องมีความยาวไม่เกิน 40 ตัวอักษร');
  }

  const validUniverses = [
    'iron-frontier',
    'arcane-dominion',
    'neo-genesis',
    'mythic-wilds',
    'creators-circle',
  ];
  let universe = input.universe;
  if (!validUniverses.includes(universe)) {
    warnings.push(`จักรวาล '${input.universe}' ไม่ถูกต้อง กำหนดให้เป็น 'creators-circle'`);
    universe = 'creators-circle';
  }

  const attack = Math.max(0, Math.min(12, Number(input.attack) || 0));
  const health = Math.max(1, Math.min(20, Number(input.health) || 1));
  const defense = Math.max(0, Math.min(6, Number(input.defense) || 0));
  const move = Math.max(0, Math.min(4, Number(input.move) || 1));
  const range = Math.max(1, Math.min(4, Number(input.range) || 1));

  const validatedAbilities: any[] = [];
  const rawAbilities = Array.isArray(input.abilities) ? input.abilities : [];
  const abilitiesToProcess = rawAbilities.slice(0, 2);

  abilitiesToProcess.forEach((rawAb: any, index: number) => {
    if (!rawAb || typeof rawAb !== 'object') return;
    const actionTypeStr = String(rawAb.actionType || '').trim().toLowerCase();
    const rule = GAME_RULES_REGISTRY[actionTypeStr];

    if (!rule) {
      errors.push(
        `ความสามารถ #${index + 1} ใช้กลไก '${rawAb.actionType}' ซึ่งระบบยังไม่รองรับ`
      );
      return;
    }

    const abilityName = typeof rawAb.name === 'string' && rawAb.name.trim().length > 0
      ? rawAb.name.trim()
      : rule.nameTh;
    const abilityDesc = typeof rawAb.description === 'string' && rawAb.description.trim().length > 0
      ? rawAb.description.trim()
      : rule.description;

    let trigger = rawAb.trigger || rule.allowedTriggers[0];
    if (!rule.allowedTriggers.includes(trigger)) {
      trigger = rule.allowedTriggers[0];
    }

    let power = Number(rawAb.powerValue);
    if (isNaN(power) || power < rule.minPower) power = rule.defaultPower;
    else if (power > rule.maxPower) power = rule.maxPower;

    let cardEngineActionType = 'stat-buff';
    if (actionTypeStr === 'heal') cardEngineActionType = 'heal';
    else if (actionTypeStr === 'damage') cardEngineActionType = 'deal-damage';
    else if (actionTypeStr === 'shield') cardEngineActionType = 'shield';
    else if (actionTypeStr === 'move') cardEngineActionType = 'teleport';
    else if (actionTypeStr === 'summon') cardEngineActionType = 'airborne-drop';
    else if (actionTypeStr === 'area_effect') cardEngineActionType = 'aoe-damage';
    else if (actionTypeStr === 'deploy_structure') cardEngineActionType = 'repair';

    validatedAbilities.push({
      id: rawAb.id || `ab-custom-${Date.now()}-${index}`,
      name: abilityName,
      description: abilityDesc,
      trigger,
      actionType: cardEngineActionType,
      powerValue: power,
    });
  });

  let chargeCost = Number(input.chargeCost);
  if (isNaN(chargeCost) || chargeCost < 1) chargeCost = 1;
  else if (chargeCost > 10) chargeCost = 10;

  const riftCost = Number(input.riftCost || 0);

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

  const statTotal = attack + health + defense + move + range + (validatedAbilities.length * 3);
  let rarity = 'common';
  if (statTotal >= 24 || chargeCost >= 6) rarity = 'legendary';
  else if (statTotal >= 20 || chargeCost >= 5) rarity = 'epic';
  else if (statTotal >= 16 || chargeCost >= 4) rarity = 'rare';
  else if (statTotal >= 12 || chargeCost >= 3) rarity = 'uncommon';

  const sanitizedCard = {
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
    sanitizedCard: errors.length === 0 ? sanitizedCard : undefined,
  };
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Ensure uploads directory exists
const uploadsDir = path.resolve(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve public/uploads static route
app.use('/uploads', express.static(uploadsDir));

// Multer storage config for image uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const uniqueName = `art-${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('รองรับเฉพาะไฟล์รูปภาพ (JPEG, PNG, WebP) ขนาดไม่เกิน 5MB เท่านั้น'));
    }
  },
});

// Simple in-memory rate limiter for AI generation
const aiCallTimestamps: number[] = [];

// API Route: Image Upload
app.post('/api/upload', (req, res) => {
  upload.single('artwork')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'การอัปโหลดไฟล์ล้มเหลว' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'ไม่พบไฟล์ที่อัปโหลด' });
    }
    const publicUrl = `/uploads/${req.file.filename}`;
    return res.json({
      url: publicUrl,
      filename: req.file.filename,
      sizeBytes: req.file.size,
      mimeType: req.file.mimetype,
    });
  });
});

// API Route: AI Unit Forge (Server-side Gemini 3.8 Flash)
app.post('/api/forge/generate', async (req, res) => {
  try {
    const { prompt, universeHint, roleHint } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return res.status(400).json({ error: 'โปรดระบุคำอธิบายไอเดียยูนิตอย่างน้อย 3 ตัวอักษร' });
    }

    // Rate Limiting: max 15 calls per minute
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    while (aiCallTimestamps.length > 0 && aiCallTimestamps[0] < oneMinuteAgo) {
      aiCallTimestamps.shift();
    }
    if (aiCallTimestamps.length >= 15) {
      return res.status(429).json({ error: 'เรียกใช้งาน AI ถี่เกินไป กรุณารอ 30 วินาทีก่อนลองใหม่' });
    }
    aiCallTimestamps.push(now);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Environment Variables',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // System prompt with strict Game Rules Registry schemas and limitation enforcement
    const systemInstruction = `
You are the Tactical Chief Architect of RIFTBOUND: Frontline Nexus (a multiverse 3-lane card tactical battle game).
The user wants to forge a custom battle unit from their natural language idea.

CRITICAL GAME RULES REGISTRY (Supported Mechanics Only):
${JSON.stringify(GAME_RULES_REGISTRY, null, 2)}

UNSUPPORTED MECHANICS NOTICE:
${JSON.stringify(UNSUPPORTED_MECHANICS_GUIDE, null, 2)}

IMPORTANT CONSTRAINTS:
1. ONLY produce abilities that use the supported action types:
   - "heal": restores HP up to max health (powerValue 1-8)
   - "damage": deals immediate kinetic/arcane/laser damage (powerValue 1-8)
   - "shield": temporary damage barrier (powerValue 1-6)
   - "move": extra movement or teleportation (powerValue 1-3)
   - "summon": summons drone/vanguard token (powerValue 1-4)
   - "push": pushes target unit back 1 tile along lane (powerValue 1-2)
   - "buff": increases attack/defense/move (powerValue 1-4)
   - "debuff": applies weakened/frozen/stunned status (powerValue 1-4)
   - "deploy_structure": builds barricade/turret (powerValue 2-8)
   - "area_effect": blast pulse affecting target and adjacent cells (powerValue 1-5)

2. If the user prompts for an UNSUPPORTED mechanic (e.g. stealing cards from enemy hand, permanent mind control, instant win against enemy base, time travel):
   - You MUST explain the limitation in Thai in the "limitationNoticeTh" field.
   - You MUST propose and implement the closest supported mechanical alternative (e.g. debuff, push, damage).
   - NEVER pretend that an unsupported mechanic works in the game engine.

3. Standard Unit Stats Bounds:
   - attack: 0 to 12
   - health: 1 to 20
   - defense: 0 to 6
   - move: 0 to 4
   - range: 1 to 4
   - chargeCost: 1 to 10
   - riftCost: 0 to 3
   - canCapture: boolean (true for frontline troops, false for artillery/heavy siege)
   - universe must be one of: "iron-frontier", "arcane-dominion", "neo-genesis", "mythic-wilds", "creators-circle"

4. Return RAW JSON ONLY. No markdown ticks, no conversational preamble. Must match this exact JSON schema:
{
  "name": "Unit Name in Thai or Thai with English in parentheses",
  "universe": "iron-frontier" | "arcane-dominion" | "neo-genesis" | "mythic-wilds" | "creators-circle",
  "attack": number,
  "health": number,
  "defense": number,
  "move": number,
  "range": number,
  "chargeCost": number,
  "riftCost": number,
  "canCapture": boolean,
  "flavor": "Atmospheric lore text in Thai (max 120 chars)",
  "keywords": ["Keyword1", "Keyword2"],
  "abilities": [
    {
      "name": "Ability Name in Thai",
      "description": "Clear mechanical description in Thai",
      "trigger": "deploy" | "active" | "combat" | "turn-start" | "death",
      "actionType": "heal" | "damage" | "shield" | "move" | "summon" | "push" | "buff" | "debuff" | "deploy_structure" | "area_effect",
      "powerValue": number
    }
  ],
  "tacticalConceptTh": "Brief explanation of how this unit synergizes on the battlefield",
  "limitationNoticeTh": "Leave null or explain any requested features that were adapted to supported rules"
}
`;

    const userMessage = `
User Concept: "${prompt}"
${universeHint ? `Preferred Universe: ${universeHint}` : ''}
${roleHint ? `Preferred Combat Role: ${roleHint}` : ''}

Generate the unit JSON now following all Game Rules strictly.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        { role: 'user', parts: [{ text: `${systemInstruction}\n\n${userMessage}` }] },
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.7,
      },
    });

    const responseText = response.text || '';
    let parsed: any;
    try {
      parsed = JSON.parse(responseText.trim());
    } catch (parseErr) {
      console.error('Failed to parse Gemini response JSON:', responseText);
      return res.status(500).json({ error: 'AI ส่งรูปแบบข้อมูลไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' });
    }

    // Server-side strict validation through the Game Rules Validator
    const validation = validateUnitDraft(parsed);
    if (!validation.isValid) {
      return res.status(422).json({
        error: 'ข้อมูลที่ AI สร้างไม่ผ่านเกณฑ์กติกาสนามรบ',
        details: validation.errors,
      });
    }

    return res.json({
      unit: validation.sanitizedCard,
      tacticalConceptTh: parsed.tacticalConceptTh || 'ยูนิตยุทธวิธีพร้อมประจำการ',
      limitationNoticeTh: parsed.limitationNoticeTh || null,
      warnings: validation.warnings,
    });
  } catch (error: any) {
    console.error('Gemini Forge API Error:', error);
    return res.status(500).json({
      error: error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับ Gemini API',
    });
  }
});

// Simple in-memory rate limiter for AI art generation
const artCallTimestamps: number[] = [];

// API Route: AI Artwork Generator (Gemini 3.1 Flash Lite Image)
app.post('/api/art/generate', async (req, res) => {
  try {
    const { prompt, universe, contentType } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
      return res.status(400).json({ error: 'โปรดระบุคำอธิบายรูปภาพอย่างน้อย 3 ตัวอักษร' });
    }

    // Rate Limiting: max 8 calls per minute for images
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    while (artCallTimestamps.length > 0 && artCallTimestamps[0] < oneMinuteAgo) {
      artCallTimestamps.shift();
    }
    if (artCallTimestamps.length >= 8) {
      return res.status(429).json({ error: 'สร้างภาพถี่เกินไป กรุณารอสักครู่ก่อนลองใหม่' });
    }
    artCallTimestamps.push(now);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า GEMINI_API_KEY ใน Environment Variables',
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Faction style guidance for distinct universe aesthetics
    let styleGuide = 'Epic dark sci-fi tactical card game illustration, dramatic lighting, sharp details, centered subject, 4:3 card framing, no card border, no text.';
    if (universe === 'iron-frontier') {
      styleGuide += ' Dieselpunk aesthetic, riveted dark iron armor, steam boiler exhausts, trench mud, gritty industrial bronze.';
    } else if (universe === 'arcane-dominion') {
      styleGuide += ' Arcane dominion aesthetic, glowing violet rift portal energy, ancient celestial runes, mystical sorcery.';
    } else if (universe === 'neo-genesis') {
      styleGuide += ' Cyberpunk neo-genesis aesthetic, cyan holographic shields, carbon-fiber armor, futuristic laser weaponry.';
    } else if (universe === 'mythic-wilds') {
      styleGuide += ' Mythic wilds aesthetic, primal bio-titan, emerald bioluminescence, fierce apex predator beast.';
    }

    const enhancedPrompt = `${prompt.trim()}. ${styleGuide}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite-image',
      contents: {
        parts: [{ text: enhancedPrompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: '4:3',
        },
      },
    });

    let base64Data: string | null = null;
    let mimeType = 'image/png';

    const candidate = response.candidates?.[0];
    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          base64Data = part.inlineData.data;
          if (part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
          break;
        }
      }
    }

    if (!base64Data) {
      return res.status(502).json({
        error: 'โมเดลไม่สามารถสร้างภาพได้ตามข้อความที่ระบุ กรุณาลองปรับ Prompt ให้ชัดเจนขึ้น หรือเลือกอัปโหลดรูปภาพแทน',
      });
    }

    // Save image to /public/uploads/art-ai-xxx.png
    const ext = mimeType.includes('jpeg') ? '.jpg' : '.png';
    const filename = `art-ai-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

    const publicUrl = `/uploads/${filename}`;
    return res.json({
      url: publicUrl,
      prompt: enhancedPrompt,
      source: 'ai-generated',
      mimeType,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Gemini Art Generation Error:', error);
    return res.status(500).json({
      error: error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบสร้างภาพ AI',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[RIFTBOUND] Server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
