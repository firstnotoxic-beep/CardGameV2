import React, { useState, useEffect } from 'react';
import { CreatorContentRecord, ContentType } from '../../types/creator';
import { creatorService } from '../../services/creatorService';
import { CardView } from '../CardView';
import { toCardDefinitionFromCreator } from '../../game/rules/creatorValidator';
import { UNIVERSE_LIST } from '../../game/rules/gameRulesRegistry';
import { soundFx } from '../../utils/audio';
import {
  Globe,
  Search,
  SlidersHorizontal,
  Sparkles,
  GitFork,
  Flag,
  X,
  Check,
  Eye,
  Layers,
  Heart,
  Swords,
  Shield,
  AlertTriangle,
  RotateCcw,
  ArrowLeft,
} from 'lucide-react';

interface PublicGalleryProps {
  onRemixCard: (forkedRecord: CreatorContentRecord) => void;
  onClose?: () => void;
}

export const PublicGallery: React.FC<PublicGalleryProps> = ({ onRemixCard, onClose }) => {
  const [publicCards, setPublicCards] = useState<CreatorContentRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedUniverse, setSelectedUniverse] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [selectedCard, setSelectedCard] = useState<CreatorContentRecord | null>(null);
  const [reportingCard, setReportingCard] = useState<CreatorContentRecord | null>(null);
  const [reportReason, setReportReason] = useState<'inappropriate' | 'copyright' | 'unsupported_mechanics' | 'other'>('inappropriate');
  const [reportNotes, setReportNotes] = useState<string>('');
  const [isSubmittingReport, setIsSubmittingReport] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadGallery = async () => {
    setIsLoading(true);
    try {
      const records = await creatorService.getPublicGallery();
      setPublicCards(records);
    } catch (e) {
      console.warn('Error loading public gallery:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGallery();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRemix = async (item: CreatorContentRecord) => {
    try {
      soundFx.playDeploy();
      const remixed = await creatorService.remixContent(item);
      showToast(`รีมิกซ์ผลงาน '${item.name}' เรียบร้อยแล้ว! พร้อมเปิดแก้ไขในการ์ดฟอร์จ`);
      onRemixCard(remixed);
    } catch (err: any) {
      showToast(err.message || 'การรีมิกซ์ล้มเหลว');
    }
  };

  const handleSendReport = async () => {
    if (!reportingCard) return;
    setIsSubmittingReport(true);
    try {
      await creatorService.reportContent(reportingCard.id, reportReason, reportNotes);
      showToast('ส่งรายงานแจ้งปัญหาเรียบร้อยแล้ว ทีมผู้ดูแลจะตรวจสอบต่อไป');
      setReportingCard(null);
      setReportNotes('');
    } catch (err: any) {
      showToast(err.message || 'ไม่สามารถส่งรายงานได้');
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const filteredCards = publicCards.filter((card) => {
    if (selectedUniverse !== 'all' && card.universe !== selectedUniverse) return false;
    if (selectedType !== 'all' && card.contentType !== selectedType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = card.name.toLowerCase().includes(q);
      const matchAuthor = card.ownerDisplayName?.toLowerCase().includes(q);
      const matchDesc = card.description?.toLowerCase().includes(q);
      if (!matchName && !matchAuthor && !matchDesc) return false;
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Header Bar */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="กลับสู่ล็อบบี้"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold font-display tracking-wider text-slate-100">
                หอสมุดพหุภพ (MULTIVERSE PUBLIC GALLERY)
              </h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                {publicCards.length} ผลงานสาธารณะ
              </span>
            </div>
            <p className="text-xs text-slate-400">
              สำรวจการ์ดและยูนิตจากสถาปนิกทั่วทั้งพหุภพ ทดลองเล่น หรือรีมิกซ์เป็นผลงานเวอร์ชันของคุณเอง
            </p>
          </div>
        </div>

        <button
          onClick={loadGallery}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> รีเฟรช
        </button>
      </header>

      {/* Filter and Search Bar */}
      <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Universe Filter */}
          <select
            value={selectedUniverse}
            onChange={(e) => setSelectedUniverse(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200"
          >
            <option value="all">ทุกจักรวาล (All Universes)</option>
            {UNIVERSE_LIST.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nameTh}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {(['all', 'unit', 'spell', 'tactic', 'structure'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-3 py-1 rounded-lg capitalize font-semibold transition ${
                  selectedType === t
                    ? 'bg-purple-600 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'all' ? 'ทุกประเภท' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อการ์ด, ผู้สร้าง..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-purple-400"
          />
        </div>
      </div>

      {/* Cards Catalog */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="py-24 text-center text-xs text-slate-400">
            กำลังโหลดข้อมูลจากหอสมุดพหุภพ...
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="py-24 text-center">
            <h3 className="text-sm font-bold text-slate-300">ไม่พบผลงานที่ตรงกับเงื่อนไข</h3>
            <p className="text-xs text-slate-500 mt-1">ลองเปลี่ยนคำค้นหาหรือเลือกดูจักรวาลอื่น</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredCards.map((card) => {
              const cardDef = toCardDefinitionFromCreator(card);
              return (
                <div
                  key={card.id}
                  onClick={() => setSelectedCard(card)}
                  className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 flex flex-col justify-between hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-950/30 transition cursor-pointer group"
                >
                  <div>
                    {/* Header: Author & Cost */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-slate-400 font-medium truncate max-w-[130px]">
                        โดย {card.ownerDisplayName}
                      </span>
                      <div className="flex items-center gap-1 font-mono-nums text-[11px] font-bold">
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          ⚡ {card.cost.charge}
                        </span>
                        {card.cost.rift ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            🌀 {card.cost.rift}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Card Artwork Banner */}
                    <div className="w-full h-32 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 relative mb-2.5">
                      {card.artwork?.url ? (
                        <img src={card.artwork.url} alt={card.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                          ◆ {card.contentType.toUpperCase()}
                        </div>
                      )}
                      <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-slate-950/80 backdrop-blur-xs text-[9px] font-bold uppercase tracking-wider text-cyan-300 border border-cyan-800/40">
                        {card.universe.split('-')[0]}
                      </div>
                    </div>

                    <h3 className="font-bold text-sm text-slate-100 group-hover:text-purple-300 transition-colors line-clamp-1 mb-1">
                      {card.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                      {card.description}
                    </p>

                    {/* Ability / Stats Preview */}
                    {card.contentType === 'unit' && card.stats ? (
                      <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-slate-800 text-slate-300">
                        <span className="text-rose-400 flex items-center gap-0.5">
                          <Swords className="w-3 h-3" /> {card.stats.attack}
                        </span>
                        <span className="text-emerald-400 flex items-center gap-0.5">
                          <Heart className="w-3 h-3" /> {card.stats.health}
                        </span>
                        <span className="text-sky-400 flex items-center gap-0.5">
                          <Shield className="w-3 h-3" /> {card.stats.defense}
                        </span>
                        <span className="text-amber-400">{card.stats.move} Mv</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-purple-300 truncate pt-2 border-t border-slate-800">
                        {card.abilities?.[0]?.name || 'การ์ดยุทธวิธีพิเศษ'}
                      </div>
                    )}
                  </div>

                  {/* Remix Action Button */}
                  <div className="pt-3 border-t border-slate-800/80 mt-3 flex items-center justify-between">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemix(card);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/50 transition cursor-pointer"
                    >
                      <GitFork className="w-3.5 h-3.5" /> รีมิกซ์ (Remix)
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReportingCard(card);
                      }}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                      title="รายงานเนื้อหาที่ไม่เหมาะสม"
                    >
                      <Flag className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 flex flex-col md:flex-row gap-6">
            <button
              onClick={() => setSelectedCard(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Live Render */}
            <div className="shrink-0 flex justify-center">
              <CardView card={toCardDefinitionFromCreator(selectedCard)} variant="detail" />
            </div>

            {/* Details & Actions */}
            <div className="flex-1 flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 inline-block mb-1">
                  สาธารณะ · {selectedCard.contentType}
                </span>
                <h2 className="text-xl font-bold font-display text-slate-100">{selectedCard.name}</h2>
                <div className="text-xs text-slate-400 mt-0.5">
                  สร้างโดย: <span className="text-slate-200 font-semibold">{selectedCard.ownerDisplayName}</span>
                </div>

                <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                  <div className="text-slate-300 leading-relaxed">{selectedCard.description}</div>
                  {selectedCard.flavorText && (
                    <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-900">
                      "{selectedCard.flavorText}"
                    </div>
                  )}
                </div>

                {/* Provenance if remixed */}
                {selectedCard.originalContentId && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-purple-300">
                    <GitFork className="w-3.5 h-3.5" /> รีมิกซ์ต่อยอดมาจาก {selectedCard.forkedFromAuthor || 'ต้นฉบับ'}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={() => {
                    const c = selectedCard;
                    setSelectedCard(null);
                    handleRemix(c);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-900/40 cursor-pointer"
                >
                  <GitFork className="w-4 h-4" /> รีมิกซ์และปรับแต่ง (Fork to My Drafts)
                </button>

                <button
                  onClick={() => {
                    const c = selectedCard;
                    setSelectedCard(null);
                    setReportingCard(c);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-xs font-semibold flex items-center gap-1 border border-slate-700"
                >
                  <Flag className="w-4 h-4" /> รายงาน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportingCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> รายงานเนื้อหาที่ไม่เหมาะสม
              </h3>
              <button onClick={() => setReportingCard(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              การ์ดเป้าหมาย: <span className="font-bold text-white">{reportingCard.name}</span>
            </p>

            <div>
              <label className="text-xs text-slate-400 block mb-1">เหตุผลในการรายงาน:</label>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200"
              >
                <option value="inappropriate">เนื้อหาไม่เหมาะสม / หยาบคาย</option>
                <option value="copyright">ละเมิดลิขสิทธิ์ / สิทธิ์ภาพถ่าย</option>
                <option value="unsupported_mechanics">กลไกผิดกติกา / พยายามหลอกลวงระบบ</option>
                <option value="other">เหตุผลอื่นๆ</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">รายละเอียดเพิ่มเติม (ไม่บังคับ):</label>
              <textarea
                rows={3}
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="อธิบายเหตุผลเพิ่มเติม..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReportingCard(null)}
                className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-200"
              >
                ยกเลิก
              </button>
              <button
                disabled={isSubmittingReport}
                onClick={handleSendReport}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white"
              >
                {isSubmittingReport ? 'กำลังส่ง...' : 'ยืนยันการรายงาน'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-purple-400/80 text-purple-200 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-purple-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
