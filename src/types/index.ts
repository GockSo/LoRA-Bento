export interface ProjectStats {
    total: number;
    augmented: number;
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
}

export interface AugmentationSettings {
    rotationRandom: boolean;
    rotationRange: [number, number]; // [min, max]
    flipRandom: boolean;
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
    aug?: {
        rotate: number;
        flip: boolean;
    };
    processed?: boolean;
}

export interface ProjectManifest {
    version: number;
    items: ManifestItem[];
}
