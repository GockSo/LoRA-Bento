// Caption-related type definitions for LoRA Bento

export type CaptionMode = 'tags' | 'caption' | 'hybrid';
export type TaggerModel = 'legacy' | 'convnext' | 'swinv2';
export type CaptionerModel = 'blip' | 'blip2' | 'florence2';
export type TagOrdering = 'confidence' | 'alphabetical' | 'model';
export type CaptionStyle = 'short' | 'medium' | 'detailed';
export type OutputFormat = 'tags' | 'sentence';
export type MergeFormat = 'trigger_tags_caption' | 'trigger_caption_tags' | 'tags_only';

export interface CaptionAdvancedSettings {
    // Tagger parameters
    tagThreshold: number;          // 0.10 - 0.90, default 0.35
    maxTags: number;               // default 40
    removeJunkTags: boolean;       // default true
    customBlacklist: string;       // comma or newline separated
    customWhitelist: string;       // optional
    normalizeTags: boolean;        // default true (lowercase, underscore)
    tagOrdering: TagOrdering;      // default 'confidence'

    // Captioner parameters
    captionStyle: CaptionStyle;    // default 'short'
    outputFormat: OutputFormat;    // default 'tags'
    avoidGenericPhrases: boolean;  // default true

    // Hybrid parameters
    mergeFormat: MergeFormat;      // default 'trigger_tags_caption'
    deduplicate: boolean;          // default true
    maxCaptionLength: number;      // default 220

    // Shared parameters
    keepFirstTokens: number;       // default 1 (preserve trigger)
    shuffleTags: boolean;          // default true
}

export interface CaptionConfig {
    mode: CaptionMode;
    taggerModel: TaggerModel;
    captionerModel: CaptionerModel;
    triggerWord: string;
    advanced: CaptionAdvancedSettings;
    lastRun?: string;              // ISO timestamp
}

// Default configuration
export const DEFAULT_CAPTION_CONFIG: CaptionConfig = {
    mode: 'tags',
    taggerModel: 'convnext',
    captionerModel: 'florence2',
    triggerWord: '',
    advanced: {
        // Tagger
        tagThreshold: 0.25,      // Lower threshold for more specific tags
        maxTags: 60,             // More tags for better variety
        removeJunkTags: true,
        customBlacklist: '',
        customWhitelist: '',
        normalizeTags: true,
        tagOrdering: 'confidence',

        // Captioner
        captionStyle: 'short',
        outputFormat: 'tags',
        avoidGenericPhrases: true,

        // Hybrid
        mergeFormat: 'trigger_tags_caption',
        deduplicate: true,
        maxCaptionLength: 220,

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
