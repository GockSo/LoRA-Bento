
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { safeDelete } from '@/lib/files';
import { getManifest, saveManifest } from '@/lib/manifest';
import { getProject, updateProjectStats } from '@/lib/projects';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const { file } = body;
        // file is the RAW filename, e.g. "IMG_001.jpg"

        if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 });

        const projectDir = path.join(process.cwd(), 'projects', id);
        const project = await getProject(id);
        if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

        const manifest = await getManifest(id);
        const itemsToRemove: string[] = []; // item IDs

        // 1. Find all items derived from this raw file (groupKey)
        // This includes the RAW item itself, and any crops/augmented versions.
        const relatedItems = manifest.items.filter(item =>
            item.groupKey === file || item.displayName === file
        );

        // 2. Delete files from disk and collect IDs
        for (const item of relatedItems) {
            try {
                // item.path is absolute
                // Force delete (true) to bypass raw folder safety guard
                await safeDelete(projectDir, item.path, true);
                itemsToRemove.push(item.id);
            } catch (e) {
                console.error(`Failed to delete ${item.displayName}`, e);
            }
        }

        // Also check for sidecar text files (.txt captions) if they exist for the raw file
        // Usually captions are associated with specific manifest items, but sometimes we have floating .txt
        if (relatedItems.length > 0) {
            const rawItem = relatedItems.find(i => i.stage === 'raw');
            if (rawItem && rawItem.path) {
                const captionPath = rawItem.path.replace(/\.[^/.]+$/, "") + ".txt";
                try {
                    // Force delete sidecar if it exists in restricted folders
                    await safeDelete(projectDir, captionPath, true);
                } catch { }
            }
        }

        // 3. Update Manifest
        if (itemsToRemove.length > 0) {
            manifest.items = manifest.items.filter(item => !itemsToRemove.includes(item.id));

            // CLEANUP: specific check for duplicates.
            // If we deleted a file that was part of a duplicate group, the remaining file(s) might now be unique.
            // We should clear the isDuplicate flag if only 1 item remains with that hash.
            const hashCounts = new Map<string, number>();
            manifest.items.forEach(i => {
                if (i.hash) {
                    hashCounts.set(i.hash, (hashCounts.get(i.hash) || 0) + 1);
                }
            });

            manifest.items.forEach(i => {
                if (i.hash && i.flags?.isDuplicate) {
                    const count = hashCounts.get(i.hash) || 0;
                    if (count < 2) {
                        // No longer a duplicate
                        i.flags.isDuplicate = false;
                        // Clear groupId too?
                        // i.groupId = undefined; // Optional, might be used for sorting
                    }
                }
            });

            await saveManifest(id, manifest);
        }

        // 4. Update Stats
        await updateProjectStats(id);

        return NextResponse.json({ success: true, deletedCount: itemsToRemove.length });

    } catch (error) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
