import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject, updateProjectStats } from '@/lib/projects';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { imageId, variantFile } = body;

        if (!imageId || !variantFile) {
            return NextResponse.json({ error: 'Missing imageId or variantFile' }, { status: 400 });
        }

        const project = await getProject(id);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const cropDir = path.join(projectDir, 'cropped', imageId);
        const metaPath = path.join(cropDir, 'meta.json');
        const variantPath = path.join(cropDir, variantFile);

        // Read meta
        let meta: any = { variants: [], activeCrop: null };
        try {
            const metaData = await fs.readFile(metaPath, 'utf-8');
            meta = JSON.parse(metaData);
        } catch {
            return NextResponse.json({ error: 'Crop metadata not found' }, { status: 404 });
        }

        // Remove file
        try {
            await fs.unlink(variantPath);
        } catch {
            // Ignore if file already gone
        }

        // Update meta
        meta.variants = meta.variants.filter((v: any) => v.file !== variantFile);

        // If active was deleted
        if (meta.activeCrop === variantFile) {
            // Set to latest or null
            if (meta.variants.length > 0) {
                // Assuming variants are ordered by creation? Or sort by createdAt
                // They are pushed roughly in order.
                meta.activeCrop = meta.variants[meta.variants.length - 1].file;
            } else {
                meta.activeCrop = null;
            }
        }

        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

        // Update stats
        await updateProjectStats(id);

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('Delete variant error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
