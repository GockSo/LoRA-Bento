import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { updateProject, getProject } from '@/lib/projects';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const project = await getProject(id);

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const rawDir = path.join(projectDir, 'raw');
        const skipCropDir = path.join(projectDir, 'skip_crop');

        // 1. Create skip_crop directory
        await fs.mkdir(skipCropDir, { recursive: true });

        // 2. Copy all raw images
        const rawFiles = await fs.readdir(rawDir);
        let copiedCount = 0;

        for (const file of rawFiles) {
            // Filter for images only
            if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
                const srcPath = path.join(rawDir, file);
                const destPath = path.join(skipCropDir, file);

                // Copy file
                await fs.copyFile(srcPath, destPath);
                copiedCount++;
            }
        }

        // 3. Update Project Config
        await updateProject(id, {
            crop: {
                mode: 'skip'
            }
        });

        return NextResponse.json({
            success: true,
            count: copiedCount,
            mode: 'skip'
        });

    } catch (error) {
        console.error('Enable skip crop error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
