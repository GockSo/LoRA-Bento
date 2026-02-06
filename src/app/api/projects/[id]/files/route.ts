import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getProject, updateProjectStats } from '@/lib/projects';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const projectId = id;

        const { path: filePath } = await req.json();

        if (!filePath) {
            return NextResponse.json({ error: 'Path required' }, { status: 400 });
        }

        const project = await getProject(projectId);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const { getManifest, saveManifest } = await import('@/lib/manifest');
        const manifest = await getManifest(projectId);

        const { safeDelete } = await import('@/lib/files');
        const projectDir = path.join(process.cwd(), 'projects', projectId);

        // Verify file belongs to project
        // safeDelete handles mostly, but we should check manifest too
        const itemIndex = manifest.items.findIndex(i => i.path === filePath || i.displayName === filePath || i.src.includes(filePath) || i.path.endsWith(filePath));

        if (itemIndex === -1) {
            return NextResponse.json({ error: 'File not found in manifest' }, { status: 404 });
        }

        const item = manifest.items[itemIndex];

        // Delete from disk
        await safeDelete(projectDir, item.path, true);

        // Remove from manifest
        manifest.items.splice(itemIndex, 1);

        await saveManifest(projectId, manifest);
        await updateProjectStats(projectId);

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('Delete file error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
