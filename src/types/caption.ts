// Caption-related type definitions for LoRA Bento (WD Tagger Only)

import { WDModel } from './wd-models';

export type TagOrdering = 'confidence' | 'alphabetical' | 'model';

export interface CaptionAdvancedSettings {
    // WD Tagger parameters
    tagThreshold: number;          // 0.10 - 0.90, default 0.35
    maxTags: number;               // default 60
    excludeTags: string;           // Renamed from customBlacklist, comma-separated
    normalizeTags: boolean;        // default true (lowercase, underscore)
    tagOrdering: TagOrdering;      // default 'confidence'

    // Shared parameters
    keepFirstTokens: number;       // default 1 (preserve trigger)
    shuffleTags: boolean;          // default true
}

export interface CaptionConfig {
    wdModel: WDModel;              // Full WD model key
    triggerWord: string;
    advanced: CaptionAdvancedSettings;
    lastRun?: string;              // ISO timestamp
}

// Default configuration
export const DEFAULT_CAPTION_CONFIG: CaptionConfig = {
    wdModel: 'wd-v1-4-convnext-tagger-v2',
    triggerWord: '',
    advanced: {
        // WD Tagger
        tagThreshold: 0.35,
        maxTags: 60,
        excludeTags: '',
        normalizeTags: true,
        tagOrdering: 'confidence',

        // Shared
        keepFirstTokens: 1,
        shuffleTags: true
    }
};

// Preview result type
export interface CaptionPreviewResult {
    image: string;
    imageUrl: string;
    caption: string;
}

