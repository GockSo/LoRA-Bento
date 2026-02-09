import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject } from '@/lib/projects';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const projectDir = path.join(process.cwd(), 'projects', id);
    const rawDir = path.join(projectDir, 'raw');
    const croppedDir = path.join(projectDir, 'cropped');
    const skipCropDir = path.join(projectDir, 'skip_crop');

    try {
        // Get project config to check skip crop mode
        const project = await getProject(id);

        // List all raw images
        const rawFiles = await fs.readdir(rawDir);
        const imageFiles = rawFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

        const inputs = await Promise.all(imageFiles.map(async (imageId) => {
            let sourceType: 'crop' | 'skip_crop' | 'raw' = 'raw';
            let sourceLabel: 'CROP' | 'SKIP CROP' | 'RAW' = 'RAW';
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
                            sourceLabel = 'CROP';
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
            if (sourceType === 'raw' && project?.crop?.mode === 'skip') {
                const skipCropPath = path.join(skipCropDir, imageId);
                try {
                    await fs.access(skipCropPath);
                    sourceType = 'skip_crop';
                    sourceLabel = 'SKIP CROP';
                    sourceFile = imageId;
                    sourcePath = skipCropPath;
                } catch {
                    // Skip crop file doesn't exist, use raw
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

            const sourceUrl = `/api/images?path=${encodeURIComponent(sourcePath)}&v=${mtime}`;
            const thumbUrl = sourceUrl; // Could use a dedicated thumb endpoint in future

            return {
                imageId,
                sourceType,
                sourceLabel,
                sourceFile,
                sourceUrl,
                thumbUrl,
            };
        }));

        return NextResponse.json({ inputs });
    } catch (error) {
        console.error('Failed to get augment inputs:', error);
        return NextResponse.json({ error: 'Failed to get inputs' }, { status: 500 });
    }
}
