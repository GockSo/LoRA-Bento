export interface ProjectStats {
    total: number;
    augmented: number;
    cropped: number;
    processed: number;
    captions: number;
}

export interface Project {
    id: string;
    name: string;
    createdAt: string; // ISO date
    updatedAt: string; // ISO date
    stats: ProjectStats;
    settings: ProjectSettings;
    excludedRaw?: string[]; // Array of raw filenames to exclude
    crop?: {
        mode: 'normal' | 'skip';
    };
}

export interface AugmentationSettings {
    rotationRandom: boolean;
    rotationRange: [number, number]; // [min, max]
    flipEnabled: boolean;
    // Legacy/Base support
    zoom?: number;
}

export interface ProjectSettings {
    targetSize: number; // 512, 768, etc.
    padMode: 'transparent' | 'solid' | 'blur';
    padColor: string; // Hex code if solid
    captionModel?: 'wd14' | 'blip';
    triggerWord?: string;
    augmentation?: AugmentationSettings;
    train?: {
        mode: 'local' | 'platform';
        // Persisted training settings
        modelPath?: string;
        modelFamily?: string;
        trainerScriptPath?: string;
    };
}

export interface ImageFile {
    name: string;
    path: string;
    url: string; // Public accessible URL (via API)
    width: number;
    height: number;
    size: number;
}

export interface ManifestItem {
    id: string; // uuid
    stage: 'raw' | 'augmented';
    src: string; // URL /api/images...
    path: string; // Absolute path
    displayName: string;
    groupKey: string; // raw filename
    originalName?: string;
    groupId?: number;
    hash?: string;
    blurScore?: number;
    flags?: {
        isDuplicate?: boolean;
        isBlurry?: boolean;
    };
    excluded?: boolean;
    aug?: {
        rotate: number;
        flip: boolean;
        inputSourceType?: 'crop' | 'skip_crop' | 'raw';
        inputFile?: string;
    };
    processed?: boolean;
}

export interface ProjectManifest {
    version: number;
    items: ManifestItem[];
}
