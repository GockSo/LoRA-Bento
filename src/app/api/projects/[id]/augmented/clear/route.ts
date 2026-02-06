import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { safeClearFolder } from '@/lib/files';
import { getManifest, saveManifest } from '@/lib/manifest';
import { updateProjectStats } from '@/lib/projects';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        const body = await req.json();
        const { clearDownstream } = body;

        const projectDir = path.join(process.cwd(), 'projects', id);

        // 1. Clear 'augmented' folder ALWAYS
        await safeClearFolder(projectDir, 'augmented');

        // 2. Clear downstream if requested OR if we just want to keep everything in sync
        // User requested: "Optionally also clear downstream outputs if augmentation affects them"
        // If we clear augmented, processed/captions derived from them are technically invalid/stale.
        // It's safer to clear them if they depend on augmentation.
        if (clearDownstream) {
            await safeClearFolder(projectDir, 'processed');
            // await safeClearFolder(projectDir, 'captions'); // If captions depend on augmented? Usually captions are on raw?
            // If captions are only on Raw, we don't need to clear them.
            // But if we did "Process -> Resize -> Caption", then yes.
            // Currently pipeline is: Augment (Step 2) -> Preprocess (Step 3). Captions (Step 4)
            // So Processed images depend on Augment. Captions might depend on Processed/Raw.
            // Let's safe clear 'processed'.
        }

        // 3. Update Manifest
        const manifest = await getManifest(id);
        // Remove all non-raw items
        // Filter: Keep items where stage === 'raw'
        manifest.items = manifest.items.filter(item => item.stage === 'raw');

        await saveManifest(id, manifest);
        await updateProjectStats(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Clear augmented error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
