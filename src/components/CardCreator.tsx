import React, { useState } from 'react';
import { CardDefinition, CardType, Universe, CardAbility } from '../types/game';
import { CardView } from './CardView';
import { Sparkles, Check, Wand2, Shield, Swords, Heart, Navigation, Crosshair, Flag } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface CardCreatorProps {
  onSaveCustomCard: (card: CardDefinition) => void;
  onClose: () => void;
}

const ABILITY_TEMPLATES = [
  {
    id: 'ab-deal-damage',
    name: 'โจมตีพลังจลน์ (Kinetic Strike)',
    description: 'สร้างความเสียหาย 3 หน่วยแก่ยูนิตศัตรูในระยะเมื่อลงสู่สนาม',
    actionType: 'deal-damage' as const,
    powerValue: 3,
    weight: 2,
  },
  {
    id: 'ab-heal-allies',
    name: 'แพทย์สนามฉุกเฉิน (Field Medic Surge)',
    description: 'ฟื้นฟูเลือด +3 หน่วยให้ยูนิตฝ่ายเราในช่องติดกัน',
    actionType: 'heal' as const,
    powerValue: 3,
    weight: 1.5,
  },
  {
    id: 'ab-shield-matrix',
    name: 'บาเรียเกราะป้องกัน (Barrier Shield)',
    description: 'มอบเกราะชั่วคราว +3 หน่วยต้านทานการโจมตีถัดไป',
    actionType: 'shield' as const,
    powerValue: 3,
    weight: 1.5,
  },
  {
    id: 'ab-airborne-drop',
    name: 'ทิ้งร่มทางยุทธวิธี (Orbital Drop)',
    description: 'สามารถจัดวางลงบนฐานยุทธศาสตร์หรือแนวหลังได้โดยตรง',
    actionType: 'airborne-drop' as const,
    powerValue: 4,
    weight: 3,
  },
  {
    id: 'ab-gain-charge',
    name: 'สูบพลังโอเวอร์ไดรฟ์ (Overdrive Siphon)',
    description: 'ได้รับประจุไฟฟ้า +1 Charge เมื่อกำจัดยูนิตศัตรู',
    actionType: 'gain-resource' as const,
    powerValue: 1,
    weight: 2,
  },
  {
    id: 'ab-teleport',
    name: 'ก้าวกระโดดมิติ (Void Step)',
    description: 'เทเลพอร์ตข้ามไปยังช่องว่างในระยะ 2 ช่อง',
    actionType: 'teleport' as const,
    powerValue: 2,
    weight: 2,
  },
];

export const CardCreator: React.FC<CardCreatorProps> = ({ onSaveCustomCard, onClose }) => {
  const [name, setName] = useState('ผู้พิทักษ์แนวหน้าเน็กซัส');
  const [universe, setUniverse] = useState<Universe>('creators-circle');
  const [cardType, setCardType] = useState<CardType>('unit');
  const [attack, setAttack] = useState(3);
  const [health, setHealth] = useState(5);
  const [defense, setDefense] = useState(1);
  const [move, setMove] = useState(2);
  const [range, setRange] = useState(1);
  const [canCapture, setCanCapture] = useState(true);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [flavor, setFlavor] = useState('สถาปนิกผู้ถูกหลอมขึ้นจากหัวใจแห่งแนวรบเน็กซัส');

  // Dynamic Balance & Cost Calculator formula
  const selectedTemplate = ABILITY_TEMPLATES[selectedTemplateIndex];
  const statWeight =
    attack * 1.3 +
    health * 0.8 +
    defense * 1.6 +
    move * 0.8 +
    range * 1.0 +
    (canCapture ? 0.6 : 0) +
    selectedTemplate.weight;

  const calculatedCharge = Math.max(1, Math.min(8, Math.round(statWeight / 3.4)));
  const calculatedRift = statWeight >= 13 ? 1 : 0;

  // Assembled Card
  const customCard: CardDefinition = {
    id: `custom-${Date.now()}`,
    name: name.trim() || 'วีรบุรุษไร้นาม',
    universe,
    cardType,
    rarity: calculatedCharge >= 5 ? 'epic' : calculatedCharge >= 4 ? 'rare' : 'uncommon',
    cost: {
      charge: calculatedCharge,
      rift: calculatedRift,
    },
    attack,
    health,
    defense,
    move,
    range,
    canCapture,
    keywords: [universe === 'creators-circle' ? "วงแหวนผู้สร้าง" : 'ไฮบริดมัลติเวิร์ส', selectedTemplate.name],
    abilities: [
      {
        id: `ab-custom-${Date.now()}`,
        name: selectedTemplate.name,
        description: selectedTemplate.description,
        trigger: 'active',
        actionType: selectedTemplate.actionType,
        powerValue: selectedTemplate.powerValue,
      },
    ],
    flavor,
    isCustom: true,
  };

  const handleSave = () => {
    soundFx.playDeploy();
    onSaveCustomCard(customCard);
    onClose();
  };

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto p-4 select-none">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-400" /> วงแหวนผู้สร้าง · เตาหลอมการ์ดดั้งเดิม (Creator's Forge)
          </h2>
          <p className="text-xs text-slate-400">
            ออกแบบการ์ดยูนิตและวีรบุรุษมัลติเวิร์สด้วยระบบคำนวณความสมดุลอัตโนมัติ
          </p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-pink-950/40 transition-all"
        >
          <Check className="w-4 h-4" /> หลอมการ์ดและบันทึกเข้าคลัง
        </button>
      </div>

      {/* TWO COLUMN FORM & LIVE PREVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 flex-1 overflow-y-auto">
        {/* LEFT COLUMN: EDIT CONTROLS (7 cols) */}
        <div className="md:col-span-7 space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
          {/* Card Name */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">ชื่อตัวละคร / การ์ด</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-pink-500"
              placeholder="เช่น สอดแนมเกราะไอพ่นเอเธอร์"
            />
          </div>

          {/* Universe & Card Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">จักรวาลกำเนิด</label>
              <select
                value={universe}
                onChange={(e) => setUniverse(e.target.value as Universe)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="creators-circle">วงแหวนผู้สร้าง (กำหนดเอง)</option>
                <option value="iron-frontier">ไอรอนฟรอนเทียร์ (ดีเซลพังก์)</option>
                <option value="arcane-dominion">อาร์เคนโดมิเนียน (เวทมนตร์)</option>
                <option value="neo-genesis">นีโอเจเนซิส (ไซเบอร์เนติกส์)</option>
                <option value="mythic-wilds">แดนสัตว์ร้ายมายา (สัตว์เทวะ)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">ประเภทการ์ด</label>
              <select
                value={cardType}
                onChange={(e) => setCardType(e.target.value as CardType)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="unit">ยูนิตทางยุทธวิธี</option>
                <option value="structure">ป้อมปราการและสิ่งปลูกสร้าง</option>
                <option value="tactic">ยุทธวิธีสนามรบ</option>
                <option value="relic">โบราณวัตถุ</option>
              </select>
            </div>
          </div>

          {/* Combat Stats Sliders (If Unit) */}
          {cardType === 'unit' && (
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-cyan-400 flex items-center justify-between">
                <span>คุณสมบัติการรบ</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  ค่าสถานะยิ่งสูง จะทำให้ค่าร่ายจัดวางกำลังสูงขึ้นตามสูตรสมดุล
                </span>
              </div>

              {/* Attack */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span className="flex items-center gap-1 text-rose-400">
                    <Swords className="w-3.5 h-3.5" /> พลังโจมตี (ATK)
                  </span>
                  <span className="font-mono-nums font-bold text-rose-300">{attack}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  value={attack}
                  onChange={(e) => setAttack(Number(e.target.value))}
                  className="w-full accent-rose-500"
                />
              </div>

              {/* Health */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <Heart className="w-3.5 h-3.5" /> พลังชีวิตสูงสุด (HP)
                  </span>
                  <span className="font-mono-nums font-bold text-emerald-300">{health}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="12"
                  value={health}
                  onChange={(e) => setHealth(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              {/* Defense */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1">
                  <span className="flex items-center gap-1 text-sky-400">
                    <Shield className="w-3.5 h-3.5" /> เกราะป้องกัน (DEF)
                  </span>
                  <span className="font-mono-nums font-bold text-sky-300">{defense}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="4"
                  value={defense}
                  onChange={(e) => setDefense(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>

              {/* Move & Range */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span className="flex items-center gap-1 text-amber-400">
                      <Navigation className="w-3.5 h-3.5" /> ระยะเคลื่อนพล
                    </span>
                    <span className="font-mono-nums font-bold text-amber-300">{move}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={move}
                    onChange={(e) => setMove(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-300 mb-1">
                    <span className="flex items-center gap-1 text-indigo-400">
                      <Crosshair className="w-3.5 h-3.5" /> ระยะยิงโจมตี
                    </span>
                    <span className="font-mono-nums font-bold text-indigo-300">{range}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    value={range}
                    onChange={(e) => setRange(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>

              {/* Can Capture Checkbox */}
              <label className="flex items-center gap-2 text-xs text-slate-300 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={canCapture}
                  onChange={(e) => setCanCapture(e.target.checked)}
                  className="rounded border-slate-700 text-pink-600 focus:ring-0"
                />
                <span className="flex items-center gap-1 font-semibold text-amber-300">
                  <Flag className="w-3.5 h-3.5" /> สามารถยึดฐานยุทธศาสตร์ (Can Capture Outposts)
                </span>
              </label>
            </div>
          )}

          {/* Ability Template Selection */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">แม่แบบความสามารถพิเศษ (Ability Blueprint)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ABILITY_TEMPLATES.map((tmpl, idx) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => setSelectedTemplateIndex(idx)}
                  className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                    selectedTemplateIndex === idx
                      ? 'border-pink-500 bg-pink-950/40 text-pink-200'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-slate-200">{tmpl.name}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">
                    {tmpl.description}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Flavor Text */}
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1">บทบรรยายและเรื่องราว (Flavor Lore)</label>
            <textarea
              rows={2}
              value={flavor}
              onChange={(e) => setFlavor(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-pink-500 italic"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: LIVE HOLOGRAPHIC PREVIEW & COST BREAKDOWN (5 cols) */}
        <div className="md:col-span-5 flex flex-col items-center justify-center bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div className="text-xs uppercase font-bold text-slate-400 tracking-wider mb-2">
            เมทริกซ์คำนวณสมดุล (Deterministic Balance Matrix)
          </div>

          <div className="w-full bg-slate-900 rounded-lg p-3 border border-slate-800 text-xs mb-4">
            <div className="flex items-center justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">น้ำหนักพลังรบรวม:</span>
              <span className="font-mono-nums font-bold text-slate-200">
                {statWeight.toFixed(1)} คะแนน
              </span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">ค่าร่ายประจุไฟฟ้าคำนวณได้:</span>
              <span className="font-mono-nums font-bold text-amber-300 text-sm">
                ⚡ {calculatedCharge} ประจุไฟฟ้า (Charge)
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-400">ค่าร่ายพลังงานมิติริฟต์:</span>
              <span className="font-mono-nums font-bold text-purple-300 text-sm">
                🌀 {calculatedRift} ริฟต์ (Rift)
              </span>
            </div>
          </div>

          {/* Live Card View Preview */}
          <div className="relative p-2 rounded-2xl bg-gradient-to-b from-pink-500/20 via-purple-500/10 to-transparent border border-pink-500/40 glow-rift">
            <CardView card={customCard} variant="detail" />
          </div>
        </div>
      </div>
    </div>
  );
};
