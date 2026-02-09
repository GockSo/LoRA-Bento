import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { augmentImage, getRandomAugmentationParams } from '@/lib/images';
import { updateProjectStats, updateProject, getProject } from '@/lib/projects';
import { addToManifest, getManifest } from '@/lib/manifest';
import { v4 as uuidv4 } from 'uuid';
import { AugmentationSettings, ManifestItem } from '@/types';
import { resolveAugmentInput } from '@/lib/augment-resolver';


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const settings = body.settings as AugmentationSettings;
        console.log('Augmentation Settings:', settings);
        // settings: { rotationRandom, rotationRange, flipEnabled }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const rawDir = path.join(projectDir, 'raw');
        const augDir = path.join(projectDir, 'augmented');
        const jobsDir = path.join(projectDir, 'jobs');

        // Ensure directories exist
        await fs.mkdir(augDir, { recursive: true });
        await fs.mkdir(jobsDir, { recursive: true });

        // Save settings to project
        await updateProject(id, { settings: { augmentation: settings } as any });

        // Enumerate raw directory instead of using manifest
        const rawFiles = await fs.readdir(rawDir);
        const imageFiles = rawFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

        if (imageFiles.length === 0) {
            return NextResponse.json({ error: 'No raw images to augment' }, { status: 400 });
        }

        // Create Job
        const jobId = uuidv4();
        const jobPath = path.join(jobsDir, `${jobId}.json`);

        const initialJobState = {
            id: jobId,
            status: 'running',
            progress: { processed: 0, total: imageFiles.length },
            results: [] // Ephemeral results for live UI feedback
        };

        await fs.writeFile(jobPath, JSON.stringify(initialJobState, null, 2));


        // Start background processing
        (async () => {
            console.log(`Starting augmentation job ${jobId} for project ${id}`);
            const results: any[] = [];
            const newManifestItems: ManifestItem[] = [];

            for (let i = 0; i < imageFiles.length; i++) {
                const filename = imageFiles[i];
                try {
                    // Use shared resolver to determine the effective input source
                    const { sourceType, absPath, sourceFile } = await resolveAugmentInput(id, filename);
                    const sourcePath = absPath;

                    const fileBaseName = path.basename(filename, path.extname(filename));

                    // NEW: Subfolder per raw image
                    const itemAugDir = path.join(augDir, `${fileBaseName}_aug`);
                    await fs.mkdir(itemAugDir, { recursive: true });

                    // Find next index
                    // Read existing files in this dir
                    const existingFiles = await fs.readdir(itemAugDir);
                    // Filter for <number>.png
                    const indices = existingFiles
                        .map(f => {
                            const match = f.match(/^(\d+)\.png$/);
                            return match ? parseInt(match[1]) : 0;
                        })
                        .filter(n => n > 0);

                    const nextIndex = indices.length > 0 ? Math.max(...indices) + 1 : 1;

                    const outputName = `${nextIndex}.png`;
                    const outputPath = path.join(itemAugDir, outputName);

                    const params = getRandomAugmentationParams(settings);
                    // params: { rotate, flipH }

                    await augmentImage(sourcePath, outputPath, params);

                    const outputUrl = `/api/images?path=${encodeURIComponent(outputPath)}&t=${Date.now()}`;

                    // Ephemeral result for Job UI
                    const result = {
                        file: outputName,
                        url: outputUrl,
                        angle: params.rotate,
                        flipped: params.flipH,
                        groupKey: filename // Pass group key for client sorting
                    };
                    results.push(result);

                    // Permanent Manifest Item with enhanced metadata
                    newManifestItems.push({
                        id: uuidv4(),
                        stage: 'augmented',
                        src: outputUrl,
                        path: outputPath,
                        displayName: outputName,
                        groupKey: filename, // Link to source raw for grouping
                        aug: {
                            rotate: params.rotate,
                            flip: params.flipH,
                            inputSourceType: sourceType,           // NEW: track which source was used
                            inputFile: sourceFile || filename      // NEW: track which file was used
                        }
                    });

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
                    console.error(`Failed to augment ${filename}`, e);
                    // Add error result?
                    results.push({
                        file: filename,
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
