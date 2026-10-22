import { DeckConfig } from '../types/game';

// Helper to create 50 cards respecting the max 4-copy rule
export const STARTER_DECKS: DeckConfig[] = [
  {
    id: 'deck-iron-arcane',
    name: 'Iron & Arcane Vanguard',
    partnerId: 'PARTNER-01',
    originId: 'ORIGIN-01',
    universes: ['iron-frontier', 'arcane-dominion'],
    cardIds: [
      // Units & Structures (32)
      'IF-01', 'IF-01', 'IF-01', 'IF-01', // 4x Frontline Riflemen
      'IF-02', 'IF-02', 'IF-02', // 3x Ironclad Walker
      'IF-03', 'IF-03', // 2x Siege Mortar
      'IF-04', 'IF-04', // 2x Tactical Airbase
      'IF-05', 'IF-05', 'IF-05', // 3x Paratroopers
      'IF-06', 'IF-06', // 2x Fortified Bunker
      'IF-07', 'IF-07', // 2x Combat Engineer
      'AD-01', 'AD-01', 'AD-01', 'AD-01', // 4x Mystic Spellblade
      'AD-02', 'AD-02', 'AD-02', // 3x Aether Magus
      'AD-03', 'AD-03', // 2x Arcane Obelisk
      'AD-05', 'AD-05', // 2x Barrier Golem
      'AD-06', 'AD-06', 'AD-06', // 3x Phoenix Pyre
      // Spells & Tactics (18)
      'IF-08', 'IF-08', // 2x Carpet Bombing
      'AD-04', 'AD-04', // 2x Blink
      'SPELL-HEAL', 'SPELL-HEAL', 'SPELL-HEAL', // 3x Healing Pulse
      'SPELL-BOLT', 'SPELL-BOLT', 'SPELL-BOLT', // 3x Arcane Bolt
      'SPELL-RIFT-GATE', 'SPELL-RIFT-GATE', // 2x Rift Gate
      'SPELL-METEOR', 'SPELL-METEOR', // 2x Meteor Field
      'SPELL-BATTLE-CRY', 'SPELL-BATTLE-CRY', // 2x Battle Cry
      'SPELL-FORTIFY', 'SPELL-FORTIFY', // 2x Fortify
    ],
  },
  {
    id: 'deck-cyber-mythic',
    name: 'Cyber-Mythic Syndicate',
    partnerId: 'PARTNER-03',
    originId: 'ORIGIN-03',
    universes: ['neo-genesis', 'mythic-wilds'],
    cardIds: [
      // Neo Genesis Units & Structures (17)
      'NG-01', 'NG-01', 'NG-01', 'NG-01', // 4
      'NG-02', 'NG-02', 'NG-02', // 7
      'NG-03', 'NG-03', // 9
      'NG-04', 'NG-04', 'NG-04', // 12
      'NG-05', 'NG-05', // 14
      'NG-06', 'NG-06', 'NG-06', // 17
      // Mythic Wilds Units (18)
      'MW-01', 'MW-01', // 19
      'MW-02', 'MW-02', 'MW-02', 'MW-02', // 23
      'MW-03', 'MW-03', 'MW-03', 'MW-03', // 27
      'MW-04', 'MW-04', 'MW-04', // 30
      'MW-05', 'MW-05', 'MW-05', // 33
      'MW-06', 'MW-06', 'MW-06', 'MW-06', // 37
      // Support & Relics (3)
      'REL-01', 'REL-01', 'DOM-01', // 40
      // Tactical Spells (10)
      'SPELL-NEXUS-SURGE', 'SPELL-NEXUS-SURGE', 'SPELL-NEXUS-SURGE', // 43
      'SPELL-OUTPOST-SABOTAGE', 'SPELL-OUTPOST-SABOTAGE', 'SPELL-OUTPOST-SABOTAGE', // 46
      'SPELL-HEAL', 'SPELL-HEAL', // 48
      'SPELL-BATTLE-CRY', 'SPELL-BATTLE-CRY', // 50
    ],
  },
  {
    id: 'deck-multiverse-conquest',
    name: 'Multiverse Frontline Nexus',
    partnerId: 'PARTNER-02',
    originId: 'ORIGIN-02',
    universes: ['iron-frontier', 'arcane-dominion', 'neo-genesis', 'mythic-wilds'],
    cardIds: [
      // Units & Structures (34)
      'IF-01', 'IF-01', 'IF-01', // 3
      'IF-04', 'IF-04', // 5 (Airbase)
      'IF-05', 'IF-05', 'IF-05', // 8 (Paratroopers)
      'AD-01', 'AD-01', 'AD-01', // 11
      'AD-02', 'AD-02', // 13
      'AD-03', 'AD-03', // 15
      'AD-05', 'AD-05', // 17
      'NG-01', 'NG-01', 'NG-01', // 20
      'NG-02', 'NG-02', // 22
      'NG-03', 'NG-03', // 24
      'NG-04', 'NG-04', // 26
      'MW-01', 'MW-01', // 28
      'MW-02', 'MW-02', // 30
      'MW-03', 'MW-03', // 32
      'REL-01', 'DOM-01', // 34
      // Complete Spell Arsenal (16)
      'SPELL-HEAL', 'SPELL-HEAL', // 36
      'SPELL-BOLT', 'SPELL-BOLT', // 38
      'SPELL-RIFT-GATE', 'SPELL-RIFT-GATE', // 40
      'SPELL-METEOR', 'SPELL-METEOR', // 42
      'SPELL-BATTLE-CRY', 'SPELL-BATTLE-CRY', // 44
      'SPELL-NEXUS-SURGE', 'SPELL-NEXUS-SURGE', // 46
      'SPELL-FORTIFY', 'SPELL-FORTIFY', // 48
      'SPELL-OUTPOST-SABOTAGE', 'SPELL-OUTPOST-SABOTAGE', // 50
    ],
  },
];
