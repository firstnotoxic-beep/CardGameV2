import React from 'react';
import { CardType, Universe } from '../types/game';

interface CardArtworkProps {
  cardId: string;
  name?: string;
  universe: Universe;
  cardType: CardType;
  rarity?: string;
  className?: string;
  mini?: boolean;
  artwork?: string;
}

export const CardArtwork: React.FC<CardArtworkProps> = ({
  cardId,
  name = '',
  universe,
  cardType,
  rarity = 'common',
  className = 'w-full h-full',
  mini = false,
  artwork,
}) => {
  // If a custom image URL is provided (e.g., uploaded to storage or preset image)
  if (artwork && (artwork.startsWith('http') || artwork.startsWith('/uploads') || artwork.startsWith('/src/assets') || artwork.startsWith('data:'))) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <img
          src={artwork}
          alt={name || cardId}
          className="w-full h-full object-cover"
          onError={(e) => {
            // fallback to hiding broken image so SVG fallback displays
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
      </div>
    );
  }

  // 1. SPECIFIC ARTWORK ILLUSTRATIONS BY CARD ID
  switch (cardId) {
    case 'IF-01': // Frontline Riflemen
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="sky-if01" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#292524" />
              <stop offset="60%" stopColor="#44403c" />
              <stop offset="100%" stopColor="#1c1917" />
            </linearGradient>
            <linearGradient id="mud" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#57534e" />
              <stop offset="100%" stopColor="#292524" />
            </linearGradient>
          </defs>
          <rect width="200" height="130" fill="url(#sky-if01)" />
          {/* Distant smokestacks & trench wire */}
          <rect x="25" y="40" width="8" height="50" fill="#1c1917" opacity="0.6" />
          <rect x="165" y="35" width="10" height="55" fill="#1c1917" opacity="0.6" />
          <path d="M0 85 Q 50 80 100 85 T 200 85 L 200 130 L 0 130 Z" fill="url(#mud)" />
          {/* Trench parapet & Sandbags */}
          <ellipse cx="60" cy="98" rx="28" ry="10" fill="#78716c" />
          <ellipse cx="140" cy="98" rx="28" ry="10" fill="#78716c" />
          <ellipse cx="100" cy="104" rx="32" ry="12" fill="#57534e" />
          {/* Soldier Silhouette with Helmet & Rifle */}
          <circle cx="100" cy="62" r="14" fill="#a8a29e" />
          <ellipse cx="100" cy="58" rx="18" ry="6" fill="#44403c" />
          {/* Gasmask lenses */}
          <circle cx="95" cy="64" r="3.5" fill="#0284c7" />
          <circle cx="105" cy="64" r="3.5" fill="#0284c7" />
          {/* Shoulders */}
          <path d="M80 82 Q 100 74 120 82 L 126 102 L 74 102 Z" fill="#292524" />
          {/* Bayonet Rifle pointing diagonally */}
          <line x1="75" y1="95" x2="135" y2="35" stroke="#78716c" strokeWidth="4" strokeLinecap="round" />
          <line x1="130" y1="40" x2="142" y2="28" stroke="#cbd5e1" strokeWidth="2.5" />
          <polygon points="142,28 147,23 144,30" fill="#f8fafc" />
        </svg>
      );

    case 'IF-02': // Ironclad Trench Walker
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bg-mech" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="steam-pipe" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#78350f" />
            </linearGradient>
          </defs>
          <rect width="200" height="130" fill="url(#bg-mech)" />
          {/* Ground */}
          <rect x="0" y="105" width="200" height="25" fill="#334155" />
          {/* Hydraulic Bipedal Legs */}
          <line x1="70" y1="80" x2="55" y2="115" stroke="#64748b" strokeWidth="8" strokeLinecap="round" />
          <line x1="130" y1="80" x2="145" y2="115" stroke="#64748b" strokeWidth="8" strokeLinecap="round" />
          <rect x="45" y="112" width="22" height="6" rx="2" fill="#475569" />
          <rect x="135" y="112" width="22" height="6" rx="2" fill="#475569" />
          {/* Heavy Armored Chassis */}
          <polygon points="65,40 135,40 145,85 55,85" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
          <polygon points="75,50 125,50 130,75 70,75" fill="#334155" />
          {/* Glowing Red Sensor Visor */}
          <rect x="80" y="58" width="40" height="7" rx="2" fill="#ef4444" filter="drop-shadow(0 0 4px #ef4444)" />
          {/* Steam Boiler Exhausts */}
          <rect x="58" y="24" width="7" height="20" fill="url(#steam-pipe)" />
          <rect x="135" y="24" width="7" height="20" fill="url(#steam-pipe)" />
          <circle cx="61" cy="20" r="5" fill="#94a3b8" opacity="0.4" />
          <circle cx="138" cy="20" r="6" fill="#94a3b8" opacity="0.4" />
          {/* Heavy Cannon Barrel */}
          <rect x="110" y="66" width="45" height="10" rx="1" fill="#1e293b" stroke="#cbd5e1" strokeWidth="1" />
        </svg>
      );

    case 'IF-03': // Siege Mortar Battery
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="130" fill="#1c1917" />
          <path d="M0 95 L200 95 L200 130 L0 130 Z" fill="#292524" />
          {/* Reinforced Base Plate & Sandbags */}
          <ellipse cx="100" cy="105" rx="55" ry="12" fill="#44403c" stroke="#78716c" strokeWidth="2" />
          {/* Heavy Mortar Tube angled at 65 degrees */}
          <g transform="rotate(-35 100 90)">
            <rect x="85" y="40" width="30" height="60" rx="3" fill="#57534e" stroke="#a8a29e" strokeWidth="2" />
            <ellipse cx="100" cy="40" rx="15" ry="6" fill="#0c0a09" stroke="#f59e0b" strokeWidth="2" />
          </g>
          {/* Recoil Hydraulic Pistons */}
          <line x1="75" y1="95" x2="88" y2="75" stroke="#f59e0b" strokeWidth="5" />
          <line x1="125" y1="95" x2="112" y2="75" stroke="#f59e0b" strokeWidth="5" />
          {/* Muzzle Blast & Smoke */}
          <circle cx="125" cy="35" r="16" fill="#f59e0b" opacity="0.8" />
          <circle cx="138" cy="25" r="10" fill="#fbbf24" opacity="0.9" />
          <circle cx="145" cy="18" r="6" fill="#ffffff" />
        </svg>
      );

    case 'IF-04': // Tactical Airbase
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bg-airbase" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>
          <rect width="200" height="130" fill="url(#bg-airbase)" />
          {/* Runway Strip with glowing lights */}
          <polygon points="10,130 80,65 120,65 190,130" fill="#334155" />
          <line x1="100" y1="70" x2="100" y2="130" stroke="#facc15" strokeWidth="2" strokeDasharray="6 6" />
          {/* Control Tower */}
          <rect x="25" y="35" width="22" height="65" fill="#475569" stroke="#94a3b8" />
          <polygon points="20,35 52,35 48,22 24,22" fill="#0284c7" opacity="0.8" />
          {/* Radar Dish */}
          <path d="M30 18 A 8 8 0 0 1 42 18" stroke="#38bdf8" strokeWidth="2.5" fill="none" />
          <line x1="36" y1="18" x2="36" y2="22" stroke="#38bdf8" strokeWidth="2" />
          {/* Fighter Plane ascending into night sky */}
          <g transform="translate(130, 30) scale(0.9)">
            <polygon points="20,0 28,18 20,16 12,18" fill="#e2e8f0" />
            <polygon points="0,12 40,12 28,16 12,16" fill="#94a3b8" />
            <circle cx="20" cy="18" r="3" fill="#f97316" />
          </g>
        </svg>
      );

    case 'IF-05': // Airborne Paratroopers
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="sky-para" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f172a" />
              <stop offset="50%" stopColor="#1e3a5f" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
          <rect width="200" height="130" fill="url(#sky-para)" />
          {/* Parachute Canopy Main */}
          <path d="M60 45 A 40 30 0 0 1 140 45 Z" fill="#f8fafc" stroke="#38bdf8" strokeWidth="2" />
          <path d="M85 45 A 15 28 0 0 1 115 45 Z" fill="#cbd5e1" />
          {/* Suspension Lines */}
          <line x1="62" y1="45" x2="100" y2="90" stroke="#94a3b8" strokeWidth="1" />
          <line x1="85" y1="45" x2="100" y2="90" stroke="#94a3b8" strokeWidth="1" />
          <line x1="115" y1="45" x2="100" y2="90" stroke="#94a3b8" strokeWidth="1" />
          <line x1="138" y1="45" x2="100" y2="90" stroke="#94a3b8" strokeWidth="1" />
          {/* Paratrooper Figure */}
          <circle cx="100" cy="94" r="5" fill="#f59e0b" />
          <rect x="96" y="99" width="8" height="14" rx="2" fill="#1e293b" />
          <line x1="96" y1="113" x2="93" y2="124" stroke="#0f172a" strokeWidth="2.5" />
          <line x1="104" y1="113" x2="107" y2="124" stroke="#0f172a" strokeWidth="2.5" />
          {/* Distant Smaller Parachutists */}
          <path d="M25 30 A 15 10 0 0 1 55 30 Z" fill="#e2e8f0" opacity="0.6" />
          <line x1="40" y1="30" x2="40" y2="48" stroke="#94a3b8" strokeWidth="0.8" />
          <circle cx="40" cy="50" r="2.5" fill="#0f172a" opacity="0.7" />
          <path d="M150 25 A 14 9 0 0 1 178 25 Z" fill="#e2e8f0" opacity="0.5" />
          <line x1="164" y1="25" x2="164" y2="42" stroke="#94a3b8" strokeWidth="0.8" />
          <circle cx="164" cy="44" r="2" fill="#0f172a" opacity="0.6" />
        </svg>
      );

    case 'IF-06': // Fortified Bunker
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="130" fill="#1e293b" />
          {/* Trench embankment */}
          <polygon points="0,110 200,110 200,130 0,130" fill="#0f172a" />
          {/* Reinforced Concrete Pillbox Structure */}
          <polygon points="30,110 45,55 155,55 170,110" fill="#475569" stroke="#94a3b8" strokeWidth="2" />
          {/* Heavy Roof Slab */}
          <rect x="35" y="45" width="130" height="14" rx="3" fill="#334155" stroke="#cbd5e1" strokeWidth="1.5" />
          {/* Firing Slit */}
          <rect x="65" y="70" width="70" height="10" rx="2" fill="#090d16" stroke="#f59e0b" strokeWidth="1" />
          {/* Heavy Machine Gun barrel sticking out */}
          <rect x="94" y="73" width="22" height="4" fill="#1e293b" />
          {/* Steel Barbed Wire */}
          <line x1="15" y1="108" x2="185" y2="108" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="4 3" />
        </svg>
      );

    case 'IF-07': // Combat Engineer
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="130" fill="#1c1917" />
          {/* Circuit/Blueprint grid background */}
          <line x1="30" y1="0" x2="30" y2="130" stroke="#44403c" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1="100" y1="0" x2="100" y2="130" stroke="#44403c" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1="170" y1="0" x2="170" y2="130" stroke="#44403c" strokeWidth="0.5" strokeDasharray="3 3" />
          {/* Engineer Figure */}
          <circle cx="100" cy="52" r="16" fill="#78716c" />
          {/* Industrial Hardhat & Welding Goggles */}
          <path d="M82 46 A 18 10 0 0 1 118 46 Z" fill="#eab308" />
          <ellipse cx="94" cy="54" rx="4" ry="3" fill="#38bdf8" />
          <ellipse cx="106" cy="54" rx="4" ry="3" fill="#38bdf8" />
          {/* Torso & Tool Belt */}
          <path d="M78 74 L122 74 L126 115 L74 115 Z" fill="#44403c" />
          <rect x="74" y="100" width="52" height="8" fill="#ca8a04" />
          {/* Giant Industrial Wrench */}
          <g transform="translate(130, 40) rotate(25)">
            <rect x="0" y="20" width="8" height="50" rx="2" fill="#94a3b8" />
            <circle cx="4" cy="18" r="12" fill="none" stroke="#94a3b8" strokeWidth="6" />
          </g>
          {/* Welder Sparks */}
          <polygon points="70,90 60,82 72,86 64,74 76,82" fill="#38bdf8" />
        </svg>
      );

    case 'IF-08': // Carpet Bombing
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="blast-if08" cx="50%" cy="80%" r="60%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="40%" stopColor="#f97316" />
              <stop offset="80%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#450a0a" />
            </radialGradient>
          </defs>
          <rect width="200" height="130" fill="url(#blast-if08)" />
          {/* Heavy Bomber silhouettes in formation */}
          <g transform="translate(75, 18) scale(0.9)" fill="#0f172a">
            <polygon points="30,0 35,22 30,20 25,22" />
            <polygon points="0,14 60,14 45,19 15,19" />
          </g>
          <g transform="translate(25, 28) scale(0.6)" fill="#0f172a" opacity="0.8">
            <polygon points="30,0 35,22 30,20 25,22" />
            <polygon points="0,14 60,14 45,19 15,19" />
          </g>
          <g transform="translate(135, 28) scale(0.6)" fill="#0f172a" opacity="0.8">
            <polygon points="30,0 35,22 30,20 25,22" />
            <polygon points="0,14 60,14 45,19 15,19" />
          </g>
          {/* Falling bombs */}
          <ellipse cx="85" cy="55" rx="3" ry="7" fill="#1e293b" transform="rotate(15 85 55)" />
          <ellipse cx="115" cy="50" rx="3" ry="7" fill="#1e293b" transform="rotate(-15 115 50)" />
          <ellipse cx="100" cy="65" rx="3" ry="7" fill="#1e293b" />
          {/* Ground Explosion Shockwave */}
          <ellipse cx="100" cy="118" rx="80" ry="18" fill="#fef08a" opacity="0.9" />
          <ellipse cx="100" cy="115" rx="55" ry="12" fill="#ffffff" />
        </svg>
      );

    case 'AD-01': // Mystic Spellblade
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bg-ad01" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1e1b4b" />
              <stop offset="100%" stopColor="#4c1d95" />
            </linearGradient>
            <linearGradient id="blade-glow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c084fc" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          <rect width="200" height="130" fill="url(#bg-ad01)" />
          {/* Arcane Rune Ring */}
          <circle cx="100" cy="65" r="45" fill="none" stroke="#a855f7" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.6" />
          {/* Glowing Enchanted Sword centered */}
          <g transform="translate(100, 65) rotate(-45)">
            <polygon points="0,-48 6,-38 4,32 -4,32 -6,-38" fill="url(#blade-glow)" filter="drop-shadow(0 0 8px #c084fc)" />
            <line x1="0" y1="-46" x2="0" y2="30" stroke="#fdf4ff" strokeWidth="1.5" />
            {/* Crossguard */}
            <rect x="-18" y="32" width="36" height="5" rx="2" fill="#e9d5ff" />
            {/* Pommel */}
            <circle cx="0" cy="48" r="4" fill="#a855f7" />
          </g>
          {/* Arcane Sparks & Swirls */}
          <circle cx="65" cy="40" r="3" fill="#e879f9" />
          <circle cx="140" cy="85" r="3.5" fill="#38bdf8" />
          <circle cx="150" cy="35" r="2" fill="#fdf4ff" />
        </svg>
      );

    case 'AD-02': // Aether Magus
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="130" fill="#0f0c29" />
          {/* Channeling Arcane Vortex */}
          <circle cx="100" cy="55" r="35" fill="none" stroke="#9333ea" strokeWidth="2" strokeDasharray="12 4" />
          <circle cx="100" cy="55" r="22" fill="#581c87" opacity="0.8" />
          <circle cx="100" cy="55" r="10" fill="#e9d5ff" filter="drop-shadow(0 0 10px #c084fc)" />
          {/* Hooded Mage Figure in Foreground */}
          <polygon points="100,42 75,120 125,120" fill="#3b0764" />
          {/* Glowing Eyes inside hood */}
          <ellipse cx="96" cy="50" rx="2" ry="1.5" fill="#38bdf8" />
          <ellipse cx="104" cy="50" rx="2" ry="1.5" fill="#38bdf8" />
          {/* Magic Staves / Runes */}
          <line x1="55" y1="20" x2="70" y2="120" stroke="#c084fc" strokeWidth="3" />
          <circle cx="55" cy="20" r="7" fill="#a855f7" stroke="#fdf4ff" strokeWidth="1.5" />
        </svg>
      );

    case 'AD-03': // Arcane Obelisk
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="crystal" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#a855f7" />
              <stop offset="50%" stopColor="#e9d5ff" />
              <stop offset="100%" stopColor="#7e22ce" />
            </linearGradient>
          </defs>
          <rect width="200" height="130" fill="#090514" />
          {/* Vertical Energy Beam */}
          <rect x="94" y="0" width="12" height="130" fill="#c084fc" opacity="0.3" filter="blur(4px)" />
          {/* Floating Monolith Spire */}
          <polygon points="100,15 118,85 100,105 82,85" fill="url(#crystal)" stroke="#fdf4ff" strokeWidth="1.5" />
          {/* Floating Base Rocks */}
          <polygon points="100,112 125,122 75,122" fill="#2e1065" stroke="#7e22ce" strokeWidth="1" />
          {/* Revolving Orbiting Glyphs */}
          <ellipse cx="100" cy="65" rx="42" ry="12" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="8 4" />
          <circle cx="140" cy="67" r="4" fill="#38bdf8" />
          <circle cx="60" cy="63" r="3" fill="#e879f9" />
        </svg>
      );

    case 'AD-04': // Dimensional Blink
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="130" fill="#030712" />
          {/* Origin and Destination Warp Rings */}
          <ellipse cx="50" cy="70" rx="30" ry="45" fill="none" stroke="#818cf8" strokeWidth="3" strokeDasharray="6 3" />
          <ellipse cx="150" cy="70" rx="30" ry="45" fill="none" stroke="#c084fc" strokeWidth="3" strokeDasharray="6 3" />
          {/* Particle Trail across spacetime */}
          <line x1="50" y1="70" x2="150" y2="70" stroke="#e0e7ff" strokeWidth="2" strokeDasharray="4 4" />
          {/* Dissolving Silhouette */}
          <circle cx="50" cy="60" r="12" fill="#4338ca" opacity="0.5" />
          <rect x="42" y="72" width="16" height="25" fill="#4338ca" opacity="0.4" />
          {/* Materializing Figure */}
          <circle cx="150" cy="60" r="12" fill="#9333ea" />
          <rect x="142" y="72" width="16" height="25" fill="#9333ea" />
          <circle cx="150" cy="60" r="16" fill="none" stroke="#fdf4ff" strokeWidth="1.5" />
        </svg>
      );

    case 'AD-05': // Barrier Golem
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="130" fill="#18181b" />
          {/* Stone Colossus Silhouette */}
          <polygon points="85,35 115,35 125,50 135,110 65,110 75,50" fill="#3f3f46" stroke="#71717a" strokeWidth="2" />
          {/* Glowing Rune Core in Chest */}
          <polygon points="100,55 112,70 100,85 88,70" fill="#38bdf8" filter="drop-shadow(0 0 8px #38bdf8)" />
          {/* Giant Hexagonal Aegis Barrier */}
          <polygon points="100,20 145,45 145,95 100,120 55,95 55,45" fill="#0284c7" opacity="0.35" stroke="#38bdf8" strokeWidth="2.5" />
        </svg>
      );

    // SPELLS & TACTICAL CARDS
    case 'SPELL-HEAL': // Healing Pulse
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="heal-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#064e3b" />
            </radialGradient>
          </defs>
          <rect width="200" height="130" fill="#022c22" />
          {/* Concentric Radiating Pulse Waves */}
          <circle cx="100" cy="65" r="55" fill="none" stroke="#34d399" strokeWidth="1.5" opacity="0.3" />
          <circle cx="100" cy="65" r="42" fill="none" stroke="#10b981" strokeWidth="2" opacity="0.6" />
          <circle cx="100" cy="65" r="28" fill="url(#heal-glow)" filter="drop-shadow(0 0 14px #34d399)" />
          {/* Prominent Medical Cross */}
          <rect x="94" y="45" width="12" height="40" rx="3" fill="#ffffff" />
          <rect x="80" y="59" width="40" height="12" rx="3" fill="#ffffff" />
          {/* Sparkles */}
          <circle cx="65" cy="35" r="3" fill="#a7f3d0" />
          <circle cx="135" cy="40" r="3.5" fill="#a7f3d0" />
          <circle cx="70" cy="95" r="2.5" fill="#a7f3d0" />
          <circle cx="130" cy="95" r="3" fill="#a7f3d0" />
        </svg>
      );

    case 'SPELL-BOLT': // Arcane Bolt
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="bolt-grad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#f43f5e" />
            </linearGradient>
          </defs>
          <rect width="200" height="130" fill="#1e1035" />
          {/* Piercing Bolt Spear */}
          <polygon points="175,25 60,85 75,95 185,35" fill="url(#bolt-grad)" filter="drop-shadow(0 0 10px #e879f9)" />
          <polygon points="185,20 195,15 170,30" fill="#ffffff" />
          {/* Lightning Arcs */}
          <polyline points="20,110 55,90 45,75 85,60 75,45 125,30 115,20 185,15" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
          {/* Impact Target Reticle */}
          <circle cx="185" cy="25" r="14" fill="none" stroke="#fb7185" strokeWidth="2" strokeDasharray="5 3" />
        </svg>
      );

    case 'SPELL-RIFT-GATE': // Rift Gate
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="vortex-core" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="25%" stopColor="#38bdf8" />
              <stop offset="65%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#090514" />
            </radialGradient>
          </defs>
          <rect width="200" height="130" fill="#090514" />
          {/* Dimensional Swirling Rings */}
          <ellipse cx="100" cy="65" rx="55" ry="38" fill="url(#vortex-core)" />
          <ellipse cx="100" cy="65" rx="65" ry="46" fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="10 6" />
          <ellipse cx="100" cy="65" rx="42" ry="26" fill="none" stroke="#38bdf8" strokeWidth="2.5" />
          {/* Void creature emerging silhouette */}
          <polygon points="100,45 108,60 115,55 106,75 94,75 85,55 92,60" fill="#0f172a" stroke="#c084fc" strokeWidth="1.5" />
        </svg>
      );

    case 'SPELL-METEOR': // Meteor Field
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="meteor-tail" x1="1" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="60%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="transparent" />
            </linearGradient>
          </defs>
          <rect width="200" height="130" fill="#180c06" />
          {/* Tectonic Crater Grid */}
          <ellipse cx="100" cy="100" rx="70" ry="20" fill="#431407" stroke="#ea580c" strokeWidth="1.5" />
          {/* Primary Falling Meteor */}
          <polygon points="140,15 55,95 65,100 155,20" fill="url(#meteor-tail)" />
          <circle cx="60" cy="95" r="14" fill="#fb923c" filter="drop-shadow(0 0 10px #f97316)" />
          <circle cx="60" cy="95" r="8" fill="#ffffff" />
          {/* Secondary smaller meteorites */}
          <polygon points="180,30 120,85 125,88 185,32" fill="url(#meteor-tail)" opacity="0.8" />
          <circle cx="122" cy="86" r="6" fill="#f97316" />
        </svg>
      );

    case 'SPELL-BATTLE-CRY': // Battle Cry
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="horn-gold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>
          <rect width="200" height="130" fill="#1e1b18" />
          {/* Sonic Shockwaves */}
          <path d="M125 35 A 40 40 0 0 1 125 95" stroke="#f59e0b" strokeWidth="4" fill="none" opacity="0.8" />
          <path d="M145 25 A 55 55 0 0 1 145 105" stroke="#f59e0b" strokeWidth="3" fill="none" opacity="0.6" />
          <path d="M165 15 A 70 70 0 0 1 165 115" stroke="#fbbf24" strokeWidth="2" fill="none" opacity="0.4" />
          {/* Warhorn of Valor */}
          <path d="M40 85 Q 75 75 110 50 L 115 80 Q 75 90 40 85 Z" fill="url(#horn-gold)" stroke="#78350f" strokeWidth="2" />
          <ellipse cx="112" cy="65" rx="8" ry="16" fill="#78350f" />
        </svg>
      );

    case 'SPELL-NEXUS-SURGE': // Nexus Surge
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="nexus-burst" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="30%" stopColor="#38bdf8" />
              <stop offset="70%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#082f49" />
            </radialGradient>
          </defs>
          <rect width="200" height="130" fill="#082f49" />
          {/* Grid lines */}
          <line x1="0" y1="65" x2="200" y2="65" stroke="#0284c7" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="100" y1="0" x2="100" y2="130" stroke="#0284c7" strokeWidth="1" strokeDasharray="4 4" />
          {/* Central Burst */}
          <circle cx="100" cy="65" r="32" fill="url(#nexus-burst)" filter="drop-shadow(0 0 16px #38bdf8)" />
          {/* Radiant Diamonds */}
          <polygon points="100,20 115,65 100,110 85,65" fill="#f0f9ff" opacity="0.9" />
          <polygon points="55,65 100,50 145,65 100,80" fill="#f0f9ff" opacity="0.9" />
        </svg>
      );

    case 'SPELL-FORTIFY': // Fortify
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="130" fill="#111827" />
          {/* Fortress Castle Bastion */}
          <polygon points="60,115 60,65 75,65 75,55 85,55 85,65 115,65 115,55 125,55 125,65 140,65 140,115" fill="#374151" stroke="#9ca3af" strokeWidth="2" />
          {/* Radiant Energy Golden Shield */}
          <polygon points="100,25 150,45 140,95 100,115 60,95 50,45" fill="#eab308" opacity="0.3" stroke="#facc15" strokeWidth="3" filter="drop-shadow(0 0 10px #facc15)" />
          {/* Center Aegis emblem */}
          <polygon points="100,45 125,58 120,85 100,98 80,85 75,58" fill="#ca8a04" stroke="#fef08a" strokeWidth="1.5" />
        </svg>
      );

    case 'SPELL-OUTPOST-SABOTAGE': // Outpost Sabotage
      return (
        <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
          <rect width="200" height="130" fill="#180505" />
          {/* Communications Tower */}
          <line x1="80" y1="120" x2="100" y2="40" stroke="#64748b" strokeWidth="3" />
          <line x1="120" y1="120" x2="100" y2="40" stroke="#64748b" strokeWidth="3" />
          <line x1="85" y1="80" x2="115" y2="80" stroke="#64748b" strokeWidth="2" />
          {/* Red Electronic Glitch / Crosshair */}
          <circle cx="100" cy="50" r="32" fill="none" stroke="#ef4444" strokeWidth="2" strokeDasharray="8 4" />
          <line x1="100" y1="12" x2="100" y2="88" stroke="#ef4444" strokeWidth="1.5" />
          <line x1="62" y1="50" x2="138" y2="50" stroke="#ef4444" strokeWidth="1.5" />
          {/* Sparks & Detonation */}
          <polygon points="100,40 105,48 115,44 108,52 118,58 106,60 104,70 98,62 88,65 94,54 86,48 96,48" fill="#facc15" filter="drop-shadow(0 0 6px #f97316)" />
        </svg>
      );

    default:
      break;
  }

  // 2. PROCEDURAL HIGH-FIDELITY THEMATIC FALLBACK
  // Ensures NO card ever has an empty black rectangle or broken icon!
  const isUnit = cardType === 'unit';
  const isStructure = cardType === 'structure';
  const isTactic = cardType === 'tactic';
  const isRelic = cardType === 'relic';

  const themeColors = {
    'iron-frontier': {
      bg: '#292524',
      accent: '#f59e0b',
      border: '#78716c',
      pattern: '⚙',
    },
    'arcane-dominion': {
      bg: '#1e1b4b',
      accent: '#c084fc',
      border: '#818cf8',
      pattern: '✦',
    },
    'neo-genesis': {
      bg: '#022c22',
      accent: '#06b6d4',
      border: '#10b981',
      pattern: '⌬',
    },
    'mythic-wilds': {
      bg: '#14532d',
      accent: '#84cc16',
      border: '#22c55e',
      pattern: '🌿',
    },
    'creators-circle': {
      bg: '#3b0764',
      accent: '#ec4899',
      border: '#f43f5e',
      pattern: '★',
    },
  }[universe] || {
    bg: '#1e293b',
    accent: '#38bdf8',
    border: '#64748b',
    pattern: '◆',
  };

  return (
    <svg viewBox="0 0 200 130" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`grad-${cardId}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={themeColors.bg} />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="200" height="130" fill={`url(#grad-${cardId})`} />
      
      {/* Decorative Frame */}
      <rect x="8" y="8" width="184" height="114" rx="6" fill="none" stroke={themeColors.border} strokeWidth="1.5" opacity="0.4" />
      <circle cx="100" cy="65" r="42" fill="none" stroke={themeColors.accent} strokeWidth="1" strokeDasharray="6 4" opacity="0.5" />

      {/* Center Themed Iconography based on Card Type */}
      {isUnit ? (
        <g transform="translate(100, 65)">
          <circle cx="0" cy="-14" r="14" fill={themeColors.accent} opacity="0.8" />
          <path d="M-18 16 Q 0 4 18 16 L 22 36 L -22 36 Z" fill={themeColors.border} />
          <line x1="-28" y1="20" x2="-28" y2="-25" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
          <polygon points="-32,-25 -28,-35 -24,-25" fill="#f8fafc" />
        </g>
      ) : isStructure ? (
        <g transform="translate(100, 65)">
          <polygon points="-35,30 -25,-15 25,-15 35,30" fill={themeColors.border} stroke={themeColors.accent} strokeWidth="2" />
          <rect x="-15" y="-30" width="30" height="18" fill={themeColors.accent} opacity="0.8" />
          <circle cx="0" cy="8" r="8" fill="#0f172a" />
        </g>
      ) : isTactic ? (
        <g transform="translate(100, 65)">
          <circle cx="0" cy="0" r="26" fill={themeColors.accent} opacity="0.3" filter="drop-shadow(0 0 10px)" />
          <polygon points="0,-25 8,-8 25,0 8,8 0,25 -8,8 -25,0 -8,-8" fill="#ffffff" />
        </g>
      ) : isRelic ? (
        <g transform="translate(100, 65)">
          <polygon points="0,-25 22,-8 14,24 -14,24 -22,-8" fill={themeColors.accent} stroke="#f8fafc" strokeWidth="2" />
          <circle cx="0" cy="0" r="7" fill="#ffffff" />
        </g>
      ) : (
        <g transform="translate(100, 65)">
          <circle cx="0" cy="0" r="20" fill={themeColors.accent} opacity="0.7" />
          <circle cx="0" cy="0" r="30" fill="none" stroke="#f8fafc" strokeWidth="2" strokeDasharray="4 4" />
        </g>
      )}

      {/* Card Type Signature & Universe Motif */}
      <text x="100" y="112" textAnchor="middle" fill="#94a3b8" fontSize="10" fontFamily="sans-serif" letterSpacing="1">
        {cardType.toUpperCase()}
      </text>
    </svg>
  );
};
