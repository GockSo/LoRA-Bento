import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject } from '@/lib/projects';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const searchParams = req.nextUrl.searchParams;
        const imageId = searchParams.get('imageId');

        if (!imageId) {
            return NextResponse.json({ error: 'Missing imageId' }, { status: 400 });
        }

        const project = await getProject(id);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const cropDir = path.join(projectDir, 'cropped', imageId);
        const metaPath = path.join(cropDir, 'meta.json');

        // Check if crop directory exists
        try {
            await fs.access(cropDir);
        } catch {
            // No crops yet, return empty
            return NextResponse.json({ variants: [], activeCrop: null });
        }

        // Read meta.json
        let meta: any = { variants: [], activeCrop: null };
        try {
            const metaData = await fs.readFile(metaPath, 'utf-8');
            meta = JSON.parse(metaData);
        } catch {
            // If meta.json doesn't exist but dir does, maybe legacy or just created dir.
            // We could scan for files if we wanted to be robust, but for now return empty.
        }

        // Enhance variants with URLs
        const enrichedVariants = meta.variants.map((v: any) => {
            const variantPath = path.join(cropDir, v.file);
            return {
                ...v,
                url: `/api/images?path=${encodeURIComponent(variantPath)}`
            };
        });

        const activeCropUrl = meta.activeCrop
            ? `/api/images?path=${encodeURIComponent(path.join(cropDir, meta.activeCrop))}`
            : null;

        return NextResponse.json({
            ...meta,
            variants: enrichedVariants,
            activeCropUrl
        });

    } catch (error) {
        console.error('List variants error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
