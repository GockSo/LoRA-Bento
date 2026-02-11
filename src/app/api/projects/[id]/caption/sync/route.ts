import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject } from '@/lib/projects';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const project = await getProject(id);

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const resizedDir = path.join(projectDir, 'resized');
        const trainDataDir = path.join(projectDir, 'train_data');

        // Check source directory
        try {
            await fs.access(resizedDir);
        } catch {
            return NextResponse.json({ error: 'Resized directory not found' }, { status: 404 });
        }

        // Determine target directory
        // Use existing dir if any, else create new one
        await fs.mkdir(trainDataDir, { recursive: true });

        let targetSubDirName = '';
        const entries = await fs.readdir(trainDataDir, { withFileTypes: true });
        const existingDirs = entries.filter(e => e.isDirectory());

        if (existingDirs.length > 0) {
            targetSubDirName = existingDirs[0].name;
        } else {
            // Create new: 10_triggerWord or 10_class
            const repeats = 10; // Default
            const trigger = project.settings.triggerWord || 'class';
            // Sanitize trigger word for folder name
            const safeTrigger = trigger.replace(/[^a-zA-Z0-9_-]/g, '');
            targetSubDirName = `${repeats}_${safeTrigger}`;
        }

        const targetDir = path.join(trainDataDir, targetSubDirName);
        await fs.mkdir(targetDir, { recursive: true });

        // Copy images
        const files = await fs.readdir(resizedDir);
        const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
        let copiedCount = 0;

        for (const file of images) {
            const srcPath = path.join(resizedDir, file);
            const destPath = path.join(targetDir, file);

            // Check if destination exists
            try {
                await fs.access(destPath);
                // Skip if exists - explicit check to avoid overwriting manually edited files/captions
            } catch {
                // Copy if missing
                await fs.copyFile(srcPath, destPath);
                copiedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            copied: copiedCount,
            targetDir: targetSubDirName
        });

    } catch (error) {
        console.error('Sync failed:', error);
        return NextResponse.json(
            { error: 'Sync failed' },
            { status: 500 }
        );
    }
}
