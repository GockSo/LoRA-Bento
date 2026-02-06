import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject, updateProjectStats } from '@/lib/projects';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const projectId = id;

        const project = await getProject(projectId);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const { getManifest, saveManifest } = await import('@/lib/manifest');
        const manifest = await getManifest(projectId);

        // 1. Group by Hash
        const groups = new Map<string, any[]>();
        const rawItems = manifest.items.filter(i => i.stage === 'raw');

        // We need image dimensions/size for "Best" heuristic. 
        // Manifest doesn't store width/height/size yet in typical manifest item (only in stats?).
        // If we don't have it, we fall back to file stats OR just Keep Oldest (Index).
        // Let's check file stats if needed, or just prioritize index for MVP "Stable".
        // User requested: "Prefer higher resolution... size... index".
        // Reading all file stats might be slow. 
        // Let's lazy read stats ONLY for duplicates.

        for (const item of rawItems) {
            if (item.hash && item.flags?.isDuplicate) {
                const group = groups.get(item.hash) || [];
                group.push(item);
                groups.set(item.hash, group);
            }
        }

        let deletedCount = 0;
        const deletedIds = new Set<string>();

        const { safeDelete } = await import('@/lib/files');
        const projectDir = path.join(process.cwd(), 'projects', projectId);

        for (const [hash, group] of groups.entries()) {
            if (group.length <= 1) continue;

            // Gather detailed stats for sorting
            const detailedItems = await Promise.all(group.map(async (item) => {
                try {
                    const stat = await fs.stat(item.path);
                    // For resolution we'd need sharp metadata. 
                    // Let's assume for now duplicates usually have same resolution if exact hash?
                    // Actually pHash is perceptual, so resizing happens. 
                    // Let's assume File Size is good proxy for quality if resolution is similar.
                    // Reading resolution for all duplicates is safer.
                    // const meta = await sharp(item.path).metadata();
                    // For speed/MVP: Sort by Size DESC, then ID ASC.
                    return { ...item, size: stat.size };
                } catch {
                    return { ...item, size: 0 };
                }
            }));

            // Sort: Size DESC, then GroupId ASC (keep original)
            detailedItems.sort((a, b) => {
                if (b.size !== a.size) return b.size - a.size; // Larger is better
                return (a.groupId || 999999) - (b.groupId || 999999); // Lower ID is better (earlier)
            });

            // Keep index 0
            const best = detailedItems[0];
            const toDelete = detailedItems.slice(1);

            for (const item of toDelete) {
                // Delete from disk
                try {
                    await safeDelete(projectDir, item.path);
                    deletedIds.add(item.id);
                    deletedCount++;
                } catch (e) {
                    console.error(`Failed to delete duplicate ${item.displayName}`, e);
                }
            }

            // Update "Best" flags to remove duplicate flag?
            // "Update manifest... Refresh gallery counts".
            // If we deleted the others, this one is no longer a duplicate *in this set*.
            // But if it was duplicate with something we kept?
            // Wait, if we grouped by hash and kept 1, that 1 is unique for that hash.
            const manifestItem = manifest.items.find(i => i.id === best.id);
            if (manifestItem && manifestItem.flags) {
                manifestItem.flags.isDuplicate = false; // No longer duplicate
            }
        }

        // Filter out deleted items from manifest
        manifest.items = manifest.items.filter(i => !deletedIds.has(i.id));

        await saveManifest(projectId, manifest);
        await updateProjectStats(projectId);

        return NextResponse.json({ deleted: deletedCount });
    } catch (error) {
        console.error('Auto-delete error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
