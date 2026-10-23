import React from 'react';
import { Shield, Trophy, Award, Target, Flame, ChevronRight, X } from 'lucide-react';

interface RankedModalProps {
  userElo: number;
  userRank: string;
  matchHistory: {
    id: string;
    date: string;
    opponent: string;
    result: 'Victory' | 'Defeat';
    eloDelta: number;
    laneWinner: string;
  }[];
  onClose: () => void;
}

const RANK_TIERS = [
  { name: 'ยอดฝีมือสูงสุด (Eternal)', minElo: 1800, color: 'text-amber-300', bg: 'bg-amber-950/40 border-amber-600/50' },
  { name: 'สถาปนิกมิติ (World Architect)', minElo: 1600, color: 'text-purple-300', bg: 'bg-purple-950/40 border-purple-600/50' },
  { name: 'ปรมาจารย์เน็กซัส (Nexus Master)', minElo: 1400, color: 'text-rose-300', bg: 'bg-rose-950/40 border-rose-600/50' },
  { name: 'ผู้ช่ำชองริฟต์ (Rift Adept)', minElo: 1200, color: 'text-cyan-300', bg: 'bg-cyan-950/40 border-cyan-600/50' },
  { name: 'กองหน้าจู่โจม (Striker)', minElo: 1000, color: 'text-emerald-300', bg: 'bg-emerald-950/40 border-emerald-600/50' },
  { name: 'ทหารเกณฑ์ใหม่ (Recruit)', minElo: 0, color: 'text-slate-300', bg: 'bg-slate-900 border-slate-700' },
];

export const RankedModal: React.FC<RankedModalProps> = ({
  userElo,
  userRank,
  matchHistory,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="rift-modal rift-ranked-modal relative bg-slate-950 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="font-display font-bold text-lg text-slate-100">
                สถาปัตยกรรมจัดอันดับเน็กซัส (Nexus Ranked Architecture)
              </h2>
              <div className="text-xs text-slate-400">
                ระบบบันไดการแข่งขันและระดับดิวิชันอย่างเป็นทางการ
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Standing Card */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/50 flex items-center justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              ดิวิชันปัจจุบัน
            </div>
            <div className="text-xl font-display font-black text-amber-300 tracking-wide mt-0.5">
              {userRank}
            </div>
            <div className="text-xs font-mono-nums text-slate-300 mt-1">
              คะแนนอันดับ: <span className="font-bold text-cyan-400">{userElo} ELO</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              สถิติการรบตลอดกาล
            </div>
            <div className="text-sm font-mono-nums font-bold text-emerald-400">
              {matchHistory.filter((m) => m.result === 'Victory').length} ชนะ -{' '}
              {matchHistory.filter((m) => m.result === 'Defeat').length} แพ้
            </div>
            <div className="text-[11px] text-slate-400">
              อัตราการชนะ:{' '}
              {matchHistory.length > 0
                ? Math.round(
                    (matchHistory.filter((m) => m.result === 'Victory').length /
                      matchHistory.length) *
                      100
                  )
                : 100}
              %
            </div>
          </div>
        </div>

        {/* Divisions Ladder List */}
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            เกณฑ์คะแนนดิวิชัน
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {RANK_TIERS.map((tier) => {
              const isCurrent = userRank.includes(tier.name) || tier.name.includes(userRank);
              return (
                <div
                  key={tier.name}
                  className={`p-2.5 rounded-lg border text-xs flex flex-col justify-between ${
                    isCurrent ? `${tier.bg} ring-1 ring-amber-400` : 'bg-slate-900/50 border-slate-800/80'
                  }`}
                >
                  <div className={`font-bold ${tier.color}`}>{tier.name}</div>
                  <div className="text-[10px] font-mono-nums text-slate-400 mt-1">
                    {tier.minElo}+ ELO
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Match History */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            ประวัติการปะทะล่าสุด
          </div>
          {matchHistory.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 italic">
              ยังไม่มีประวัติการปะทะจัดอันดับ เข้าร่วมสมรภูมิเพื่อสะสมคะแนนอันดับ!
            </div>
          ) : (
            <div className="space-y-1.5">
              {matchHistory.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-200">
                      ประจัญบานกับ {m.opponent}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {m.laneWinner} · {m.date}
                    </div>
                  </div>
                  <div className="text-right font-mono-nums">
                    <span
                      className={`font-bold text-xs ${
                        m.result === 'Victory' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {m.result === 'Victory' ? 'ชนะ' : 'แพ้'} ({m.eloDelta > 0 ? `+${m.eloDelta}` : m.eloDelta})
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
