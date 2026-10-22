import { Universe, CardType, Rarity, CardCost, CardAbility, CardTargetRule } from './game';

export type ContentType = 'unit' | 'spell' | 'tactic' | 'structure' | 'relic';

export type VisibilityMode = 'private' | 'public';

export type PublicationStatus = 'draft' | 'published' | 'archived';

export interface ArtworkMetadata {
  url: string;
  source: 'upload' | 'ai-generated' | 'preset' | 'svg-default';
  storagePath?: string;
  dimensions?: { width: number; height: number };
  prompt?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: string;
}

export interface CreatorContentRecord {
  // Provenance & Identity
  id: string;
  ownerId: string;
  ownerDisplayName: string;
  contentType: ContentType;
  name: string;
  description: string;
  universe: Universe;
  rarity: Rarity;
  cost: CardCost;

  // Combat Stats (for units and structures)
  stats?: {
    attack?: number;
    health?: number;
    defense?: number;
    move?: number;
    range?: number;
    canCapture?: boolean;
  };

  // Tactical Rules & Abilities
  abilities: CardAbility[];
  targetRule?: CardTargetRule;
  keywords: string[];
  flavorText?: string;

  // Artwork & Media
  artwork?: ArtworkMetadata;

  // Visibility & Publishing Status
  visibility: VisibilityMode;
  publicationStatus: PublicationStatus;

  // Schema & Version Tracking
  schemaVersion: '1.0';
  contentVersion: number;
  createdAt: string;
  updatedAt: string;

  // Provenance / Remixing Metadata
  originalContentId?: string;
  forkedFromVersion?: number;
  forkedFromAuthor?: string;
  remixCount?: number;
  reportCount?: number;
}

export interface ContentReportRecord {
  id: string;
  contentId: string;
  reporterId: string;
  reason: 'inappropriate' | 'copyright' | 'unsupported_mechanics' | 'other';
  notes: string;
  timestamp: string;
}
