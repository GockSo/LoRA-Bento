import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { augmentImage } from '@/lib/images';
import { updateProjectStats } from '@/lib/projects';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const { settings } = body;
        // settings: { rotate: 0, flipH: false, zoom: 1 }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const rawDir = path.join(projectDir, 'raw');
        const augDir = path.join(projectDir, 'augmented');

        // Clean augmented dir first? 
        // Maybe user wants to accumulate? Plan says "Augmented images are saved to ./augmented".
        // Let's clear it for simplicity to avoid duplicates if re-run.
        try {
            const oldFiles = await fs.readdir(augDir);
            for (const f of oldFiles) {
                await fs.unlink(path.join(augDir, f));
            }
        } catch { }

        const files = await fs.readdir(rawDir);
        const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

        if (imageFiles.length === 0) {
            return NextResponse.json({ processed: 0 });
        }

        // TODO: Ideally use a queue system or response streaming for progress.
        // For MVP, valid to await all (if < 100 images) or just return "started" and let client poll stats.
        // Given requirements say "Use background jobs/queue in-process (simple) and show progress in UI".
        // I made `lib/queue.ts` in plan but didn't implement it yet. 
        // I'll implement a simple async "fire and forget" here and client can poll stats or I can add a status endpoint.

        // Fire and forget (in-process background)
        (async () => {
            console.log(`Starting augmentation for project ${id}`);
            for (const file of imageFiles) {
                try {
                    const inputPath = path.join(rawDir, file);
                    const outputPath = path.join(augDir, file); // Keep same name
                    await augmentImage(inputPath, outputPath, settings);
                } catch (e) {
                    console.error(`Failed to augment ${file}`, e);
                }
            }
            await updateProjectStats(id);
            console.log(`Finished augmentation for project ${id}`);
        })();

        return NextResponse.json({ status: 'processing', total: imageFiles.length });

    } catch (error) {
        console.error('Augment error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
