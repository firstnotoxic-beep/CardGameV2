import React from 'react';
import { CardDefinition, CardAbility } from '../types/game';
import { UNIVERSE_CONFIG } from '../data/cards';
import { Shield, Swords, Heart, Navigation, Crosshair, Flag, Target, Sparkles, Building, Layers } from 'lucide-react';
import { CardArtwork } from './CardArtwork';

interface CardViewProps {
  card: CardDefinition;
  variant?: 'hand' | 'detail' | 'compact' | 'creator';
  isSelected?: boolean;
  canAfford?: boolean;
  onClick?: () => void;
}

export const CardView: React.FC<CardViewProps> = ({
  card,
  variant = 'detail',
  isSelected = false,
  canAfford = true,
  onClick,
}) => {
  const uni = UNIVERSE_CONFIG[card.universe] || UNIVERSE_CONFIG['iron-frontier'];

  const getTargetBadge = () => {
    if (!card.targetRule) {
      if (card.cardType === 'unit' || card.cardType === 'structure') return '🎯 วางช่องว่าง';
      return '⚡ ไร้เป้าหมาย';
    }
    switch (card.targetRule.mode) {
      case 'friendly-unit':
        return '🎯 ยูนิตเรา';
      case 'enemy-unit':
        return '🎯 ยูนิตศัตรู';
      case 'any-unit':
        return '🎯 ยูนิตใดๆ';
      case 'empty-cell':
        return '🎯 ช่องว่าง';
      case 'friendly-structure':
        return '🎯 สิ่งปลูกสร้างเรา';
      case 'enemy-structure':
        return '🎯 สิ่งปลูกสร้างศัตรู';
      case 'outpost':
        return '🎯 จุดยุทธศาสตร์';
      case 'cell-area':
        return '🎯 พื้นที่ระเบิด';
      case 'lane':
        return '🎯 ทั้งเลน';
      case 'global':
      case 'no-target':
      default:
        return '⚡ ร่ายทันที';
    }
  };

  // Border styling by card type
  const getTypeBorder = () => {
    switch (card.cardType) {
      case 'unit':
        return 'border-cyan-500/60 shadow-cyan-950/30';
      case 'spell':
      case 'tactic':
        return 'border-purple-500/60 shadow-purple-950/30';
      case 'structure':
        return 'border-amber-500/60 shadow-amber-950/30';
      case 'relic':
        return 'border-emerald-500/60 shadow-emerald-950/30';
      case 'domain':
        return 'border-teal-500/60 shadow-teal-950/30';
      default:
        return 'border-slate-700/80';
    }
  };

  // Compact variant for deck lists
  if (variant === 'compact') {
    return (
      <div
        onClick={onClick}
        data-universe={card.universe}
        className={`rift-card-compact flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border transition-all cursor-pointer select-none ${
          isSelected ? 'border-cyan-400 ring-1 ring-cyan-400' : 'border-slate-800 hover:border-slate-600'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded overflow-hidden bg-slate-950 shrink-0 border border-slate-800">
            <CardArtwork cardId={card.id} universe={card.universe} cardType={card.cardType} artwork={card.artwork} mini />
          </div>
          <div className="truncate">
            <div className="text-xs font-bold text-slate-200 truncate">{card.name}</div>
            <div className="text-[10px] text-slate-400 capitalize flex items-center gap-1">
              <span>{card.cardType}</span>
              <span className="text-slate-600">·</span>
              <span className="text-amber-400 font-mono-nums">{card.cost.charge}⚡</span>
              {card.cost.rift ? <span className="text-purple-400 font-mono-nums">{card.cost.rift}🌀</span> : null}
            </div>
          </div>
        </div>
        <div className="text-[10px] text-slate-400 font-mono-nums shrink-0 ml-2">
          {getTargetBadge()}
        </div>
      </div>
    );
  }

  // Hand card representation (tactical card in hand dock)
  if (variant === 'hand') {
    return (
      <button
        onClick={onClick}
        type="button"
        data-universe={card.universe}
        className={`rift-card-hand group relative flex flex-col justify-between w-32 h-46 rounded-xl p-2 text-left transition-all duration-200 select-none border shrink-0 overflow-hidden ${
          isSelected
            ? 'scale-105 -translate-y-3 shadow-xl shadow-cyan-500/30 border-cyan-400 bg-slate-900 ring-2 ring-cyan-400'
            : canAfford
            ? `hover:-translate-y-2 hover:shadow-lg bg-slate-900/95 ${getTypeBorder()}`
            : 'opacity-50 cursor-not-allowed bg-slate-950/90 border-slate-800'
        }`}
      >
        {/* Top: Universe & Cost Badges */}
        <div className="flex items-center justify-between w-full z-10">
          <span className={`text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 ${uni.accentText}`}>
            {card.universe.split('-')[0]}
          </span>
          <div className="flex items-center gap-1 font-mono-nums text-xs font-bold">
            <span className="flex items-center justify-center w-5 h-5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {card.cost.charge}
            </span>
            {card.cost.rift && card.cost.rift > 0 ? (
              <span className="flex items-center justify-center w-5 h-5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                {card.cost.rift}
              </span>
            ) : null}
          </div>
        </div>

        {/* Card Artwork Thumbnail */}
        <div className="w-full h-16 rounded-md overflow-hidden bg-slate-950 border border-slate-800/80 my-1 relative">
          <CardArtwork
            cardId={card.id}
            universe={card.universe}
            cardType={card.cardType}
            rarity={card.rarity}
            artwork={card.artwork}
            className="w-full h-full object-cover"
          />
          {/* Subtle targeting badge overlay */}
          <div className="absolute bottom-0 inset-x-0 bg-slate-950/85 backdrop-blur-xs px-1 py-0.5 text-[8px] text-slate-300 flex items-center justify-between">
            <span className="truncate">{getTargetBadge()}</span>
            <span className="capitalize font-mono text-[7px] text-slate-400">{card.cardType}</span>
          </div>
        </div>

        {/* Center: Title */}
        <div className="z-10">
          <div className="text-[11px] font-bold text-slate-100 line-clamp-1 leading-tight">
            {card.name.split(' (')[0]}
          </div>
        </div>

        {/* Bottom Stats for Units vs Spells */}
        {card.cardType === 'unit' ? (
          <div className="flex items-center justify-between text-[11px] font-mono-nums pt-1 border-t border-slate-800 text-slate-300 z-10">
            <span className="flex items-center gap-0.5 text-rose-400 font-bold" title="โจมตี">
              <Swords className="w-2.5 h-2.5" /> {card.attack}
            </span>
            <span className="flex items-center gap-0.5 text-emerald-400 font-bold" title="พลังชีวิต">
              <Heart className="w-2.5 h-2.5" /> {card.health}
            </span>
            <span className="flex items-center gap-0.5 text-sky-400 font-bold" title="เกราะ">
              <Shield className="w-2.5 h-2.5" /> {card.defense}
            </span>
          </div>
        ) : card.cardType === 'structure' ? (
          <div className="flex items-center justify-between text-[10px] font-mono-nums pt-1 border-t border-slate-800 text-amber-300 z-10">
            <span className="flex items-center gap-1">
              <Building className="w-2.5 h-2.5" /> {card.health} HP
            </span>
            <span className="text-[9px] uppercase font-bold text-amber-400">ป้อม</span>
          </div>
        ) : (
          <div className="text-[9px] text-purple-300 truncate border-t border-slate-800 pt-1 z-10 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-purple-400 shrink-0" />
            <span className="truncate">{card.abilities?.[0]?.name || card.flavor || 'เวทมนตร์ยุทธวิธี'}</span>
          </div>
        )}
      </button>
    );
  }

  // Full detailed card (Inspector & Deck Builder)
  return (
    <div
      onClick={onClick}
      data-universe={card.universe}
      className={`rift-card-detail relative flex flex-col justify-between w-68 h-96 rounded-xl p-3.5 text-left transition-all duration-200 select-none border bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 shadow-2xl ${
        isSelected ? 'border-cyan-400 ring-2 ring-cyan-500/50' : getTypeBorder()
      } ${card.isCustom ? 'ring-1 ring-pink-500/40' : ''}`}
    >
      {/* Header: Name, Universe, Cost */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div>
            <h3 className="font-display font-bold text-sm tracking-wide text-slate-100 leading-snug">
              {card.name}
            </h3>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
              <span className={`font-semibold ${uni.accentText}`}>{uni.name}</span>
              <span aria-hidden="true">·</span>
              <span className="capitalize font-mono text-[10px] px-1 rounded bg-slate-800/80 text-slate-300">
                {card.cardType}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 font-mono-nums shrink-0">
            <div className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold text-xs" title="Charge Cost">
              ⚡ {card.cost.charge}
            </div>
            {card.cost.rift ? (
              <div className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold text-xs" title="Rift Energy Cost">
                🌀 {card.cost.rift}
              </div>
            ) : null}
            {card.cost.resolve ? (
              <div className="flex items-center gap-0.5 px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold text-xs" title="Resolve Cost">
                🛡️ {card.cost.resolve}
              </div>
            ) : null}
          </div>
        </div>

        {/* Card Artwork Canvas */}
        <div className="w-full h-28 rounded-lg bg-slate-950 border border-slate-800 relative overflow-hidden my-2 shadow-inner">
          <CardArtwork
            cardId={card.id}
            universe={card.universe}
            cardType={card.cardType}
            rarity={card.rarity}
            artwork={card.artwork}
            className="w-full h-full object-cover"
          />
          {/* Card Badges Overlay */}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-950/80 text-cyan-300 border border-cyan-800/40">
              {getTargetBadge()}
            </span>
            {card.canCapture ? (
              <span className="inline-flex items-center gap-0.5 text-[9px] uppercase font-bold text-amber-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-amber-800/40">
                <Flag className="w-2.5 h-2.5 text-amber-400" /> ยึดฐาน
              </span>
            ) : null}
          </div>
        </div>

        {/* Targeting Rule / Play Instruction if available */}
        {card.targetRule?.promptText ? (
          <div className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-950/30 px-2 py-1 rounded border border-amber-800/40 mb-1.5">
            <Target className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="leading-tight">{card.targetRule.promptText}</span>
          </div>
        ) : null}

        {/* Abilities & Effect Box */}
        <div className="space-y-1 text-xs text-slate-300 bg-slate-950/50 rounded-lg p-2 border border-slate-800/80 max-h-22 overflow-y-auto">
          {card.abilities && card.abilities.length > 0 ? (
            card.abilities.map((ab: CardAbility) => (
              <div key={ab.id} className="leading-relaxed">
                <span className="font-bold text-cyan-300">{ab.name}: </span>
                <span className="text-slate-300">{ab.description}</span>
              </div>
            ))
          ) : (
            <div className="text-slate-400 italic leading-relaxed text-[11px]">
              {card.flavor || 'การจัดวางกำลังและต่อสู้ตามมาตรฐานแนวรบ'}
            </div>
          )}
        </div>
      </div>

      {/* Unit Tactical Stats Strip */}
      {card.cardType === 'unit' ? (
        <div className="grid grid-cols-5 gap-1 pt-2 border-t border-slate-800 text-center font-mono-nums text-xs">
          <div className="flex flex-col items-center p-1 rounded bg-rose-950/30 border border-rose-900/40">
            <span className="text-[9px] text-rose-400 font-sans flex items-center gap-0.5">
              <Swords className="w-2.5 h-2.5" /> โจมตี
            </span>
            <span className="font-bold text-rose-300 text-sm">{card.attack}</span>
          </div>

          <div className="flex flex-col items-center p-1 rounded bg-emerald-950/30 border border-emerald-900/40">
            <span className="text-[9px] text-emerald-400 font-sans flex items-center gap-0.5">
              <Heart className="w-2.5 h-2.5" /> เลือด
            </span>
            <span className="font-bold text-emerald-300 text-sm">{card.health}</span>
          </div>

          <div className="flex flex-col items-center p-1 rounded bg-sky-950/30 border border-sky-900/40">
            <span className="text-[9px] text-sky-400 font-sans flex items-center gap-0.5">
              <Shield className="w-2.5 h-2.5" /> เกราะ
            </span>
            <span className="font-bold text-sky-300 text-sm">{card.defense}</span>
          </div>

          <div className="flex flex-col items-center p-1 rounded bg-amber-950/30 border border-amber-900/40">
            <span className="text-[9px] text-amber-400 font-sans flex items-center gap-0.5">
              <Navigation className="w-2.5 h-2.5" /> เคลื่อน
            </span>
            <span className="font-bold text-amber-300 text-sm">{card.move}</span>
          </div>

          <div className="flex flex-col items-center p-1 rounded bg-indigo-950/30 border border-indigo-900/40">
            <span className="text-[9px] text-indigo-400 font-sans flex items-center gap-0.5">
              <Crosshair className="w-2.5 h-2.5" /> ระยะ
            </span>
            <span className="font-bold text-indigo-300 text-sm">{card.range}</span>
          </div>
        </div>
      ) : card.cardType === 'structure' ? (
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs font-mono-nums">
          <span className="text-emerald-400 flex items-center gap-1">
            <Heart className="w-3.5 h-3.5" /> เลือด: {card.health}
          </span>
          <span className="text-sky-400 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5" /> เกราะ: {card.defense}
          </span>
          <span className="text-amber-400 font-bold uppercase text-[10px]">
            สิ่งปลูกสร้าง
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
          <span className="uppercase text-[10px] tracking-wider font-semibold text-purple-400 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> {card.cardType === 'tactic' ? 'ยุทธวิธี (Tactic)' : card.cardType === 'spell' ? 'เวทมนตร์ (Spell)' : card.cardType}
          </span>
          <span className="text-[10px] font-mono-nums capitalize text-slate-500">
            {card.rarity}
          </span>
        </div>
      )}
    </div>
  );
};

