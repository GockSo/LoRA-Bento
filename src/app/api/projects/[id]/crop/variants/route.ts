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
        const enrichedVariants = await Promise.all(meta.variants.map(async (v: any) => {
            // New URL format: /api/projects/:id/files/cropped/:imageId/:variantFile
            // This maps to projects/:id/cropped/imageId/variantFile
            let mtimeMs = Date.now();
            try {
                const variantPath = path.join(cropDir, v.file);
                const stats = await fs.stat(variantPath);
                mtimeMs = stats.mtimeMs;
            } catch {
                // file might be missing
            }

            const url = `/api/projects/${id}/files/cropped/${imageId}/${v.file}?v=${mtimeMs}`;
            // Use local thumb route
            const thumbUrl = `/api/projects/${id}/thumb/cropped/${imageId}/${v.file}?v=${mtimeMs}`;

            return {
                ...v,
                url,
                thumbUrl
            };
        }));

        const activeCropUrl = meta.activeCrop
            ? `/api/projects/${id}/files/cropped/${imageId}/${meta.activeCrop}?v=${Date.now()}` // active crop might need real mtime too, but for single file simpler to just bust
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
