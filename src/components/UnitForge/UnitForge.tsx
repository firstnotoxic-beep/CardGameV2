import React, { useState, useEffect } from 'react';
import { CardDefinition, Universe, CardType, TargetingMode } from '../../types/game';
import { CreatorContentRecord, ContentType, VisibilityMode } from '../../types/creator';
import { CardView } from '../CardView';
import { GAME_RULES_REGISTRY, SupportedActionType, AbilityTrigger, UNIVERSE_LIST } from '../../game/rules/gameRulesRegistry';
import { evaluateUnitBalance, BalanceEvaluation } from '../../game/rules/balanceEngine';
import { creatorService } from '../../services/creatorService';
import { toCardDefinitionFromCreator } from '../../game/rules/creatorValidator';
import { ImageSelectorModal } from './ImageSelectorModal';
import { soundFx } from '../../utils/audio';
import {
  Wand2,
  Sliders,
  Shield,
  Swords,
  Heart,
  Navigation,
  Crosshair,
  Flag,
  Sparkles,
  Check,
  AlertTriangle,
  Layers,
  Save,
  Copy,
  Trash2,
  Image as ImageIcon,
  History,
  RotateCcw,
  Info,
  ChevronRight,
  RefreshCw,
  X,
  Globe,
  Lock,
  GitFork,
} from 'lucide-react';

interface UnitForgeProps {
  onSaveUnit: (card: CardDefinition) => void;
  onClose: () => void;
  initialContentId?: string;
  initialDraft?: CreatorContentRecord;
}

export const UnitForge: React.FC<UnitForgeProps> = ({
  onSaveUnit,
  onClose,
  initialContentId,
  initialDraft,
}) => {
  // Mode: Manual Editor vs AI Forge
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');

  // Currently Loaded / Editing Content ID
  const [editingId, setEditingId] = useState<string | null>(initialContentId || initialDraft?.id || null);

  // Content Configuration
  const [contentType, setContentType] = useState<ContentType>(initialDraft?.contentType || 'unit');
  const [name, setName] = useState<string>(initialDraft?.name || 'ผู้พิทักษ์ป้อมปราการเน็กซัส');
  const [universe, setUniverse] = useState<Universe>(initialDraft?.universe || 'iron-frontier');
  const [visibility, setVisibility] = useState<VisibilityMode>(initialDraft?.visibility || 'private');

  // Stats (Units / Structures)
  const [attack, setAttack] = useState<number>(initialDraft?.stats?.attack ?? 3);
  const [health, setHealth] = useState<number>(initialDraft?.stats?.health ?? 6);
  const [defense, setDefense] = useState<number>(initialDraft?.stats?.defense ?? 2);
  const [move, setMove] = useState<number>(initialDraft?.stats?.move ?? 2);
  const [range, setRange] = useState<number>(initialDraft?.stats?.range ?? 1);
  const [canCapture, setCanCapture] = useState<boolean>(initialDraft?.stats?.canCapture ?? true);

  // Costs
  const [chargeCost, setChargeCost] = useState<number>(initialDraft?.cost.charge ?? 3);
  const [riftCost, setRiftCost] = useState<number>(initialDraft?.cost.rift ?? 0);

  // Spells / Tactics Targeting Mode
  const [targetMode, setTargetMode] = useState<TargetingMode>(initialDraft?.targetRule?.mode || 'empty-cell');

  // Metadata
  const [flavor, setFlavor] = useState<string>(initialDraft?.flavorText || initialDraft?.description || 'ยุทธภัณฑ์และกำลังพลประจำการสมรภูมิเน็กซัส');
  const [keywords, setKeywords] = useState<string[]>(initialDraft?.keywords || ['เกราะหนา', 'ยึดฐาน']);
  const [keywordInput, setKeywordInput] = useState<string>('');
  const [artworkUrl, setArtworkUrl] = useState<string | undefined>(initialDraft?.artwork?.url);

  // Selected Abilities (Max 2)
  const [abilities, setAbilities] = useState<
    {
      id: string;
      name: string;
      description: string;
      trigger: AbilityTrigger;
      actionType: SupportedActionType;
      powerValue: number;
    }[]
  >(
    initialDraft?.abilities?.map((a, i) => ({
      id: a.id || `ab-${i}`,
      name: a.name,
      description: a.description,
      trigger: (a.trigger as AbilityTrigger) || 'deploy',
      actionType: (a.actionType.replace(/-/g, '_') as SupportedActionType) || 'shield',
      powerValue: a.powerValue || 3,
    })) || [
      {
        id: 'ab-default-1',
        name: 'เกราะสนามเพลาะ (Trench Barrier)',
        description: 'กางเกราะบาเรียดูดซับความเสียหาย 3 หน่วยเมื่อลงสู่สนาม',
        trigger: 'deploy',
        actionType: 'shield',
        powerValue: 3,
      },
    ]
  );

  // AI Forge State
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiUniverseHint, setAiUniverseHint] = useState<Universe>('iron-frontier');
  const [aiRoleHint, setAiRoleHint] = useState<string>('Frontline Tank (ยูนิตแนวหน้าป้องกัน)');
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [aiConceptNote, setAiConceptNote] = useState<string | null>(null);
  const [aiLimitationNotice, setAiLimitationNotice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // Modals & History
  const [showImageModal, setShowImageModal] = useState<boolean>(false);
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  // My Saved Creations
  const [myCreations, setMyCreations] = useState<CreatorContentRecord[]>(() => creatorService.getMyContent());

  // Balance Evaluation
  const balance: BalanceEvaluation = evaluateUnitBalance({
    attack: contentType === 'unit' ? attack : 0,
    health: contentType === 'unit' || contentType === 'structure' ? health : 0,
    defense: contentType === 'unit' || contentType === 'structure' ? defense : 0,
    move: contentType === 'unit' ? move : 0,
    range: contentType === 'unit' ? range : 1,
    canCapture: contentType === 'unit' ? canCapture : false,
    chargeCost,
    riftCost,
    abilities,
  });

  // Current Card Definition for Live Preview
  const currentRecord: CreatorContentRecord = {
    id: editingId || 'cr-preview',
    ownerId: 'current-user',
    ownerDisplayName: 'จอมทัพเน็กซัส',
    contentType,
    name: name.trim() || 'ยุทธภัณฑ์นิรนาม',
    description: flavor,
    universe,
    rarity: chargeCost >= 5 ? 'epic' : chargeCost >= 4 ? 'rare' : 'uncommon',
    cost: { charge: chargeCost, rift: riftCost > 0 ? riftCost : undefined },
    stats: contentType === 'unit' ? { attack, health, defense, move, range, canCapture } : contentType === 'structure' ? { health, defense } : undefined,
    abilities: abilities.map((ab) => ({
      id: ab.id,
      name: ab.name,
      description: ab.description,
      trigger: ab.trigger,
      actionType: ab.actionType === 'shield' ? 'shield' : ab.actionType === 'heal' ? 'heal' : 'deal-damage',
      powerValue: ab.powerValue,
    })),
    targetRule: { mode: contentType === 'unit' || contentType === 'structure' ? 'empty-cell' : targetMode },
    keywords,
    flavorText: flavor,
    artwork: artworkUrl ? { url: artworkUrl, source: 'upload', createdAt: new Date().toISOString() } : undefined,
    visibility,
    publicationStatus: visibility === 'public' ? 'published' : 'draft',
    schemaVersion: '1.0',
    contentVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const previewCardDef = toCardDefinitionFromCreator(currentRecord);

  const showToast = (msg: string) => {
    setToastNotification(msg);
    setTimeout(() => setToastNotification(null), 3000);
  };

  // Load Record into Editor
  const loadContentIntoEditor = (item: CreatorContentRecord) => {
    setEditingId(item.id);
    setContentType(item.contentType);
    setName(item.name);
    setUniverse(item.universe);
    setVisibility(item.visibility);
    setFlavor(item.flavorText || item.description);
    setKeywords(item.keywords || []);
    setArtworkUrl(item.artwork?.url);
    setChargeCost(item.cost.charge);
    setRiftCost(item.cost.rift || 0);

    if (item.stats) {
      setAttack(item.stats.attack ?? 3);
      setHealth(item.stats.health ?? 4);
      setDefense(item.stats.defense ?? 1);
      setMove(item.stats.move ?? 2);
      setRange(item.stats.range ?? 1);
      setCanCapture(item.stats.canCapture ?? true);
    }

    if (item.targetRule?.mode) {
      setTargetMode(item.targetRule.mode);
    }

    if (item.abilities) {
      setAbilities(
        item.abilities.map((a, i) => ({
          id: a.id || `ab-${i}`,
          name: a.name,
          description: a.description,
          trigger: (a.trigger as AbilityTrigger) || 'deploy',
          actionType: (a.actionType.replace(/-/g, '_') as SupportedActionType) || 'heal',
          powerValue: a.powerValue || 2,
        }))
      );
    }

    showToast(`โหลด '${item.name}' เข้าสู่เตาหลอมแล้ว`);
  };

  // Save Flow
  const handleSaveContent = async () => {
    try {
      const saved = await creatorService.saveContent(currentRecord);
      setEditingId(saved.id);
      setMyCreations(creatorService.getMyContent());
      const cardDef = toCardDefinitionFromCreator(saved);
      onSaveUnit(cardDef);
      soundFx.playDeploy();
      showToast(
        saved.visibility === 'public'
          ? `บันทึกและเผยแพร่ '${saved.name}' สู่หอสมุดพหุภพแล้ว!`
          : `บันทึก '${saved.name}' ลงคลังส่วนตัวสำเร็จ (เวอร์ชัน ${saved.contentVersion})`
      );
    } catch (err: any) {
      showToast(`บันทึกไม่สำเร็จ: ${err.message}`);
    }
  };

  // Duplicate Flow
  const handleDuplicate = async () => {
    if (!editingId) return;
    try {
      const copy = await creatorService.duplicateContent(editingId);
      setMyCreations(creatorService.getMyContent());
      loadContentIntoEditor(copy);
      soundFx.playCardSelect();
      showToast(`ทำสำเนา '${copy.name}' สำเร็จ`);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  // Delete Flow
  const handleDelete = async (id: string) => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) {
      try {
        await creatorService.deleteContent(id);
        const updated = creatorService.getMyContent();
        setMyCreations(updated);
        if (editingId === id) {
          handleResetToNew();
        }
        showToast('ลบรายการสำเร็จ');
      } catch (err: any) {
        showToast(err.message);
      }
    }
  };

  const handleResetToNew = () => {
    setEditingId(null);
    setName('ยูนิตใหม่');
    setContentType('unit');
    setUniverse('iron-frontier');
    setVisibility('private');
    setAttack(3);
    setHealth(5);
    setDefense(1);
    setMove(2);
    setRange(1);
    setChargeCost(2);
    setRiftCost(0);
    setCanCapture(true);
    setFlavor('ยุทธภัณฑ์รุ่นทดลองจากเตาหลอมเน็กซัส');
    setKeywords(['ทหารราบ']);
    setArtworkUrl(undefined);
    setAbilities([]);
    showToast('สร้างการ์ดใหม่พร้อมปรับแต่ง');
  };

  // AI Generation Flow
  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) {
      setAiError('โปรดป้อนไอเดียหรือคอนเซ็ปต์การ์ดที่ต้องการ');
      return;
    }

    setIsAiGenerating(true);
    setAiError(null);
    setAiConceptNote(null);
    setAiLimitationNotice(null);

    try {
      const res = await fetch('/api/forge/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          universeHint: aiUniverseHint,
          roleHint: aiRoleHint,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'การเชื่อมต่อกับ Gemini Forge ล้มเหลว');
      }

      const unit = data.unit;
      if (!unit) throw new Error('ไม่พบข้อมูลการ์ดในผลลัพธ์ของ AI');

      // Populate draft into editor form
      setName(unit.name || 'การ์ดจากเตาหลอม AI');
      setUniverse(unit.universe || 'creators-circle');
      setAttack(unit.attack || 3);
      setHealth(unit.health || 5);
      setDefense(unit.defense || 1);
      setMove(unit.move || 2);
      setRange(unit.range || 1);
      setChargeCost(unit.cost?.charge || 3);
      setRiftCost(unit.cost?.rift || 0);
      setCanCapture(unit.canCapture ?? true);
      setFlavor(unit.flavor || '');
      setKeywords(unit.keywords || []);

      if (Array.isArray(unit.abilities)) {
        setAbilities(
          unit.abilities.map((a: any, i: number) => ({
            id: `ai-ab-${Date.now()}-${i}`,
            name: a.name || 'ความสามารถพิเศษ',
            description: a.description || '',
            trigger: a.trigger || 'deploy',
            actionType: a.actionType || 'buff',
            powerValue: a.powerValue || 2,
          }))
        );
      }

      setAiConceptNote(data.tacticalConceptTh || null);
      setAiLimitationNotice(data.limitationNoticeTh || null);
      soundFx.playVictory();
      showToast('Gemini ร่างข้อมูลสำเร็จ! คุณสามารถตรวจสอบและปรับแต่งต่อได้ทันที');
    } catch (err: any) {
      console.error('AI Generation Error:', err);
      setAiError(err.message || 'เกิดข้อผิดพลาดในการเรียกใช้ AI');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleAddKeyword = () => {
    if (!keywordInput.trim()) return;
    if (keywords.includes(keywordInput.trim())) return;
    if (keywords.length >= 4) {
      showToast('คำสำคัญ (Keywords) สูงสุด 4 คำ');
      return;
    }
    setKeywords([...keywords, keywordInput.trim()]);
    setKeywordInput('');
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 backdrop-blur-md flex flex-col overflow-hidden text-slate-100">
      {/* Top Tactical Navigation Bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/30 to-purple-500/30 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-lg shadow-cyan-950/50">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold font-display tracking-wider text-slate-100">
                เตาหลอมยูนิตและการ์ด (UNIT & CARD FORGE)
              </h1>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {editingId ? 'กำลังแก้ไข' : 'สร้างรายการใหม่'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              สร้างยูนิต เวทมนตร์ ป้อมปราการ ปรับแต่งภาพด้วย AI และกำหนดสิทธิ์ส่วนตัว/สาธารณะ
            </p>
          </div>
        </div>

        {/* Mode Toggle & Primary Actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setMode('manual')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                mode === 'manual'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" /> Manual Editor
            </button>
            <button
              onClick={() => setMode('ai')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                mode === 'ai'
                  ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white font-bold shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5" /> AI Forge (Gemini)
            </button>
          </div>

          <button
            onClick={handleResetToNew}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> สร้างใหม่
          </button>

          <button
            onClick={handleSaveContent}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition shadow-lg shadow-cyan-500/25 cursor-pointer"
          >
            <Save className="w-4 h-4" /> บันทึกผลงาน
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Workbench Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: My Saved Content List */}
        <aside className="w-64 border-r border-slate-800 bg-slate-950/60 p-4 flex flex-col shrink-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" /> ผลงานของฉัน ({myCreations.length})
            </span>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto pr-1">
            {myCreations.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                ยังไม่มีการ์ดที่บันทึกไว้
              </div>
            ) : (
              myCreations.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadContentIntoEditor(item)}
                  className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between group ${
                    editingId === item.id
                      ? 'border-cyan-400 bg-cyan-950/40 text-slate-100 ring-1 ring-cyan-500/40'
                      : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate flex items-center gap-1.5">
                      <span>{item.name}</span>
                      {item.visibility === 'public' ? (
                        <Globe className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5 font-mono">
                      <span>⚡{item.cost.charge}</span>
                      <span className="capitalize">{item.contentType}</span>
                      <span>v{item.contentVersion}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="p-1 rounded hover:bg-rose-950 text-slate-400 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Center: Main Editor Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-900/40">
          {mode === 'ai' ? (
            /* AI FORGE VIEW */
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-900 border border-purple-500/30 shadow-2xl relative overflow-hidden">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center border border-purple-500/40">
                    <Wand2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">
                      สถาปนิกมิติ AI (Gemini Tactical Architect)
                    </h3>
                    <p className="text-xs text-slate-400">
                      อธิบายแนวคิดการ์ดหรือยูนิตที่คุณต้องการ AI จะแปลงเป็นข้อมูลตาม Game Rules Registry
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      อธิบายไอเดียการ์ด/ยูนิต (Prompt):
                    </label>
                    <textarea
                      rows={3}
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="เช่น: ยูนิตหุ่นรบเดินทัพเร็วแนวหน้า มีปืนเลเซอร์คู่ โจมตี 4 เลือด 6 มีความสามารถยิงระเบิดคลื่นพลังผลักศัตรูถอยหลังเมื่อลงสู่สนาม..."
                      className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-purple-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        จักรวาลต้นกำเนิด (Universe Alignment):
                      </label>
                      <select
                        value={aiUniverseHint}
                        onChange={(e) => setAiUniverseHint(e.target.value as Universe)}
                        className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-xs text-slate-200"
                      >
                        {UNIVERSE_LIST.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nameTh}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        บทบาทการรบ (Combat Role):
                      </label>
                      <select
                        value={aiRoleHint}
                        onChange={(e) => setAiRoleHint(e.target.value)}
                        className="w-full rounded-xl bg-slate-950 border border-slate-700 p-2.5 text-xs text-slate-200"
                      >
                        <option value="Frontline Tank (ยูนิตป้องกันหนาแน่น)">Frontline Tank (ยูนิตป้องกันหนาแน่น)</option>
                        <option value="Glass Cannon Striker (จู่โจมหนัก เลือดน้อย)">Glass Cannon Striker (จู่โจมหนัก เลือดน้อย)</option>
                        <option value="Tactical Scout (ลาดตระเวนไว ยึดฐานเร็ว)">Tactical Scout (ลาดตระเวนไว ยึดฐานเร็ว)</option>
                        <option value="Combat Support (ฟื้นฟู/กางบาเรีย)">Combat Support (ฟื้นฟู/กางบาเรีย)</option>
                        <option value="Siege Artillery (ปืนใหญ่ระยะไกล 3-4 ช่อง)">Siege Artillery (ปืนใหญ่ระยะไกล 3-4 ช่อง)</option>
                      </select>
                    </div>
                  </div>

                  {aiError && (
                    <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{aiError}</span>
                    </div>
                  )}

                  {aiLimitationNotice && (
                    <div className="p-3.5 rounded-xl bg-amber-950/60 border border-amber-800 text-amber-200 text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-amber-400">
                        <Info className="w-4 h-4 shrink-0" /> ข้อจำกัดกติกาและการปรับปรุงตามระบบ:
                      </div>
                      <p className="leading-relaxed">{aiLimitationNotice}</p>
                    </div>
                  )}

                  {aiConceptNote && (
                    <div className="p-3.5 rounded-xl bg-cyan-950/60 border border-cyan-800 text-cyan-200 text-xs space-y-1">
                      <div className="font-bold text-cyan-400">ยุทธวิธีของยูนิตนี้:</div>
                      <p className="leading-relaxed">{aiConceptNote}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[11px] text-slate-400">
                      ผลลัพธ์ของ AI จะเป็นเพียงฉบับร่าง (Draft) คุณสามารถปรับแต่งค่าต่างๆ ต่อได้อิสระก่อนบันทึก
                    </span>
                    <button
                      disabled={isAiGenerating}
                      onClick={handleGenerateWithAI}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white shadow-lg shadow-purple-500/25 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isAiGenerating ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" /> กำลังหลอมข้อมูลผ่าน Gemini...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4" /> สั่งการ AI สร้างฉบับร่าง
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* MANUAL EDITOR */}
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Classification & Visibility */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" /> หมวดหมู่การ์ดและระดับการมองเห็น (Type & Visibility)
                </h3>
                {/* Visibility Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">การเผยแพร่:</span>
                  <button
                    onClick={() => setVisibility(visibility === 'public' ? 'private' : 'public')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition border ${
                      visibility === 'public'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800/80'
                        : 'bg-amber-950 text-amber-300 border-amber-800/80'
                    }`}
                  >
                    {visibility === 'public' ? (
                      <>
                        <Globe className="w-3.5 h-3.5" /> สาธารณะ (Public Gallery)
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" /> ส่วนตัว (Private Only)
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    ประเภทการ์ด (Content Type):
                  </label>
                  <select
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value as ContentType)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100 font-bold"
                  >
                    <option value="unit">ยูนิตกำลังรบ (Unit)</option>
                    <option value="spell">เวทมนตร์ยุทธวิธี (Spell)</option>
                    <option value="tactic">กลยุทธ์สนามรบ (Tactic)</option>
                    <option value="structure">สิ่งปลูกสร้าง (Structure)</option>
                    <option value="relic">โบราณวัตถุเสริมพลัง (Relic)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    ชื่อการ์ด/ยูนิต (Name):
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 font-bold focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    ฝ่าย/จักรวาล (Universe):
                  </label>
                  <select
                    value={universe}
                    onChange={(e) => setUniverse(e.target.value as Universe)}
                    className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-100"
                  >
                    {UNIVERSE_LIST.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nameTh}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  คำอธิบายและปูมหลัง (Flavor & Description):
                </label>
                <input
                  type="text"
                  value={flavor}
                  onChange={(e) => setFlavor(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-slate-300"
                />
              </div>

              {/* Keywords and Artwork button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">คำสำคัญ (Keywords):</label>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-800 text-[11px] text-cyan-300 border border-slate-700"
                      >
                        {kw}
                        <button
                          onClick={() => setKeywords(keywords.filter((_, idx) => idx !== i))}
                          className="hover:text-rose-400"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="text"
                        placeholder="เพิ่ม keyword..."
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddKeyword();
                          }
                        }}
                        className="w-28 rounded-md bg-slate-900 border border-slate-700 px-2 py-0.5 text-xs text-slate-200"
                      />
                      <button
                        onClick={handleAddKeyword}
                        className="px-2 py-0.5 rounded bg-slate-800 text-xs text-slate-300 hover:text-white"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowImageModal(true)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 shadow transition cursor-pointer shrink-0"
                >
                  <ImageIcon className="w-4 h-4" />
                  {artworkUrl ? 'สตูดิโอภาพประกอบ (เปลี่ยนรูปภาพ)' : 'เปิดสตูดิโอภาพประกอบ (AI / Upload)'}
                </button>
              </div>
            </div>

            {/* Combat Stats (Only if Unit or Structure) */}
            {(contentType === 'unit' || contentType === 'structure') && (
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Swords className="w-4 h-4 text-rose-400" /> ค่าสถานะการรบ (Combat Stats)
                  </h3>
                  <span className="text-xs text-slate-400">คำนวณและประมวลผลบนเอนจินจริง</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {contentType === 'unit' && (
                    <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-rose-400">
                        <span className="flex items-center gap-1">
                          <Swords className="w-3.5 h-3.5" /> โจมตี
                        </span>
                        <span className="font-mono text-base font-bold">{attack}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={attack}
                        onChange={(e) => setAttack(Number(e.target.value))}
                        className="accent-rose-500"
                      />
                    </div>
                  )}

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5" /> พลังชีวิต
                      </span>
                      <span className="font-mono text-base font-bold">{health}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={health}
                      onChange={(e) => setHealth(Number(e.target.value))}
                      className="accent-emerald-500"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-sky-400">
                      <span className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5" /> เกราะป้องกัน
                      </span>
                      <span className="font-mono text-base font-bold">{defense}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="5"
                      value={defense}
                      onChange={(e) => setDefense(Number(e.target.value))}
                      className="accent-sky-500"
                    />
                  </div>

                  {contentType === 'unit' && (
                    <>
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-amber-400">
                          <span className="flex items-center gap-1">
                            <Navigation className="w-3.5 h-3.5" /> เดินทัพ
                          </span>
                          <span className="font-mono text-base font-bold">{move} ช่อง</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="4"
                          value={move}
                          onChange={(e) => setMove(Number(e.target.value))}
                          className="accent-amber-500"
                        />
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-purple-400">
                          <span className="flex items-center gap-1">
                            <Crosshair className="w-3.5 h-3.5" /> ระยะยิง
                          </span>
                          <span className="font-mono text-base font-bold">{range} ช่อง</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="4"
                          value={range}
                          onChange={(e) => setRange(Number(e.target.value))}
                          className="accent-purple-500"
                        />
                      </div>

                      <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
                        <span className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                          <Flag className="w-3.5 h-3.5 text-amber-400" /> ยึดจุดยุทธศาสตร์
                        </span>
                        <label className="flex items-center gap-2 cursor-pointer mt-2">
                          <input
                            type="checkbox"
                            checked={canCapture}
                            onChange={(e) => setCanCapture(e.target.checked)}
                            className="w-4 h-4 rounded accent-cyan-500"
                          />
                          <span className="text-xs text-slate-200">
                            {canCapture ? 'ยึดฐานได้' : 'ไม่สามารถยึดฐาน'}
                          </span>
                        </label>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Targeting Mode (For Spells / Tactics) */}
            {contentType !== 'unit' && contentType !== 'structure' && (
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-purple-400" /> กฎการเลือกเป้าหมายร่ายเวท (Targeting Mode)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { id: 'friendly-unit', label: 'ยูนิตฝ่ายเรา (Friendly Unit)' },
                    { id: 'enemy-unit', label: 'ยูนิตศัตรู (Enemy Unit)' },
                    { id: 'cell-area', label: 'ระเบิดพื้นที่ (Area Blast)' },
                    { id: 'lane', label: 'ทั้งเลน (Entire Lane)' },
                    { id: 'outpost', label: 'จุดยุทธศาสตร์ (Outpost)' },
                    { id: 'no-target', label: 'ร่ายทันที (No Target / Global)' },
                  ].map((tm) => (
                    <button
                      key={tm.id}
                      onClick={() => setTargetMode(tm.id as TargetingMode)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition ${
                        targetMode === tm.id
                          ? 'border-purple-400 bg-purple-950/40 text-purple-200 ring-1 ring-purple-400'
                          : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {tm.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cost Controls */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-slate-200">ต้นทุนทรัพยากร (Resource Cost)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
                    <span>⚡ ค่าร่าย Charge</span>
                    <span className="font-mono text-base font-bold">{chargeCost}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="9"
                    value={chargeCost}
                    onChange={(e) => setChargeCost(Number(e.target.value))}
                    className="accent-amber-400"
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
                    <span>🌀 พลังงานริฟต์ (Rift Energy)</span>
                    <span className="font-mono text-base font-bold">{riftCost}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    value={riftCost}
                    onChange={(e) => setRiftCost(Number(e.target.value))}
                    className="accent-purple-400"
                  />
                </div>
              </div>
            </div>

            {/* Abilities per Game Rules Registry */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" /> กลไกความสามารถ (Game Rules Registry)
                  </h3>
                  <p className="text-xs text-slate-400">
                    ความสามารถแต่ละชนิดเชื่อมต่อกับเอนจินจริงของสนามรบ (สูงสุด 2 สกิล)
                  </p>
                </div>
                {abilities.length < 2 && (
                  <button
                    onClick={() => {
                      setAbilities([
                        ...abilities,
                        {
                          id: `ab-custom-${Date.now()}`,
                          name: 'ความสามารถใหม่',
                          description: 'ฟื้นฟูเลือด +2 HP ให้ยูนิตเรา',
                          trigger: 'deploy',
                          actionType: 'heal',
                          powerValue: 2,
                        },
                      ]);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800 hover:bg-cyan-900 transition"
                  >
                    + เพิ่มความสามารถ
                  </button>
                )}
              </div>

              {abilities.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-xs text-slate-500">
                  ไม่มีความสามารถพิเศษเพิ่มเติม
                </div>
              ) : (
                <div className="space-y-4">
                  {abilities.map((ab, idx) => {
                    const ruleDef = GAME_RULES_REGISTRY[ab.actionType] || GAME_RULES_REGISTRY.heal;
                    return (
                      <div
                        key={ab.id}
                        className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-cyan-400 font-mono">
                            ความสามารถ #{idx + 1}: {ruleDef.nameTh}
                          </span>
                          <button
                            onClick={() => setAbilities(abilities.filter((_, i) => i !== idx))}
                            className="text-xs text-slate-400 hover:text-rose-400"
                          >
                            ลบสกิลนี้
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] text-slate-400 block mb-1">กลไกความสามารถ:</label>
                            <select
                              value={ab.actionType}
                              onChange={(e) => {
                                const newType = e.target.value as SupportedActionType;
                                const newRule = GAME_RULES_REGISTRY[newType];
                                const updated = [...abilities];
                                updated[idx] = {
                                  ...updated[idx],
                                  actionType: newType,
                                  name: newRule.nameTh.split(' (')[0],
                                  description: newRule.descriptionTh,
                                  powerValue: newRule.defaultPower,
                                  trigger: newRule.allowedTriggers[0],
                                };
                                setAbilities(updated);
                              }}
                              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-slate-200"
                            >
                              {Object.entries(GAME_RULES_REGISTRY).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v.nameTh}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[11px] text-slate-400 block mb-1">จังหวะแสดงผล:</label>
                            <select
                              value={ab.trigger}
                              onChange={(e) => {
                                const updated = [...abilities];
                                updated[idx].trigger = e.target.value as AbilityTrigger;
                                setAbilities(updated);
                              }}
                              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-slate-200"
                            >
                              {ruleDef.allowedTriggers.map((trig) => (
                                <option key={trig} value={trig}>
                                  {trig === 'deploy'
                                    ? 'เมื่อลงสู่สนาม (On Deploy)'
                                    : trig === 'combat'
                                    ? 'ขณะปะทะรบ (On Combat)'
                                    : trig === 'death'
                                    ? 'เมื่อถูกทำลาย (On Death)'
                                    : trig === 'turn-start'
                                    ? 'เริ่มเทิร์น (Turn Start)'
                                    : 'กดใช้เอง (Active)'}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[11px] text-slate-400 block mb-1">
                              {ruleDef.powerLabelTh}: ({ab.powerValue})
                            </label>
                            <input
                              type="range"
                              min={ruleDef.minPower}
                              max={ruleDef.maxPower}
                              value={ab.powerValue}
                              onChange={(e) => {
                                const updated = [...abilities];
                                updated[idx].powerValue = Number(e.target.value);
                                setAbilities(updated);
                              }}
                              className="w-full accent-cyan-400"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] text-slate-400 block mb-1">ชื่อความสามารถ:</label>
                            <input
                              type="text"
                              value={ab.name}
                              onChange={(e) => {
                                const updated = [...abilities];
                                updated[idx].name = e.target.value;
                                setAbilities(updated);
                              }}
                              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1 text-xs text-slate-200"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-400 block mb-1">คำอธิบายกลไก:</label>
                            <input
                              type="text"
                              value={ab.description}
                              onChange={(e) => {
                                const updated = [...abilities];
                                updated[idx].description = e.target.value;
                                setAbilities(updated);
                              }}
                              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1 text-xs text-slate-200"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel: Live Card Preview & Balance Radar */}
        <div className="w-80 border-l border-slate-800 bg-slate-950/80 p-5 flex flex-col gap-4 overflow-y-auto shrink-0">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              ตัวอย่างการ์ดจริง (Live Preview)
            </span>
            <span className="text-[10px] font-mono text-cyan-400">
              v{currentRecord.contentVersion}
            </span>
          </div>

          {/* Interactive Card Render */}
          <div className="flex justify-center py-1">
            <CardView card={previewCardDef} variant="detail" />
          </div>

          {/* BALANCE EVALUATION RADAR */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" /> วิเคราะห์สมดุล (Balance Radar)
              </span>
              <span className={`text-xs font-bold font-mono ${balance.verdictColor}`}>
                {balance.balanceScore}%
              </span>
            </div>

            <div className={`p-2 rounded-lg bg-slate-950 border text-xs font-semibold ${balance.verdictColor} border-slate-800`}>
              {balance.verdictTh}
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>พลังโจมตี (Offense)</span>
                <span className="font-mono text-rose-400 font-bold">{balance.offenseRating}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${Math.min(100, balance.offenseRating * 8)}%` }} />
              </div>

              <div className="flex justify-between text-slate-400">
                <span>ความทนทาน (Durability)</span>
                <span className="font-mono text-emerald-400 font-bold">{balance.durabilityRating}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(100, balance.durabilityRating * 6)}%` }} />
              </div>

              <div className="flex justify-between text-slate-400">
                <span>ความคล่องตัว (Mobility)</span>
                <span className="font-mono text-amber-400 font-bold">{balance.mobilityRating}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(100, balance.mobilityRating * 14)}%` }} />
              </div>

              <div className="flex justify-between text-slate-400">
                <span>แนะนำค่าร่าย:</span>
                <span className="font-mono text-cyan-400 font-bold">
                  {balance.recommendedCharge}⚡ {balance.recommendedRift ? `+ ${balance.recommendedRift}🌀` : ''}
                </span>
              </div>
            </div>

            {balance.warnings.length > 0 && (
              <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/80 text-[10px] text-amber-300 space-y-1">
                {balance.warnings.map((w, i) => (
                  <p key={i}>• {w}</p>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-2 pt-2">
            <button
              onClick={handleSaveContent}
              className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
            >
              <Save className="w-4 h-4" /> บันทึกผลงาน (Save)
            </button>

            {editingId && (
              <button
                onClick={handleDuplicate}
                className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 transition"
              >
                <Copy className="w-3.5 h-3.5" /> ทำสำเนา (Duplicate)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image Selector / AI Studio Modal */}
      {showImageModal && (
        <ImageSelectorModal
          currentImageUrl={artworkUrl}
          defaultUniverse={universe}
          onSelectImage={(url) => setArtworkUrl(url || undefined)}
          onClose={() => setShowImageModal(false)}
        />
      )}

      {/* Toast Notification */}
      {toastNotification && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-cyan-400/80 text-cyan-200 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-cyan-400" />
          <span>{toastNotification}</span>
        </div>
      )}
    </div>
  );
};
