// WD Tagger Model Type Definitions

export type WDModel =
    | 'wd-v1-4-convnext-tagger-v2'
    | 'wd-v1-4-moat-tagger-v2'
    | 'wd-eva02-large-tagger-v3'
    | 'wd-v1-4-vit-tagger-v2';

export interface WDModelDefinition {
    key: WDModel;
    repo_id: string;
    label: string;
    files: string[];
    size_mb?: number;
}

export interface ModelInfo {
    key: WDModel;
    repo_id: string;
    label: string;
    installed: boolean;
    local_path?: string;
    size_mb?: number;
}

export interface ModelRegistry {
    models: Record<WDModel, ModelRegistryEntry>;
}

export interface ModelRegistryEntry {
    repo_id: string;
    installed: boolean;
    local_path: string;
    files: Record<string, { size: number; sha256?: string }>;
    installed_at: string;
}

// Download progress tracking
export interface DownloadProgress {
    status: 'starting' | 'downloading' | 'completed' | 'error';
    progress: number;  // 0-100
    downloaded_bytes: number;
    total_bytes: number;
    current_file: string;
    error: string | null;
}

export interface DownloadJob {
    job_id: string;
    repo_id: string;
    model_key: WDModel;
    status: 'starting' | 'downloading' | 'verifying' | 'done' | 'error';
    progress: DownloadProgress;
    created_at: string;
}

// Image type for tag editor
export interface CaptionImage {
    id: string;
    filename: string;
    url: string;
    tags: string[];
    has_caption: boolean;
    is_edited: boolean;
    mtime?: number; // For cache busting
}
