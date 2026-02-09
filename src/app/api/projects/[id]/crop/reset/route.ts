import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject, updateProjectStats } from '@/lib/projects';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { imageId } = body;

        if (!imageId) {
            return NextResponse.json({ error: 'Missing imageId' }, { status: 400 });
        }

        const project = await getProject(id);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const croppedPath = path.join(projectDir, 'cropped', imageId);
        const metaPath = path.join(projectDir, 'cropped', `${imageId}.json`);

        // Delete files if they exist
        try {
            await fs.unlink(croppedPath);
        } catch (e: any) {
            if (e.code !== 'ENOENT') console.error('Error deleting crop file:', e);
        }

        try {
            await fs.unlink(metaPath);
        } catch (e: any) {
            if (e.code !== 'ENOENT') console.error('Error deleting crop meta:', e);
        }

        // Update stats
        await updateProjectStats(id);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Crop reset error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
