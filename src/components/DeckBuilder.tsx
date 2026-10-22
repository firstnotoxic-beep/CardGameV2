import React, { useState } from 'react';
import { CardDefinition, DeckConfig, Universe, CardType } from '../types/game';
import { CARD_DATABASE, UNIVERSE_CONFIG } from '../data/cards';
import { STARTER_DECKS } from '../data/starterDecks';
import { CardView } from './CardView';
import { Plus, Minus, Download, Upload, Check, AlertCircle, Sparkles, Search, Layers, RefreshCw } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface DeckBuilderProps {
  currentDeck: DeckConfig;
  customCards: CardDefinition[];
  onSaveDeck: (deck: DeckConfig) => void;
  onClose: () => void;
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({
  currentDeck,
  customCards,
  onSaveDeck,
  onClose,
}) => {
  const [deck, setDeck] = useState<DeckConfig>({ ...currentDeck });
  const [selectedUniverse, setSelectedUniverse] = useState<Universe | 'all'>('all');
  const [selectedType, setSelectedType] = useState<CardType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [inspectedCard, setInspectedCard] = useState<CardDefinition | null>(null);
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Combine static card database + custom cards
  const allCardsMap: Record<string, CardDefinition> = { ...CARD_DATABASE };
  customCards.forEach((c) => {
    allCardsMap[c.id] = c;
  });

  // Calculate card counts in current deck
  const cardCounts: Record<string, number> = {};
  deck.cardIds.forEach((id) => {
    cardCounts[id] = (cardCounts[id] || 0) + 1;
  });

  const totalCards = deck.cardIds.length;
  const isDeckValid = totalCards === 50 && !!deck.partnerId && !!deck.originId;

  // Filter cards for the library catalog
  const filteredCatalog = Object.values(allCardsMap).filter((card) => {
    if (card.cardType === 'nexus-partner' || card.cardType === 'origin') return false;
    if (selectedUniverse !== 'all' && card.universe !== selectedUniverse) return false;
    if (selectedType !== 'all' && card.cardType !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = card.name.toLowerCase().includes(q);
      const matchKeywords = card.keywords?.some((k) => k.toLowerCase().includes(q));
      if (!matchName && !matchKeywords) return false;
    }
    return true;
  });

  // Partner cards
  const partnerCards = Object.values(allCardsMap).filter((c) => c.cardType === 'nexus-partner');
  // Origin cards
  const originCards = Object.values(allCardsMap).filter((c) => c.cardType === 'origin');

  const addCard = (cardId: string) => {
    const count = cardCounts[cardId] || 0;
    if (count >= 4) {
      setNotification(`ใส่การ์ดได้สูงสุด 4 ใบต่อชนิดสำหรับ ${allCardsMap[cardId]?.name || 'การ์ดนี้'}`);
      setTimeout(() => setNotification(null), 2500);
      return;
    }
    if (deck.cardIds.length >= 50) {
      setNotification('เด็คต้องมีขนาดสูงสุดไม่เกิน 50 ใบ');
      setTimeout(() => setNotification(null), 2500);
      return;
    }

    soundFx.playCardSelect();
    setDeck({
      ...deck,
      cardIds: [...deck.cardIds, cardId],
    });
  };

  const removeCard = (cardId: string) => {
    const idx = deck.cardIds.lastIndexOf(cardId);
    if (idx !== -1) {
      soundFx.playCardSelect();
      const newIds = [...deck.cardIds];
      newIds.splice(idx, 1);
      setDeck({
        ...deck,
        cardIds: newIds,
      });
    }
  };

  const loadPreset = (preset: DeckConfig) => {
    soundFx.playDeploy();
    setDeck({ ...preset });
    setNotification(`โหลดชุดเด็คสำเร็จรูป "${preset.name}" แล้ว`);
    setTimeout(() => setNotification(null), 2000);
  };

  const exportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(deck, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${deck.name.toLowerCase().replace(/\s+/g, '_')}_deck.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(importJsonText);
      if (Array.isArray(parsed.cardIds) && parsed.cardIds.length === 50) {
        setDeck({
          id: parsed.id || `custom-deck-${Date.now()}`,
          name: parsed.name || 'เด็คนำเข้า',
          partnerId: parsed.partnerId || 'PARTNER-01',
          originId: parsed.originId || 'ORIGIN-01',
          universes: parsed.universes || ['iron-frontier'],
          cardIds: parsed.cardIds,
          isCustom: true,
        });
        setShowImportModal(false);
        setNotification('นำเข้าเด็คสำเร็จเรียบร้อย!');
        setTimeout(() => setNotification(null), 2000);
      } else {
        alert('โครงสร้าง JSON ของเด็คไม่ถูกต้อง: เด็คต้องมีอาเรย์ cardIds ครบ 50 ใบพอดี');
      }
    } catch (e) {
      alert('ไม่สามารถอ่านไฟล์ JSON ได้ กรุณาตรวจสอบรูปแบบข้อความ');
    }
  };

  return (
    <div className="flex flex-col h-full w-full max-w-7xl mx-auto p-4 select-none">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" /> สตูดิโอจัดเด็คสถาปนิก (Deck Architect Studio)
          </h2>
          <p className="text-xs text-slate-400">
            ปรับแต่งเด็คต่อสู้ทางยุทธวิธีมัลติเวิร์สขนาด 50 ใบ (ใส่การ์ดซ้ำได้สูงสุด 4 ใบต่อชนิด)
          </p>
        </div>

        {/* Quick starter decks dropdown & actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded-lg border border-slate-800 text-xs text-slate-300">
            <span>เด็คสำเร็จรูป:</span>
            {STARTER_DECKS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => loadPreset(preset)}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-cyan-900/40 hover:text-cyan-300 text-xs transition-colors"
              >
                {preset.name.split(' ')[0]}
              </button>
            ))}
          </div>

          <button
            onClick={exportJson}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> ส่งออก JSON
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs border border-slate-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> นำเข้าเด็ค
          </button>

          <button
            disabled={!isDeckValid}
            onClick={() => {
              onSaveDeck(deck);
              soundFx.playDeploy();
              onClose();
            }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              isDeckValid
                ? 'bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-400 hover:to-sky-500 text-slate-950 shadow-lg shadow-cyan-900/40'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            <Check className="w-4 h-4" /> บันทึกเด็คและกลับ
          </button>
        </div>
      </div>

      {notification && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-amber-950/60 border border-amber-600/50 text-amber-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* MAIN TWO-COLUMN SPLIT: LEFT CATALOG & RIGHT DECK ROSTER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 overflow-hidden">
        {/* LEFT COLUMN: CARD CATALOG & SEARCH (7 cols) */}
        <div className="lg:col-span-7 flex flex-col bg-slate-950 rounded-xl border border-slate-800 p-3 overflow-hidden">
          {/* SEARCH & FILTERS */}
          <div className="flex flex-col gap-2 mb-3">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="ค้นหาการ์ดตามชื่อหรือความสามารถ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Universe Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                onClick={() => setSelectedUniverse('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                  selectedUniverse === 'all'
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                ทุกจักรวาล
              </button>
              {(Object.keys(UNIVERSE_CONFIG) as Universe[]).map((u) => {
                const conf = UNIVERSE_CONFIG[u];
                return (
                  <button
                    key={u}
                    onClick={() => setSelectedUniverse(u)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedUniverse === u
                        ? `${conf.badgeBg} border`
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {conf.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CARD TILES GRID */}
          <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5 pr-1">
            {filteredCatalog.map((card) => {
              const countInDeck = cardCounts[card.id] || 0;
              const isMax = countInDeck >= 4;
              return (
                <div
                  key={card.id}
                  onClick={() => setInspectedCard(card)}
                  className="relative group bg-slate-900/90 rounded-lg border border-slate-800 p-2 flex flex-col justify-between hover:border-cyan-500 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-[11px] font-bold text-slate-200 truncate">
                      {card.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono-nums font-bold text-[10px]">
                      {card.cost.charge}⚡
                    </span>
                  </div>

                  <div className="text-[10px] text-slate-400 capitalize mb-1">
                    {card.cardType === 'unit'
                      ? 'ยูนิต'
                      : card.cardType === 'structure'
                      ? 'ป้อมปราการ'
                      : card.cardType === 'tactic'
                      ? 'ยุทธวิธี'
                      : 'วัตถุโบราณ'}{' '}
                    · {card.universe.split('-')[0]}
                  </div>

                  {card.cardType === 'unit' ? (
                    <div className="flex items-center justify-between text-[10px] font-mono-nums text-slate-300 pt-1 border-t border-slate-800">
                      <span className="text-rose-400 font-bold">{card.attack} ตี</span>
                      <span className="text-emerald-400 font-bold">{card.health} เลือด</span>
                      <span className="text-sky-400 font-bold">{card.defense} เกราะ</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-cyan-300 truncate pt-1 border-t border-slate-800">
                      {card.abilities?.[0]?.name || card.keywords?.[0] || 'การ์ดยุทธวิธี'}
                    </div>
                  )}

                  {/* Add / Count controls overlay */}
                  <div className="mt-2 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                    <span className="text-[10px] font-mono-nums font-bold text-slate-400">
                      ในเด็ค: {countInDeck}/4
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCard(card.id);
                        }}
                        disabled={countInDeck === 0}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 flex items-center justify-center disabled:opacity-30"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addCard(card.id);
                        }}
                        disabled={isMax || totalCards >= 50}
                        className="w-5 h-5 rounded bg-slate-800 hover:bg-cyan-900 hover:text-cyan-300 text-slate-400 flex items-center justify-center disabled:opacity-30"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: DECK ROSTER & VALIDATION (5 cols) */}
        <div className="lg:col-span-5 flex flex-col bg-slate-950 rounded-xl border border-slate-800 p-3 overflow-hidden">
          {/* Deck Validation Bar */}
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-slate-200">ความจุเด็ค</span>
              <span
                className={`font-mono-nums text-sm font-bold ${
                  totalCards === 50
                    ? 'text-emerald-400'
                    : totalCards < 50
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {totalCards} / 50 ใบ
              </span>
            </div>

            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  totalCards === 50
                    ? 'bg-emerald-500'
                    : totalCards < 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${Math.min(100, (totalCards / 50) * 100)}%` }}
              />
            </div>

            {totalCards !== 50 && (
              <div className="text-[10px] text-amber-300 mt-1">
                {totalCards < 50
                  ? `ต้องการการ์ดเพิ่มอีก ${50 - totalCards} ใบเพื่อเข้าร่วมการแข่งขัน`
                  : `กรุณานำการ์ดออก ${totalCards - 50} ใบ`}
              </div>
            )}
          </div>

          {/* Nexus Partner & Origin Selectors */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                คู่หูเน็กซัส (Nexus Partner)
              </label>
              <select
                value={deck.partnerId}
                onChange={(e) => setDeck({ ...deck, partnerId: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-cyan-300 font-semibold focus:outline-none"
              >
                {partnerCards.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                จุดกำเนิดเด็ค (Deck Origin)
              </label>
              <select
                value={deck.originId}
                onChange={(e) => setDeck({ ...deck, originId: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-purple-300 font-semibold focus:outline-none"
              >
                {originCards.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cards currently in deck list */}
          <div className="text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
            <span>รายการการ์ดในเด็ค ({Object.keys(cardCounts).length} แบบ)</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {Object.entries(cardCounts).map(([cardId, count]) => {
              const card = allCardsMap[cardId];
              if (!card) return null;
              return (
                <div
                  key={cardId}
                  onClick={() => setInspectedCard(card)}
                  className="flex items-center justify-between p-1.5 rounded bg-slate-900/80 border border-slate-800/80 hover:border-slate-600 transition-colors text-xs cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded bg-amber-500/20 text-amber-300 flex items-center justify-center font-mono-nums font-bold text-[10px] shrink-0">
                      {card.cost.charge}
                    </span>
                    <span className="font-semibold text-slate-200 truncate">{card.name}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono-nums font-bold text-cyan-400 text-xs">
                      ×{count}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeCard(cardId);
                      }}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-rose-950 hover:text-rose-400 text-slate-400 flex items-center justify-center"
                    >
                        <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        addCard(cardId);
                      }}
                      disabled={count >= 4 || totalCards >= 50}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-cyan-900 hover:text-cyan-300 text-slate-400 flex items-center justify-center disabled:opacity-30"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* INSPECTED CARD MODAL */}
      {inspectedCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setInspectedCard(null)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <CardView card={inspectedCard} />
            <div className="text-center mt-3">
              <button
                onClick={() => setInspectedCard(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
              >
                ปิดหน้าต่างตรวจสอบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT JSON MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-lg w-full">
            <h3 className="text-sm font-bold text-slate-100 mb-2">นำเข้าเด็คด้วยโค้ด JSON</h3>
            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="วางโค้ด JSON ของเด็คที่ส่งออกมาที่นี่..."
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 text-xs text-slate-400"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleImportJson}
                className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white"
              >
                โหลดเด็ค
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
