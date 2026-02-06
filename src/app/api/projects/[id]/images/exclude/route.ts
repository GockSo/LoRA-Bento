import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { safeDelete } from '@/lib/files';
import { getManifest, saveManifest } from '@/lib/manifest';
import { getProject, updateProject, updateProjectStats } from '@/lib/projects';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const { file, excluded } = body;
        // file is the RAW filename, e.g. "IMG_001.jpg"

        if (!file) return NextResponse.json({ error: 'File required' }, { status: 400 });

        const projectDir = path.join(process.cwd(), 'projects', id);
        const project = await getProject(id);

        // 1. Update Project State
        let excludedRaw = project.excludedRaw || [];
        if (excluded) {
            if (!excludedRaw.includes(file)) excludedRaw.push(file);
        } else {
            excludedRaw = excludedRaw.filter(f => f !== file);
        }
        await updateProject(id, { excludedRaw } as any);

        // 2. If Excluded, clean up derived files
        if (excluded) {
            const manifest = await getManifest(id);
            const itemsToRemove: string[] = []; // item IDs

            // Find all items derived from this raw file
            // groupKey is usually the raw filename
            const derivedItems = manifest.items.filter(item =>
                item.groupKey === file && item.stage !== 'raw'
            );

            for (const item of derivedItems) {
                // Delete file from disk
                try {
                    // item.path is absolute
                    await safeDelete(projectDir, item.path);
                    itemsToRemove.push(item.id);
                } catch (e) {
                    console.error(`Failed to delete ${item.displayName}`, e);
                }
            }

            // Also check for processed versions of the RAW file itself if any?
            // (If we process raw files directly, they might have entries in processed/ or manifest with stage='processed'?)
            // Currently manifest structure is flat stages 'raw' | 'augmented'.
            // Processed outputs might be tracked inside the item property `processedPath` or similar if we updated it?
            // "src/types/index.ts": processed?: boolean;
            // "process/route.ts": saves to processed/ folder.
            // If we have separate manifest items for processed, we delete them.
            // If 'processed' is just a state on an item, we might need to delete the physical processed file.

            // Let's look for processed files corresponding to this groupKey.
            // Convention: derivedItems covers augmented.
            // What about processed version of the RAW file?
            // The raw item in manifest has `groupKey === file`.
            // The processed version is likely named similarly in `processed/`.
            // We should ideally iterate all manifest items of this group, check if they have processed artifacts, and delete those.

            // Simplify: Delete ANY manifest item related to this groupKey except the raw one (which we keep but exclude).
            // Actually, if we exclude, do we keep the RAW item in manifest?
            // Requirement: "Marks a RAW image as excluded... RAW file remains intact."
            // "Removes all derived outputs... Do not remove anything from raw/."

            // We keep the RAW item in Manifest so we can show it in "Excluded" tab?
            // Or we rely on `excludedRaw` project state and filtering?
            // Better to keep it in manifest.

            // Remove derived manifest items
            manifest.items = manifest.items.filter(item => !itemsToRemove.includes(item.id));
            await saveManifest(id, manifest);
        }

        await updateProjectStats(id);

        return NextResponse.json({ success: true, excludedRaw });

    } catch (error) {
        console.error('Exclude error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
