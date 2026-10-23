import React from 'react';
import { X, Zap, Shield, Radio, Plane, Flag, Crosshair, Navigation, Swords } from 'lucide-react';

interface RulesModalProps {
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 select-none">
      <div className="rift-modal relative bg-slate-950 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <div>
            <h2 className="font-display font-bold text-lg text-slate-100">
              คู่มือยุทธวิธีสถาปนิก (Architect Tactical Field Manual)
            </h2>
            <div className="text-xs text-slate-400">
              กฎการรบแห่งสมรภูมิ RIFTBOUND: Frontline Nexus (ริฟต์บาวด์: แนวรบเน็กซัส)
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-900"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Rules Content */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs text-slate-300 leading-relaxed">
          {/* Section 1: Objective */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-rose-400" /> เป้าหมายหลัก (Primary Objective)
            </h3>
            <p>
              ผู้เล่นทั้งสองฝ่ายบัญชาการฐานเน็กซัสที่มีพลังชีวิต <strong className="text-slate-100">30 หน่วย</strong> จัดวางกำลังพลข้าม 3 เลน เดินทัพบุกทะลวงฐานทัพศัตรู และทำลายเน็กซัสของฝ่ายตรงข้ามให้เหลือ 0 เพื่อคว้าชัยชนะ
            </p>
          </div>

          {/* Section 2: Three Lanes & Battlefield Depth */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Navigation className="w-4 h-4 text-cyan-400" /> ตารางยุทธวิธี 3 เลน (Three-Lane Tactical Grid)
            </h3>
            <p>
              สมรภูมิประกอบด้วย 3 เลน (เลนซ้าย, เลนกลาง, เลนขวา) และมีความลึก 7 แถว:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-400">
              <li><strong className="text-slate-200">แถว 0:</strong> โซนฐานทัพฝ่ายตรงข้าม (Nexus ศัตรู)</li>
              <li><strong className="text-slate-200">แถว 1 และ 5:</strong> โซนแนวหลังสำหรับสิ่งปลูกสร้างป้องกันและฐานบินทัพอากาศ (Airbase)</li>
              <li><strong className="text-slate-200">แถว 3:</strong> แนวรบส่วนหน้าที่มีฐานยุทธศาสตร์ (Outpost) สำคัญ 3 แห่ง</li>
              <li><strong className="text-slate-200">แถว 6:</strong> โซนฐานทัพหลักของผู้เล่น (Nexus ของเรา)</li>
              <li>ยูนิตสามารถเดินหน้าหรือถอยร่นตามแนวเลน ยูนิตในแถวกลาง (แถว 2, 3, 4) หรือยูนิตที่มีความสามารถบิน สามารถเปลี่ยนข้ามเลนที่ติดกันได้</li>
            </ul>
          </div>

          {/* Section 3: Strategic Outposts */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Flag className="w-4 h-4 text-amber-400" /> ระบบยึดครองฐานยุทธศาสตร์ (Outpost Capture System)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="font-bold text-amber-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> ฐานส่งกำลังบำรุง
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  เลนซ้าย. ผลิตประจุไฟฟ้า +1 Charge ในทุกรอบแก่ผู้ควบคุม
                </div>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="font-bold text-sky-400 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5" /> ฐานป้อมปราการ
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  เลนกลาง. มอบออร่าเกราะป้องกัน +2 Defense แก่ยูนิตฝ่ายเราในเลนนี้
                </div>
              </div>

              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="font-bold text-purple-400 flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5" /> ฐานรีเลย์มิติ
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  เลนขวา. ผลิตพลังงานมิติริฟต์ +1 Rift Energy ทุกรอบ
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              วิธียึดครอง: สั่งยูนิตที่มีสัญลักษณ์ <strong className="text-slate-200">ยึดจุดยุทธศาสตร์</strong> เดินขึ้นบนช่องฐาน หากไม่มีศัตรูขัดขวาง ความคืบหน้าจะเต็ม 100% หากมีศัตรูอยู่ใกล้เคียง ฐานจะติดสถานะช่วงชิง (Contested) และระงับผลประโยชน์ชั่วคราว
            </p>
          </div>

          {/* Section 4: Airborne Deployment Scenario */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Plane className="w-4 h-4 text-amber-300" /> ฐานบินทัพอากาศและการทิ้งร่ม (Airborne Deployment)
            </h3>
            <p>
              การสร้าง <strong className="text-amber-300">ฐานบินทัพอากาศยุทธวิธี (Tactical Airbase)</strong> ที่แนวหลังจะปลดล็อกโปรโตคอลทิ้งร่ม ใช้พลังงาน 3 Charge + 1 Rift เพื่อส่งกองกำลัง <strong className="text-slate-100">พลร่มจู่โจมทางอากาศ</strong> ลงสู่ฐานยุทธศาสตร์หรือแนวหลังศัตรูได้โดยตรงเพื่อเข้าประจัญบานทันที!
            </p>
          </div>

          {/* Section 5: The Three Resources */}
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" /> เศรษฐกิจและทรัพยากรทั้ง 3 ประเภท (Resource Economy)
            </h3>
            <ul className="list-disc pl-4 space-y-1 text-slate-400">
              <li><strong className="text-amber-300">⚡ ประจุไฟฟ้า (Charge):</strong> ทรัพยากรหลักสำหรับจัดวางยูนิต สิ่งปลูกสร้าง และยุทธวิธี (+2 หน่วยต่อเทิร์น สะสมได้สูงสุด 10 หน่วย)</li>
              <li><strong className="text-purple-300">🌀 พลังริฟต์ (Rift):</strong> ทรัพยากรมิติจากฐานรีเลย์มิติและการ์ดอาร์เคน ใช้สำหรับสกิลข้ามจักรวาลและการทิ้งร่ม</li>
              <li><strong className="text-sky-300">🛡️ ความมุ่งมั่น (Resolve):</strong> พลังใจเชิงป้องกันสำหรับใช้ในปฏิกิริยาตอบโต้และคำสั่งผู้บัญชาการ</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
