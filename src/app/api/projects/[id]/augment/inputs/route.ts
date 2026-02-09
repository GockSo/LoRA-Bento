import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { resolveAugmentInput } from '@/lib/augment-resolver';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const projectDir = path.join(process.cwd(), 'projects', id);
    const rawDir = path.join(projectDir, 'raw');

    try {
        // List all raw images
        const rawFiles = await fs.readdir(rawDir);
        const imageFiles = rawFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

        const inputs = await Promise.all(imageFiles.map(async (imageId) => {
            // Use shared resolver to determine source
            const { sourceType, absPath, mtime, sourceFile } = await resolveAugmentInput(id, imageId);

            const sourceLabel: 'CROP' | 'SKIP CROP' | 'RAW' =
                sourceType === 'crop' ? 'CROP' :
                    sourceType === 'skip_crop' ? 'SKIP CROP' : 'RAW';

            const sourceUrl = `/api/images?path=${encodeURIComponent(absPath)}&v=${mtime}`;
            const thumbUrl = sourceUrl; // Could use a dedicated thumb endpoint in future

            return {
                imageId,
                sourceType,
                sourceLabel,
                sourceFile: sourceFile || imageId,
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

