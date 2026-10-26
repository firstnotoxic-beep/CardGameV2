import React, { useState, useEffect } from 'react';
import { CreatorContentRecord, ContentType } from '../../types/creator';
import { creatorService } from '../../services/creatorService';
import { auth, loginWithGoogle } from '../../services/firebase';
import { CardView } from '../CardView';
import { toCardDefinitionFromCreator } from '../../game/rules/creatorValidator';
import { soundFx } from '../../utils/audio';
import {
  Layers,
  Globe,
  Lock,
  Plus,
  Trash2,
  Copy,
  Edit,
  ArrowUpRight,
  ArrowLeft,
  Search,
  SlidersHorizontal,
  Check,
  Shield,
  Sparkles,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

interface MyCollectionProps {
  onOpenForge: (contentId?: string) => void;
  onAddToDeck?: (cardDef: any) => void;
  onClose?: () => void;
}

export const MyCollection: React.FC<MyCollectionProps> = ({
  onOpenForge,
  onAddToDeck,
  onClose,
}) => {
  const [items, setItems] = useState<CreatorContentRecord[]>([]);
  const [selectedType, setSelectedType] = useState<ContentType | 'all'>('all');
  const [selectedVisibility, setSelectedVisibility] = useState<'all' | 'private' | 'public'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [inspectedItem, setInspectedItem] = useState<CreatorContentRecord | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = () => {
    const list = creatorService.getMyContent();
    setItems(list);
    if (list.length > 0 && !inspectedItem) {
      setInspectedItem(list[0]);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleTogglePublish = async (item: CreatorContentRecord) => {
    try {
      if (item.visibility === 'public') {
        const updated = await creatorService.unpublishContent(item.id);
        showToast(`ถอนการเผยแพร่ '${updated.name}' กลับสู่คลังส่วนตัวแล้ว`);
      } else {
        if (!auth.currentUser) {
          try {
            await loginWithGoogle();
          } catch (e: any) {
            if (e?.code !== 'auth/popup-closed-by-user') {
              showToast('กรุณาเข้าสู่ระบบด้วย Google ก่อนเผยแพร่สู่หอสมุดพหุภพ');
            }
            return;
          }
        }
        const updated = await creatorService.publishContent(item.id);
        soundFx.playVictory();
        showToast(`เผยแพร่ '${updated.name}' สู่หอสมุดพหุภพ (Public Gallery) สำเร็จ!`);
      }
      loadData();
    } catch (err: any) {
      showToast(err.message || 'การปรับเปลี่ยนสถานะล้มเหลว');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const copy = await creatorService.duplicateContent(id);
      soundFx.playCardSelect();
      showToast(`ทำสำเนา '${copy.name}' สำเร็จ`);
      loadData();
      setInspectedItem(copy);
    } catch (err: any) {
      showToast(err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ '${name}' ออกจากคลัง?`)) {
      try {
        await creatorService.deleteContent(id);
        showToast('ลบผลงานสำเร็จ');
        loadData();
        if (inspectedItem?.id === id) setInspectedItem(null);
      } catch (err: any) {
        showToast(err.message);
      }
    }
  };

  const filteredItems = items.filter((item) => {
    if (selectedType !== 'all' && item.contentType !== selectedType) return false;
    if (selectedVisibility !== 'all' && item.visibility !== selectedVisibility) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchKeywords = item.keywords?.some((k) => k.toLowerCase().includes(q));
      if (!matchName && !matchKeywords) return false;
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
                คลังผลงานส่วนตัว (MY CREATIONS)
              </h1>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                {items.length} รายการ
              </span>
            </div>
            <p className="text-xs text-slate-400">
              จัดการการ์ดและยูนิตที่คุณสร้างขึ้น เผยแพร่สู่สาธารณะ หรือนำไปบรรจุลงเด็คยุทธวิธี
            </p>
          </div>
        </div>

        <button
          onClick={() => onOpenForge()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/25 transition cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> สร้างการ์ด/ยูนิตใหม่
        </button>
      </header>

      {/* Filter and Search Controls */}
      <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Content Type Filter */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {(['all', 'unit', 'spell', 'tactic', 'structure', 'relic'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className={`px-3 py-1 rounded-lg capitalize font-semibold transition ${
                  selectedType === t
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === 'all' ? 'ทั้งหมด' : t}
              </button>
            ))}
          </div>

          {/* Visibility Filter */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedVisibility('all')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                selectedVisibility === 'all'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setSelectedVisibility('private')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition ${
                selectedVisibility === 'private'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3 h-3" /> ส่วนตัว
            </button>
            <button
              onClick={() => setSelectedVisibility('public')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition ${
                selectedVisibility === 'public'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Globe className="w-3 h-3" /> สาธารณะ
            </button>
          </div>
        </div>

        {/* Search Box */}
        <div className="relative w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อการ์ด, คำสำคัญ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Main Grid & Preview Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Cards Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredItems.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 mb-3">
                <FolderOpen className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-bold text-slate-300">ไม่พบรายการในคลัง</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm">
                สร้างยูนิตหรือการ์ดใบแรกของคุณผ่านเตาหลอม หรือลองปรับเงื่อนไขการค้นหา
              </p>
              <button
                onClick={() => onOpenForge()}
                className="mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              >
                เข้าสู่เตาหลอม
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map((item) => {
                const cardDef = toCardDefinitionFromCreator(item);
                const isSelected = inspectedItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setInspectedItem(item);
                      soundFx.playCardSelect();
                    }}
                    className={`relative rounded-2xl p-3 border transition cursor-pointer flex flex-col justify-between group ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-950/20 ring-2 ring-cyan-500/40 shadow-xl'
                        : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                            item.visibility === 'public'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                              : 'bg-amber-950 text-amber-300 border border-amber-800/60'
                          }`}
                        >
                          {item.visibility === 'public' ? (
                            <>
                              <Globe className="w-2.5 h-2.5" /> สาธารณะ
                            </>
                          ) : (
                            <>
                              <Lock className="w-2.5 h-2.5" /> ส่วนตัว
                            </>
                          )}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          v{item.contentVersion}
                        </span>
                      </div>

                      {/* Card Thumbnail / Header */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-14 rounded-lg overflow-hidden bg-slate-950 border border-slate-800 shrink-0 relative">
                          {item.artwork?.url ? (
                            <img src={item.artwork.url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                              ◆
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-xs text-slate-100 truncate">{item.name}</h4>
                          <div className="text-[10px] text-slate-400 capitalize">{item.contentType} · {item.universe}</div>
                          <div className="text-[10px] font-mono text-amber-300 mt-0.5">
                            ⚡ {item.cost.charge} {item.cost.rift ? `🌀 ${item.cost.rift}` : ''}
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-snug">
                        {item.description}
                      </p>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="pt-3 border-t border-slate-800/80 mt-3 flex items-center justify-between">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenForge(item.id);
                        }}
                        className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                      >
                        <Edit className="w-3 h-3" /> แก้ไข
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePublish(item);
                          }}
                          className={`p-1.5 rounded-lg text-xs transition ${
                            item.visibility === 'public'
                              ? 'text-amber-400 hover:bg-amber-950/60'
                              : 'text-emerald-400 hover:bg-emerald-950/60'
                          }`}
                          title={item.visibility === 'public' ? 'ถอนการเผยแพร่' : 'เผยแพร่สู่สาธารณะ'}
                        >
                          {item.visibility === 'public' ? <Lock className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(item.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                          title="ทำสำเนา"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id, item.name);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 transition"
                          title="ลบ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Inspector Sidebar */}
        {inspectedItem && (
          <aside className="w-80 border-l border-slate-800 bg-slate-900/70 p-5 flex flex-col justify-between shrink-0 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  ตรวจสอบการ์ด (Card Inspector)
                </span>
                <span className="text-[10px] font-mono text-cyan-400">
                  {inspectedItem.id}
                </span>
              </div>

              {/* Card Preview */}
              <div className="flex justify-center mb-4">
                <CardView card={toCardDefinitionFromCreator(inspectedItem)} variant="detail" />
              </div>

              {/* Provenance Metadata */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5 mb-4">
                <div className="flex justify-between text-slate-400">
                  <span>ผู้สร้าง:</span>
                  <span className="text-slate-200 font-semibold">{inspectedItem.ownerDisplayName}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>เวอร์ชัน:</span>
                  <span className="font-mono text-cyan-300">v{inspectedItem.contentVersion}</span>
                </div>
                {inspectedItem.originalContentId && (
                  <div className="flex justify-between text-slate-400">
                    <span>รีมิกซ์มาจาก:</span>
                    <span className="text-purple-300 font-mono text-[10px] truncate max-w-[120px]">
                      {inspectedItem.forkedFromAuthor || inspectedItem.originalContentId}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-slate-400">
                  <span>สถานะการมองเห็น:</span>
                  <span className={inspectedItem.visibility === 'public' ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    {inspectedItem.visibility === 'public' ? 'สาธารณะ (Public)' : 'ส่วนตัว (Private)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="space-y-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => onOpenForge(inspectedItem.id)}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 transition cursor-pointer"
              >
                <Edit className="w-4 h-4" /> ปรับแต่งในการ์ดฟอร์จ
              </button>

              <button
                onClick={() => handleTogglePublish(inspectedItem)}
                className={`w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition ${
                  inspectedItem.visibility === 'public'
                    ? 'bg-amber-950/40 border-amber-800/80 text-amber-300 hover:bg-amber-900/40'
                    : 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300 hover:bg-emerald-900/40'
                }`}
              >
                {inspectedItem.visibility === 'public' ? (
                  <>
                    <Lock className="w-3.5 h-3.5" /> เปลี่ยนเป็นส่วนตัว (Unpublish)
                  </>
                ) : (
                  <>
                    <Globe className="w-3.5 h-3.5" /> เผยแพร่สู่สาธารณะ (Publish)
                  </>
                )}
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-slate-900/95 border border-cyan-400/80 text-cyan-200 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-bounce">
          <Check className="w-4 h-4 text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
