import path from 'path';
import fs from 'fs/promises';
import { getProject } from './projects';

export interface AugmentInputSource {
    sourceType: 'crop' | 'skip_crop' | 'raw';
    absPath: string;
    relPath: string;
    mtime: number;
    sourceFile?: string;
}

/**
 * Resolves the effective input source for augmentation for a given image.
 * 
 * Resolution priority:
 * 1. Check for active crop variant
 * 2. Check for skip_crop file (if skip mode enabled)
 * 3. Fall back to raw image
 * 
 * This function serves as the single source of truth for determining
 * which file should be used as input for augmentation.
 */
export async function resolveAugmentInput(
    projectId: string,
    imageId: string
): Promise<AugmentInputSource> {
    const projectDir = path.join(process.cwd(), 'projects', projectId);
    const rawDir = path.join(projectDir, 'raw');
    const croppedDir = path.join(projectDir, 'cropped');
    const skipCropDir = path.join(projectDir, 'skip_crop');

    // Default to raw
    let sourceType: 'crop' | 'skip_crop' | 'raw' = 'raw';
    let sourceFile = imageId;
    let sourcePath = path.join(rawDir, imageId);

    // Priority 1: Check for active crop
    const croppedImageDir = path.join(croppedDir, imageId);
    try {
        await fs.access(croppedImageDir);
        const metaPath = path.join(croppedImageDir, 'meta.json');
        try {
            const metaContent = await fs.readFile(metaPath, 'utf-8');
            const meta = JSON.parse(metaContent);
            if (meta.activeCrop) {
                const activeCropPath = path.join(croppedImageDir, meta.activeCrop);
                try {
                    await fs.access(activeCropPath);
                    sourceType = 'crop';
                    sourceFile = meta.activeCrop;
                    sourcePath = activeCropPath;
                } catch {
                    // Active crop file missing, fall through
                }
            }
        } catch {
            // meta.json missing or invalid, fall through
        }
    } catch {
        // Cropped directory doesn't exist, fall through
    }

    // Priority 2: Check for skip crop (if not already using crop)
    if (sourceType === 'raw') {
        const project = await getProject(projectId);
        if (project?.crop?.mode === 'skip') {
            const skipCropPath = path.join(skipCropDir, imageId);
            try {
                await fs.access(skipCropPath);
                sourceType = 'skip_crop';
                sourceFile = imageId;
                sourcePath = skipCropPath;
            } catch {
                // Skip crop file doesn't exist, use raw
            }
        }
    }

    // Get mtime for cache busting
    let mtime = Date.now();
    try {
        const stat = await fs.stat(sourcePath);
        mtime = stat.mtime.getTime();
    } catch {
        // Use current time if stat fails
    }

    // Calculate relative path from project directory
    const relPath = path.relative(projectDir, sourcePath);

    return {
        sourceType,
        absPath: sourcePath,
        relPath,
        mtime,
        sourceFile: sourceFile !== imageId ? sourceFile : undefined,
    };
}
