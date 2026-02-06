import { NextRequest, NextResponse } from 'next/server';
import { getManifest, sortManifestItems } from '@/lib/manifest';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const manifest = await getManifest(id);
        // Sort before sending to ensure client gets correct adjacency
        const sortedItems = sortManifestItems(manifest.items);
        return NextResponse.json({ ...manifest, items: sortedItems });
    } catch (error) {
        console.error('Manifest error:', error);
        return NextResponse.json({ error: 'Failed to load manifest' }, { status: 500 });
    }
}
