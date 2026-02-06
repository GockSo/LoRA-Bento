import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { augmentImage, getRandomAugmentationParams } from '@/lib/images';
import { updateProjectStats, updateProject } from '@/lib/projects';
import { v4 as uuidv4 } from 'uuid';
import { AugmentationSettings } from '@/types';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const settings = body.settings as AugmentationSettings;
        // settings: { rotationRandom, rotationRange, flipRandom }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const rawDir = path.join(projectDir, 'raw');
        const augDir = path.join(projectDir, 'augmented');
        const jobsDir = path.join(projectDir, 'jobs');

        // Ensure directories exist
        await fs.mkdir(augDir, { recursive: true });
        await fs.mkdir(jobsDir, { recursive: true });

        // Save settings to project
        await updateProject(id, { settings: { augmentation: settings } as any });

        const files = await fs.readdir(rawDir);
        const imageFiles = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

        if (imageFiles.length === 0) {
            return NextResponse.json({ error: 'No images to augment' }, { status: 400 });
        }

        // Create Job
        const jobId = uuidv4();
        const jobPath = path.join(jobsDir, `${jobId}.json`);

        const initialJobState = {
            id: jobId,
            status: 'running',
            progress: { processed: 0, total: imageFiles.length },
            results: [] // { file: '...', angle: 0, flipped: false }
        };

        await fs.writeFile(jobPath, JSON.stringify(initialJobState, null, 2));

        // Start background processing
        (async () => {
            console.log(`Starting augmentation job ${jobId} for project ${id}`);
            const results: any[] = [];

            // Clean old augmented files? For now, we append/overwrite locally but maybe user wants fresh start.
            // User requirement: "Prefer previewing newly generated augmented images".
            // Let's clear old files for clean slate as per "one-click confirm" implied freshness.
            // Actually, keep it simple. Overwrite if name conflicts, otherwise add.

            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                try {
                    const inputPath = path.join(rawDir, file);
                    // Generate unique output name to avoid caching issues or confusion?
                    // Or keep same name for simplicity but risk browser cache?
                    // Let's use `aug_<filename>`
                    const outputName = `aug_${file}`;
                    const outputPath = path.join(augDir, outputName);

                    const params = getRandomAugmentationParams(settings);
                    // params: { rotate, flipH }

                    await augmentImage(inputPath, outputPath, params); // augmentImage takes { rotate, flipH } which matches

                    const result = {
                        file: outputName,
                        url: `/api/images?path=${encodeURIComponent(outputPath)}`,
                        angle: params.rotate,
                        flipped: params.flipH
                    };
                    results.push(result);

                    // Update job progress every few items or every item?
                    // Every item is better for UI feedback on small batch.
                    const currentState = {
                        id: jobId,
                        status: 'running',
                        progress: { processed: i + 1, total: imageFiles.length },
                        results: results
                    };
                    await fs.writeFile(jobPath, JSON.stringify(currentState, null, 2));

                } catch (e) {
                    console.error(`Failed to augment ${file}`, e);
                    // Add error result?
                    results.push({
                        file: file,
                        error: 'Failed to process'
                    });
                }
            }

            // Final update
            const finalState = {
                id: jobId,
                status: 'completed',
                progress: { processed: imageFiles.length, total: imageFiles.length },
                results: results
            };
            await fs.writeFile(jobPath, JSON.stringify(finalState, null, 2));

            await updateProjectStats(id);
            console.log(`Finished augmentation job ${jobId}`);
        })();

        return NextResponse.json({ jobId });

    } catch (error) {
        console.error('Augment error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
