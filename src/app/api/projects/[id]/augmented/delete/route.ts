import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { safeDelete } from '@/lib/files';
import { getManifest, saveManifest } from '@/lib/manifest';
import { updateProjectStats } from '@/lib/projects';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const { itemId } = body; // Manifest Item ID

        if (!itemId) return NextResponse.json({ error: 'Item ID required' }, { status: 400 });

        const projectDir = path.join(process.cwd(), 'projects', id);
        const manifest = await getManifest(id);

        const itemIndex = manifest.items.findIndex(i => i.id === itemId);
        if (itemIndex === -1) {
            return NextResponse.json({ error: 'Item not found' }, { status: 404 });
        }

        const item = manifest.items[itemIndex];

        // Guard: Never delete raw via this route
        if (item.stage === 'raw') {
            return NextResponse.json({ error: 'Cannot delete raw items here' }, { status: 403 });
        }

        // Delete file
        await safeDelete(projectDir, item.path);

        // Remove from manifest
        manifest.items.splice(itemIndex, 1);
        await saveManifest(id, manifest);
        await updateProjectStats(id);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete aug error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
