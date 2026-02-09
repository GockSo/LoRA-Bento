import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject, updateProjectStats } from '@/lib/projects';
import sharp from 'sharp';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { imageId, bbox } = body;

        if (!imageId || !bbox) {
            return NextResponse.json({ error: 'Missing imageId or bbox' }, { status: 400 });
        }

        const project = await getProject(id);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const rawPath = path.join(projectDir, 'raw', imageId);
        const croppedPath = path.join(projectDir, 'cropped', imageId);
        const metaPath = path.join(projectDir, 'cropped', `${imageId}.json`);

        // Check if raw file exists
        try {
            await fs.access(rawPath);
        } catch {
            return NextResponse.json({ error: 'Raw image not found' }, { status: 404 });
        }

        // Get image metadata to calculate absolute crop
        const image = sharp(rawPath);
        const metadata = await image.metadata();

        if (!metadata.width || !metadata.height) {
            return NextResponse.json({ error: 'Failed to read image metadata' }, { status: 500 });
        }

        // Calculate crop dimensions
        const left = Math.round(bbox.x * metadata.width);
        const top = Math.round(bbox.y * metadata.height);
        const width = Math.round(bbox.w * metadata.width);
        const height = Math.round(bbox.h * metadata.height);

        // Validate crop dimensions
        if (width <= 0 || height <= 0 || left < 0 || top < 0 ||
            (left + width > metadata.width) || (top + height > metadata.height)) {
            // Fallback: if slightly off due to rounding, clamp it
            // But valid input should be within range 0-1
            // For now, let sharp handle validation or try to clamp
        }

        // Ensure cropped directory exists (should be created by createProject but safety first)
        await fs.mkdir(path.join(projectDir, 'cropped'), { recursive: true });

        // Perform crop
        await image
            .extract({ left, top, width, height })
            .toFile(croppedPath);

        // Save metadata
        await fs.writeFile(metaPath, JSON.stringify({
            source: imageId,
            bbox,
            originalWidth: metadata.width,
            originalHeight: metadata.height,
            croppedAt: new Date().toISOString()
        }, null, 2));

        // Update stats
        await updateProjectStats(id);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Crop error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
