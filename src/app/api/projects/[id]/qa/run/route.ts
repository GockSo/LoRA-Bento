import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { getProject } from '@/lib/projects';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const project = await getProject(id);
        if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

        const projectDir = path.join(process.cwd(), 'projects', id);
        const jobsDir = path.join(projectDir, 'jobs');
        await fs.mkdir(jobsDir, { recursive: true });

        // Load dependencies dynamically
        const { getManifest, saveManifest } = await import('@/lib/manifest');
        const { calculatePHash, detectBlur } = await import('@/lib/qa');

        // Create Job
        const jobId = uuidv4();
        const jobPath = path.join(jobsDir, `${jobId}.json`);

        const manifest = await getManifest(id);
        const rawItems = manifest.items.filter(i => i.stage === 'raw');

        const initialJobState = {
            id: jobId,
            status: 'running',
            type: 'qa',
            progress: { processed: 0, total: rawItems.length, current: 'Initializing' },
            results: { duplicateGroups: [], blurryItems: [] }
        };

        await fs.writeFile(jobPath, JSON.stringify(initialJobState, null, 2));

        // Start background process
        (async () => {
            console.log(`Starting QA job ${jobId}`);

            // 1. Build Histogram of existing hashes to detect dupes
            // We need to re-scan EVERYTHING to ensure full duplicate detection
            // Or just scan items missing flags?
            // User wants "Import QA job". It implies checking the NEW stuff.
            // But duplicates check needs context of ALL stuff.
            // Let's iterate ALL raw items. If item already has hash, skip recalc.

            const hashGroups = new Map<string, string[]>(); // hash -> [itemIds]
            const blurryList: any[] = [];

            let processed = 0;

            for (let i = 0; i < rawItems.length; i++) {
                const item = rawItems[i];
                let dirty = false;

                // Update Progress
                const currentState = {
                    ...initialJobState,
                    progress: { processed: i + 1, total: rawItems.length, current: `Analyzing ${item.displayName}` }
                };
                // Only write occasionally to save IO? Every 5 items or 1s?
                // For MVP write every item (safer for UI feedback on small batches)
                if (i % 5 === 0 || i === rawItems.length - 1) {
                    await fs.writeFile(jobPath, JSON.stringify(currentState, null, 2));
                }

                // 1. Hash
                if (!item.hash) {
                    item.hash = await calculatePHash(item.path);
                    dirty = true;
                }

                // Track for duplicate detection
                if (item.hash) {
                    const group = hashGroups.get(item.hash) || [];
                    group.push(item.id);
                    hashGroups.set(item.hash, group);
                }

                // 2. Blur
                if (item.blurScore === undefined) {
                    const blur = await detectBlur(item.path);
                    item.blurScore = blur.score;
                    if (!item.flags) item.flags = {};
                    item.flags.isBlurry = blur.isBlurry;
                    dirty = true;
                }

                if (item.flags?.isBlurry) {
                    blurryList.push({ path: item.displayName, blurScore: item.blurScore });
                }

                processed++;
            }

            // 3. Mark Duplicates
            const duplicateGroupsList = [];
            for (const [hash, ids] of hashGroups.entries()) {
                if (ids.length > 1) {
                    // Mark all as potential duplicates?
                    // "Group duplicates... Persist isDuplicateCandidate"
                    ids.forEach(itemId => {
                        const it = rawItems.find(x => x.id === itemId);
                        if (it) {
                            if (!it.flags) it.flags = {};
                            it.flags.isDuplicate = true;
                        }
                    });

                    duplicateGroupsList.push({
                        hash,
                        items: ids.map(id => rawItems.find(x => x.id === id)?.displayName)
                    });
                } else {
                    // If unique, ensure flag is false
                    const it = rawItems.find(x => x.id === ids[0]);
                    if (it && it.flags?.isDuplicate) {
                        it.flags.isDuplicate = false; // Resolved?
                    }
                }
            }

            // Save Manifest updates
            await saveManifest(id, manifest);

            // Final Job State
            const finalState = {
                id: jobId,
                status: 'completed',
                type: 'qa',
                progress: { processed: rawItems.length, total: rawItems.length, current: 'Done' },
                results: {
                    duplicateGroups: duplicateGroupsList,
                    blurryItems: blurryList
                }
            };
            await fs.writeFile(jobPath, JSON.stringify(finalState, null, 2));
            console.log(`QA Job ${jobId} finished`);

        })().catch(err => {
            console.error('QA Job failed', err);
            const errorState = {
                id: jobId,
                status: 'error',
                error: err.toString()
            };
            fs.writeFile(jobPath, JSON.stringify(errorState, null, 2));
        });

        return NextResponse.json({ jobId });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
