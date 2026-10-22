import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import { GAME_RULES_REGISTRY, UNSUPPORTED_MECHANICS_GUIDE } from './src/game/rules/gameRulesRegistry';
import { validateUnitDraft } from './src/game/rules/validator';

dotenv.config();

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
