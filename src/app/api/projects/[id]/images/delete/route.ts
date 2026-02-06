import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject, updateProjectStats } from '@/lib/projects';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const projectId = id;
        const body = await req.json();
        const { files } = body; // Array of displayNames or IDs? Let's use displayNames as UI uses them often, or IDs.
        // Implementation plan said "files: string[]". Let's assume displayNames for consistency with exclude, 
        // OR better: IDs if we have them. Raw page has IDs.
        // Let's support IDs for robustness.

        if (!files || !Array.isArray(files)) {
            return NextResponse.json({ error: 'Invalid files array' }, { status: 400 });
        }

        const project = await getProject(projectId);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const { getManifest, saveManifest } = await import('@/lib/manifest');
        const manifest = await getManifest(projectId);
        const { safeDelete } = await import('@/lib/files');
        const projectDir = path.join(process.cwd(), 'projects', projectId);

        const deletedIds = new Set<string>();
        let successCount = 0;

        // Map displayNames to IDs if needed, or just look up
        // Let's assume input is list of 'displayName' (e.g. "1.png") because frontend logic usually iterates names.
        // Actually items have IDs. Let's look up by displayName.

        for (const fileName of files) {
            const item = manifest.items.find(i => i.displayName === fileName && i.stage === 'raw');
            if (item) {
                try {
                    await safeDelete(projectDir, item.path);
                    deletedIds.add(item.id);
                    successCount++;
                } catch (e) {
                    console.error(`Failed to delete ${fileName}`, e);
                }
            }
        }

        // Remove from manifest
        if (deletedIds.size > 0) {
            manifest.items = manifest.items.filter(i => !deletedIds.has(i.id));
            await saveManifest(projectId, manifest);
            await updateProjectStats(projectId);
        }

        return NextResponse.json({ deleted: successCount });
    } catch (error) {
        console.error('Delete error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
