import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject, updateProject } from '@/lib/projects';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const projectDir = path.join(process.cwd(), 'projects', id);
        const resizedDir = path.join(projectDir, 'resized');
        const trainDataDir = path.join(projectDir, 'train_data');

        // 1. Validate resized directory exists and has images
        try {
            await fs.access(resizedDir);
        } catch {
            return NextResponse.json(
                { error: 'No resized images found. Please complete Step 4 (Resize & Pad) first.' },
                { status: 400 }
            );
        }

        const resizedFiles = await fs.readdir(resizedDir);
        const imageFiles = resizedFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

        if (imageFiles.length === 0) {
            return NextResponse.json(
                { error: 'No images found in resized directory. Please add images first.' },
                { status: 400 }
            );
        }

        // 2. Clean and recreate train_data directory
        await fs.rm(trainDataDir, { recursive: true, force: true });
        await fs.mkdir(trainDataDir, { recursive: true });

        // 3. Copy all images from resized to train_data
        let imagesCopied = 0;
        for (const imageFile of imageFiles) {
            const sourcePath = path.join(resizedDir, imageFile);
            const targetPath = path.join(trainDataDir, imageFile);

            try {
                await fs.copyFile(sourcePath, targetPath);
                imagesCopied++;
            } catch (err) {
                console.error(`Failed to copy ${imageFile}:`, err);
            }
        }

        if (imagesCopied === 0) {
            return NextResponse.json(
                { error: 'Failed to copy images. Please try again.' },
                { status: 500 }
            );
        }

        // 4. Update project config with skip metadata
        const project = await getProject(id);
        if (project) {
            await updateProject(id, {
                settings: {
                    ...project.settings,
                    caption: {
                        mode: 'skipped',
                        preparedAt: new Date().toISOString()
                    }
                }
            });
        }

        // 5. Return success response
        return NextResponse.json({
            ok: true,
            imagesCopied,
            trainDataDir: 'train_data'
        });

    } catch (error) {
        console.error('Skip caption error:', error);
        return NextResponse.json(
            { error: 'Internal server error. Please try again.' },
            { status: 500 }
        );
    }
}
