import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { augmentImage, getRandomAugmentationParams } from '@/lib/images';
import { updateProjectStats, updateProject } from '@/lib/projects';
import { addToManifest, getManifest } from '@/lib/manifest';
import { v4 as uuidv4 } from 'uuid';
import { AugmentationSettings, ManifestItem } from '@/types';

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

        // Get Manifest to find Raw items
        const manifest = await getManifest(id);
        const rawItems = manifest.items.filter(i => i.stage === 'raw');

        if (rawItems.length === 0) {
            return NextResponse.json({ error: 'No raw images to augment' }, { status: 400 });
        }

        // Create Job
        const jobId = uuidv4();
        const jobPath = path.join(jobsDir, `${jobId}.json`);

        const initialJobState = {
            id: jobId,
            status: 'running',
            progress: { processed: 0, total: rawItems.length },
            results: [] // Ephemeral results for live UI feedback
        };

        await fs.writeFile(jobPath, JSON.stringify(initialJobState, null, 2));

        // Start background processing
        (async () => {
            console.log(`Starting augmentation job ${jobId} for project ${id}`);
            const results: any[] = [];
            const newManifestItems: ManifestItem[] = [];

            // Clean old augmented files? For now, we append/overwrite locally but maybe user wants fresh start.
            // User requirement: "Prefer previewing newly generated augmented images".
            // Let's clear old files for clean slate as per "one-click confirm" implied freshness.
            // Actually, keep it simple. Overwrite if name conflicts, otherwise add.

            for (let i = 0; i < rawItems.length; i++) {
                const item = rawItems[i];
                try {
                    // item.path is absolute path to raw file
                    const fileBaseName = path.basename(item.path);
                    const outputName = `aug_${fileBaseName}`;
                    const outputPath = path.join(augDir, outputName);

                    const params = getRandomAugmentationParams(settings);
                    // params: { rotate, flipH }

                    await augmentImage(item.path, outputPath, params); // augmentImage takes { rotate, flipH } which matches

                    const outputUrl = `/api/images?path=${encodeURIComponent(outputPath)}`;

                    // Ephemeral result for Job UI
                    const result = {
                        file: outputName,
                        url: outputUrl,
                        angle: params.rotate,
                        flipped: params.flipH
                    };
                    results.push(result);

                    // Permanent Manifest Item
                    newManifestItems.push({
                        id: uuidv4(),
                        stage: 'augmented',
                        src: outputUrl,
                        path: outputPath,
                        displayName: outputName,
                        groupKey: item.groupKey, // Link to source raw for grouping
                        aug: {
                            rotate: params.rotate,
                            flip: params.flipH
                        }
                    });

                    // Update job progress every few items or every item?
                    // Every item is better for UI feedback on small batch.
                    const currentState = {
                        id: jobId,
                        status: 'running',
                        progress: { processed: i + 1, total: rawItems.length },
                        results: results
                    };
                    await fs.writeFile(jobPath, JSON.stringify(currentState, null, 2));

                } catch (e) {
                    console.error(`Failed to augment ${item.displayName}`, e);
                    // Add error result?
                    results.push({
                        file: item.displayName,
                        error: 'Failed to process'
                    });
                }
            }

            // Flush new items to Manifest
            await addToManifest(id, newManifestItems);

            // Final update
            const finalState = {
                id: jobId,
                status: 'completed',
                progress: { processed: rawItems.length, total: rawItems.length },
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
