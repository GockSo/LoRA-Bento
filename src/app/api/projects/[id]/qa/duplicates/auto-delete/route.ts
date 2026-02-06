import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject, updateProjectStats } from '@/lib/projects';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

        // Filter valid duplicates
        for (const item of rawItems) {
            if (item.hash && (item.flags as any)?.isDuplicate) {
                const group = groups.get(item.hash) || [];
                group.push(item);
                groups.set(item.hash, group);
            }
        }

        let deletedCount = 0;
        const deletedIds = new Set<string>();
        const keptIds = new Set<string>();

        const { safeDelete } = await import('@/lib/files');
        const projectDir = path.join(process.cwd(), 'projects', projectId);

        for (const [hash, group] of groups.entries()) {
            if (group.length <= 1) continue;

            // Gather detailed stats for sorting
            const detailedItems = await Promise.all(group.map(async (item) => {
                try {
                    const stat = await fs.stat(item.path);
                    return { ...item, size: stat.size };
                } catch {
                    return { ...item, size: 0 };
                }
            }));

            // Sort: Size DESC, then GroupId ASC (keep original)
            detailedItems.sort((a, b) => {
                if (b.size !== a.size) return b.size - a.size; // Larger is better
                return (a.groupId || 999999) - (b.groupId || 999999); // Lower ID is better
            });

            // Keep index 0
            const best = detailedItems[0];
            keptIds.add(best.id);

            const toDelete = detailedItems.slice(1);

            for (const item of toDelete) {
                // Delete from disk
                try {
                    await safeDelete(projectDir, item.path, true);
                    deletedIds.add(item.id);
                    deletedCount++;
                } catch (e) {
                    console.error(`Failed to delete duplicate ${item.displayName}`, e);
                }
            }

            // Update "Best" flags to remove duplicate flag
            const manifestItem = manifest.items.find(i => i.id === best.id);
            if (manifestItem && manifestItem.flags) {
                manifestItem.flags.isDuplicate = false;
            }
        }

        // Filter out deleted items from manifest
        manifest.items = manifest.items.filter(i => !deletedIds.has(i.id));

        await saveManifest(projectId, manifest);
        await updateProjectStats(projectId);

        return NextResponse.json({
            deleted: deletedCount,
            kept: keptIds.size,
            deletedIds: Array.from(deletedIds),
            keptIds: Array.from(keptIds)
        });

    } catch (error) {
        console.error('Auto-delete error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
