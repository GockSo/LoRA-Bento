import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject } from '@/lib/projects';

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

        // Read meta
        let meta: any = { variants: [], activeCrop: null };
        try {
            const metaData = await fs.readFile(metaPath, 'utf-8');
            meta = JSON.parse(metaData);
        } catch {
            return NextResponse.json({ error: 'Crop metadata not found' }, { status: 404 });
        }

        // Verify variant exists in list
        const exists = meta.variants.some((v: any) => v.file === variantFile);
        if (!exists) {
            return NextResponse.json({ error: 'Variant not found in metadata' }, { status: 404 });
        }

        // Update active
        meta.activeCrop = variantFile;

        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('Set active variant error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
