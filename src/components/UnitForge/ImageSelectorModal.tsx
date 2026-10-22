import React, { useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Sparkles, X, Check, Crop, Layers, AlertCircle, RefreshCw, Wand2 } from 'lucide-react';
import { dbService } from '../../services/db';
import { Universe } from '../../types/game';

interface ImageSelectorModalProps {
  currentImageUrl?: string;
  defaultUniverse?: Universe;
  onSelectImage: (url: string) => void;
  onClose: () => void;
}

const TACTICAL_PRESETS = [
  {
    name: 'จักรกลไอน้ำดีเซลพังค์ (Iron Frontier)',
    url: '/src/assets/images/battlefield_arena_texture_1792637672663.jpg',
    category: 'iron-frontier',
  },
  {
    name: 'ฐานบินทัพอากาศ (Airbase Outpost)',
    url: '/src/assets/images/airbase_deployment_art_1792637673708.jpg',
    category: 'iron-frontier',
  },
  {
    name: 'ผู้บัญชาการพหุภพ (Nexus Commander)',
    url: '/src/assets/images/nexus_partner_commander_1792637674166.jpg',
    category: 'neo-genesis',
  },
  {
    name: 'ใจกลางมิติเน็กซัส (Rift Nexus)',
    url: '/src/assets/images/riftbound_nexus_title_1792637672325.jpg',
    category: 'arcane-dominion',
  },
];

export const ImageSelectorModal: React.FC<ImageSelectorModalProps> = ({
  currentImageUrl,
  defaultUniverse = 'creators-circle',
  onSelectImage,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'ai-generate' | 'upload' | 'presets' | 'vault'>('ai-generate');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // AI Generation State
  const [aiPrompt, setAiPrompt] = useState<string>('');
  const [aiUniverse, setAiUniverse] = useState<Universe>(defaultUniverse);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [generatedArtUrl, setGeneratedArtUrl] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // File Upload State
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [panY, setPanY] = useState<number>(50); // percentage 0 to 100
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Saved Assets from Database
  const savedAssets = dbService.getAssets();

  // AI Art Generation Handler
  const handleGenerateArtwork = async () => {
    if (!aiPrompt.trim()) {
      setAiError('โปรดป้อนคำอธิบายภาพ เช่น: ทหารปืนกลไอน้ำ สวมหน้ากากกันแก๊ส ยืนในหมอกควัน');
      return;
    }

    setIsGeneratingAi(true);
    setAiError(null);
    setGeneratedArtUrl(null);

    try {
      const res = await fetch('/api/art/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          universe: aiUniverse,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'การเชื่อมต่อระบบสร้างภาพ AI ล้มเหลว');
      }

      setGeneratedArtUrl(data.url);
      setSelectedPreset(data.url);

      // Save asset record to DB
      dbService.saveAsset({
        url: data.url,
        filename: `AI: ${aiPrompt.slice(0, 25)}...`,
        mimeType: data.mimeType || 'image/png',
        sizeBytes: 150000,
      });
    } catch (err: any) {
      console.error('AI Art Error:', err);
      setAiError(err.message || 'ไม่สามารถสร้างภาพได้ กรุณาลองใหม่อีกครั้ง หรือใช้วิธีอัปโหลดภาพแทน');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    // Validate MIME type
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validMimes.includes(file.type)) {
      setUploadError('กรุณาเลือกไฟล์ภาพประเภท JPG, PNG หรือ WebP เท่านั้น');
      return;
    }

    // Validate File Size (Max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('ขนาดไฟล์ภาพต้องไม่เกิน 5 MB');
      return;
    }

    setFileToUpload(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadAndConfirm = async () => {
    if (!fileToUpload) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('artwork', fileToUpload);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'การอัปโหลดไฟล์ล้มเหลว');
      }

      const data = await res.json();
      const uploadedUrl = data.url;

      // Save asset metadata into DB
      dbService.saveAsset({
        url: uploadedUrl,
        filename: data.filename || fileToUpload.name,
        mimeType: data.mimeType || fileToUpload.type,
        sizeBytes: data.sizeBytes || fileToUpload.size,
      });

      onSelectImage(uploadedUrl);
      onClose();
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'ไม่สามารถอัปโหลดไฟล์รูปภาพได้');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/40">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 font-display">
                สตูดิโอภาพประกอบการ์ด (Artwork Studio)
              </h2>
              <p className="text-xs text-slate-400">
                สร้างภาพประกอบด้วย AI, อัปโหลดภาพของตนเอง หรือเลือกจากคลังภาพยุทธวิธี
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800/80 bg-slate-900/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ai-generate')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
              activeTab === 'ai-generate'
                ? 'border-purple-400 text-purple-300 bg-purple-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wand2 className="w-3.5 h-3.5 text-purple-400" /> สร้างภาพด้วย AI (Gemini)
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
              activeTab === 'upload'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> อัปโหลดไฟล์ภาพ
          </button>
          <button
            onClick={() => setActiveTab('presets')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
              activeTab === 'presets'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> ภาพคลังสนามรบ
          </button>
          <button
            onClick={() => setActiveTab('vault')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg transition border-b-2 whitespace-nowrap ${
              activeTab === 'vault'
                ? 'border-cyan-400 text-cyan-400 bg-cyan-950/30'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> คลังส่วนตัว ({savedAssets.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: AI ARTWORK GENERATION */}
          {activeTab === 'ai-generate' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-400" /> อธิบายภาพที่ต้องการสร้าง (AI Prompt):
                  </span>
                  <span className="text-[10px] text-slate-400">อัตราส่วน 4:3 สำหรับการ์ด</span>
                </div>

                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="เช่น: หุ่นยนต์รบดีเซลพังค์ เกราะเหล็กหนา ยืนท่ามกลางควันไฟในสนามเพลาะ ปืนใหญ่คู่ติดไหล่ แสงเงาดุดัน..."
                  className="w-full rounded-xl bg-slate-950 border border-slate-700 p-3 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-purple-400"
                />

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-slate-400 shrink-0">สไตล์จักรวาล:</span>
                    <select
                      value={aiUniverse}
                      onChange={(e) => setAiUniverse(e.target.value as Universe)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                    >
                      <option value="iron-frontier">Iron Frontier (ดีเซลพังค์ สนิม โลหะ)</option>
                      <option value="arcane-dominion">Arcane Dominion (อาร์เคน มนตรา มิติริฟต์)</option>
                      <option value="neo-genesis">Neo-Genesis (ไซเบอร์ เลเซอร์ บาเรีย)</option>
                      <option value="mythic-wilds">Mythic Wilds (สัตว์อสูร พงไพรโบราณ)</option>
                      <option value="creators-circle">Creator's Circle (มิติสรรค์สร้าง)</option>
                    </select>
                  </div>

                  <button
                    disabled={isGeneratingAi}
                    onClick={handleGenerateArtwork}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/40 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isGeneratingAi ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> กำลังสร้างภาพด้วย AI...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3.5 h-3.5" /> สั่ง AI สร้างภาพประกอบ
                      </>
                    )}
                  </button>
                </div>
              </div>

              {aiError && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {/* Preview of AI generated art */}
              {generatedArtUrl && (
                <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/50 space-y-3">
                  <div className="flex items-center justify-between text-xs text-cyan-300 font-bold">
                    <span>ตัวอย่างภาพที่สร้างขึ้นสำเร็จ:</span>
                    <span className="text-[10px] text-slate-400">บันทึกลง Object Storage เรียบร้อยแล้ว</span>
                  </div>
                  <div className="w-full h-56 rounded-lg overflow-hidden border border-slate-800 relative bg-slate-900">
                    <img src={generatedArtUrl} alt="AI Generated Artwork" className="w-full h-full object-cover" />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FILE UPLOAD */}
          {activeTab === 'upload' && (
            <div className="space-y-4">
              {!previewDataUrl ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl p-8 text-center cursor-pointer transition bg-slate-950/40 hover:bg-cyan-950/10 flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-14 h-14 rounded-full bg-slate-800/80 text-cyan-400 flex items-center justify-center border border-slate-700">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-slate-200 block">
                      คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่
                    </span>
                    <span className="text-xs text-slate-400 block mt-1">
                      รองรับ JPG, PNG, WebP (สูงสุด 5 MB) ระบบจะจัดเก็บใน Storage เซิร์ฟเวอร์
                    </span>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Framing / Crop Preview */}
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="w-52 h-40 rounded-xl border-2 border-cyan-500/70 overflow-hidden relative bg-slate-950 shadow-xl shrink-0">
                      <div
                        className="w-full h-full relative"
                        style={{
                          transform: `scale(${zoom})`,
                          transformOrigin: `50% ${panY}%`,
                        }}
                      >
                        <img
                          src={previewDataUrl}
                          alt="Crop preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute inset-0 pointer-events-none border border-cyan-400/40 rounded-xl" />
                      <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-mono text-cyan-300">
                        ตัวอย่างการ์ด
                      </div>
                    </div>

                    {/* Crop / Zoom Controls */}
                    <div className="flex-1 w-full space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                          <span className="flex items-center gap-1">
                            <Crop className="w-3.5 h-3.5 text-cyan-400" /> ตำแหน่งแนวตั้ง (Vertical Pan)
                          </span>
                          <span className="font-mono text-cyan-400">{panY}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={panY}
                          onChange={(e) => setPanY(Number(e.target.value))}
                          className="w-full accent-cyan-400"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-300 mb-1">
                          <span>ซูมขยาย (Zoom Scale)</span>
                          <span className="font-mono text-cyan-400">{zoom.toFixed(1)}x</span>
                        </div>
                        <input
                          type="range"
                          min="1"
                          max="2"
                          step="0.1"
                          value={zoom}
                          onChange={(e) => setZoom(Number(e.target.value))}
                          className="w-full accent-cyan-400"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <button
                          onClick={() => {
                            setFileToUpload(null);
                            setPreviewDataUrl(null);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                        >
                          เปลี่ยนไฟล์ใหม่
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PRESETS */}
          {activeTab === 'presets' && (
            <div className="grid grid-cols-2 gap-3">
              {TACTICAL_PRESETS.map((preset) => (
                <div
                  key={preset.url}
                  onClick={() => setSelectedPreset(preset.url)}
                  className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col gap-2 ${
                    selectedPreset === preset.url
                      ? 'border-cyan-400 bg-cyan-950/40 ring-2 ring-cyan-500/50'
                      : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                  }`}
                >
                  <div className="w-full h-24 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 relative">
                    <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                    {selectedPreset === preset.url && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-200 line-clamp-1">{preset.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: ASSET VAULT */}
          {activeTab === 'vault' && (
            <div>
              {savedAssets.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  ยังไม่มีรูปภาพที่อัปโหลดหรือสร้างไว้ในคลังส่วนตัว
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {savedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedPreset(asset.url)}
                      className={`p-2 rounded-xl border cursor-pointer transition ${
                        selectedPreset === asset.url
                          ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400'
                          : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                      }`}
                    >
                      <div className="w-full h-20 rounded overflow-hidden bg-slate-900 relative">
                        <img src={asset.url} alt={asset.filename} className="w-full h-full object-cover" />
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-1">{asset.filename}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <button
            onClick={() => {
              onSelectImage('');
              onClose();
            }}
            className="text-xs text-slate-400 hover:text-slate-200 transition"
          >
            ใช้รูปภาพกราฟิกเริ่มต้น
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            >
              ยกเลิก
            </button>

            {activeTab === 'upload' && previewDataUrl ? (
              <button
                disabled={!fileToUpload || isUploading}
                onClick={handleUploadAndConfirm}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> กำลังอัปโหลด...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" /> บันทึกและใช้รูปนี้
                  </>
                )}
              </button>
            ) : (
              <button
                disabled={!selectedPreset}
                onClick={() => {
                  if (selectedPreset) {
                    onSelectImage(selectedPreset);
                    onClose();
                  }
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
              >
                <Check className="w-4 h-4" /> ยืนยันใช้รูปภาพนี้
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
