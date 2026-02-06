export interface Project {
    id: string;
    name: string;
    createdAt: string; // ISO date
    updatedAt: string; // ISO date
    stats: {
        raw: number;
        augmented: number;
        processed: number;
        captions: number;
    };
    settings: ProjectSettings;
}

export interface ProjectSettings {
    targetSize: number; // 512, 768, etc.
    padMode: 'transparent' | 'solid' | 'blur';
    padColor?: string; // Hex code if solid
    captionModel?: 'wd14' | 'blip';
    triggerWord?: string;
}

export interface ImageFile {
    name: string;
    path: string;
    url: string; // Public accessible URL (via API)
    width: number;
    height: number;
    size: number;
}
