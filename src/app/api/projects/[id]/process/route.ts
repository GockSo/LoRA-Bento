import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { processImage } from '@/lib/images';
import { updateProject, updateProjectStats, getProject } from '@/lib/projects';
import { getManifest, sortManifestItems } from '@/lib/manifest'; // Use manifest
import { v4 as uuidv4 } from 'uuid';
import { ProjectSettings } from '@/types';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const body = await req.json();
        const { settings } = body;
        const { id } = await params;

        if (!settings.targetSize) {
            return NextResponse.json({ error: 'Target size required' }, { status: 400 });
        }

        // Save settings to project
        await updateProject(id, { settings: { ...settings } });

        const projectDir = path.join(process.cwd(), 'projects', id);
        const resizedDir = path.join(projectDir, 'resized');
        const jobsDir = path.join(projectDir, 'jobs');

        await fs.mkdir(resizedDir, { recursive: true });
        await fs.mkdir(jobsDir, { recursive: true });

        // Source: Use Manifest Items (Raw + Aug)
        const manifest = await getManifest(id);
        const itemsToProcess = manifest.items; // All items: Raw + Aug

        if (itemsToProcess.length === 0) {
            return NextResponse.json({ error: 'No items to process' }, { status: 400 });
        }

        // Create Job
        const jobId = uuidv4();
        const jobPath = path.join(jobsDir, `${jobId}.json`);

        // Initial result state map: { [itemId: string]: { status: 'pending' | 'processing' | 'done', processedPath?: string } }
        const itemStates: Record<string, any> = {};
        itemsToProcess.forEach(item => {
            itemStates[item.id] = { status: 'pending' };
        });

        const initialJobState = {
            id: jobId,
            status: 'running',
            progress: { processed: 0, total: itemsToProcess.length },
            results: itemStates // Granular tracking map
        };

        await fs.writeFile(jobPath, JSON.stringify(initialJobState, null, 2));

        // Async batch process
        (async () => {
            console.log(`Starting processing job ${jobId} for project ${id}`);
            let processedCount = 0;


            for (const item of itemsToProcess) {
                // Update item status to processing
                itemStates[item.id] = { status: 'processing' };

                await fs.writeFile(jobPath, JSON.stringify({
                    ...initialJobState,
                    progress: { processed: processedCount, total: itemsToProcess.length },
                    results: itemStates
                }, null, 2));


                try {
                    // Determine source path
                    let sourcePath = item.path;

                    // If item is raw, check for crop OR skip crop
                    if (item.stage === 'raw') {
                        const filename = path.basename(item.path);

                        // SKIP CROP LOGIC
                        const projectConfig = await getProject(id);
                        if (projectConfig?.crop?.mode === 'skip') {
                            const skipCropPath = path.join(projectDir, 'skip_crop', filename);
                            try {
                                await fs.access(skipCropPath);
                                sourcePath = skipCropPath;
                            } catch {
                                console.warn(`Skip crop enabled but file not found: ${skipCropPath}`);
                            }
                        } else {
                            // Normal Crop Logic
                            const cropDir = path.join(projectDir, 'cropped', filename);
                            const metaPath = path.join(cropDir, 'meta.json');
                            try {
                                await fs.access(metaPath);
                                const metaContent = await fs.readFile(metaPath, 'utf-8');
                                const meta = JSON.parse(metaContent);
                                if (meta.activeCrop) {
                                    sourcePath = path.join(cropDir, meta.activeCrop);
                                }
                            } catch {
                                // No crop or meta, stick to raw
                            }
                        }
                    }

                    // Output name: if item is 'aug_foo.png' -> 'aug_foo.png' (in processed)

                    // if item is 'foo.png' (raw) -> 'foo.png' (in processed)
                    // Wait, if Aug items have unique names, we are good.
                    // Manifest item has `displayName` or base `path`.
                    // We must ensure unique filename in Processed dir.

                    const fileName = path.basename(item.path);
                    const nameWithoutExt = path.parse(fileName).name;
                    // Use ID slice to ensure uniqueness even if basenames match (e.g. 1.jpg in raw and 1.png in augmented)
                    const outputName = `${nameWithoutExt}_${item.id.slice(0, 8)}.png`;
                    const outputPath = path.join(resizedDir, outputName);

                    await processImage(item.path, outputPath, settings as ProjectSettings);

                    itemStates[item.id] = {
                        status: 'done',
                        processedPath: `/api/images?path=${encodeURIComponent(outputPath)}`
                    };
                } catch (e) {
                    console.error(`Failed to process ${item.displayName}`, e);
                    itemStates[item.id] = { status: 'error', error: 'Failed' };
                }

                processedCount++;

                // Periodic update or per-item? Per-item is safer for UI check marks
                // But avoid pounding disk too hard? 
                // With small datasets < 1000 ok.
            }

            // Final update
            const finalState = {
                id: jobId,
                status: 'completed',
                progress: { processed: itemsToProcess.length, total: itemsToProcess.length },
                results: itemStates
            };
            await fs.writeFile(jobPath, JSON.stringify(finalState, null, 2));

            await updateProjectStats(id);
            console.log(`Finished processing job ${jobId}`);
        })();

        return NextResponse.json({ jobId });

    } catch (error) {
        console.error('Process error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
