import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject, updateProjectStats } from '@/lib/projects';
import sharp from 'sharp';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { imageId, bbox, source = 'manual', confidence, referenceSetId } = body;

        if (!imageId || !bbox) {
            return NextResponse.json({ error: 'Missing imageId or bbox' }, { status: 400 });
        }

        const project = await getProject(id);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }


        const projectDir = path.join(process.cwd(), 'projects', id);
        const rawPath = path.join(projectDir, 'raw', imageId);
        const cropDir = path.join(projectDir, 'cropped', imageId);
        const metaPath = path.join(cropDir, 'meta.json');

        console.log(`[CreateCrop] imageId: ${imageId}`);
        console.log(`[CreateCrop] rawPath: ${rawPath}`);
        console.log(`[CreateCrop] cropDir: ${cropDir}`);

        // Security / Sanity check
        if (imageId.includes('..') || imageId.includes('/') || imageId.includes('\\')) {
            return NextResponse.json({ error: 'Invalid imageId' }, { status: 400 });
        }

        // Check raw image
        try {
            const stat = await fs.stat(rawPath);
            if (!stat.isFile()) {
                return NextResponse.json({ error: 'Raw path is not a file' }, { status: 400 });
            }
        } catch {
            return NextResponse.json({ error: 'Raw image not found' }, { status: 404 });
        }

        // Ensure crop directory exists
        await fs.mkdir(cropDir, { recursive: true });

        // Load existing meta or create new
        let meta: any = { raw: imageId, activeCrop: null, variants: [] };
        try {
            const metaData = await fs.readFile(metaPath, 'utf-8');
            meta = JSON.parse(metaData);
        } catch {
            // New meta
        }

        // Generate new crop filename
        // Find next index from meta or scan
        let nextIndex = meta.nextIndex;
        if (typeof nextIndex !== 'number') {
            // Fallback: scan existing variants to find max index
            let maxIndex = 0;
            const existingIndices = meta.variants.map((v: any) => {
                const match = v.file.match(/crop_(\d+)\.png/);
                return match ? parseInt(match[1]) : 0;
            });
            if (existingIndices.length > 0) {
                maxIndex = Math.max(...existingIndices);
            }
            nextIndex = maxIndex + 1;
        }

        const newCropFile = `crop_${String(nextIndex).padStart(3, '0')}.png`;
        const newCropPath = path.join(cropDir, newCropFile);

        // meaningful increment
        meta.nextIndex = nextIndex + 1;

        // Perform Crop
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

        // Validate and clamp
        const cleanLeft = Math.max(0, left);
        const cleanTop = Math.max(0, top);
        const cleanWidth = Math.min(width, metadata.width - cleanLeft);
        const cleanHeight = Math.min(height, metadata.height - cleanTop);

        if (cleanWidth <= 0 || cleanHeight <= 0) {
            return NextResponse.json({ error: 'Invalid crop dimensions' }, { status: 400 });
        }

        await image
            .extract({ left: cleanLeft, top: cleanTop, width: cleanWidth, height: cleanHeight })
            .toFile(newCropPath);

        // Add to variants
        const newVariant = {
            file: newCropFile,
            bbox,
            source,
            confidence,
            referenceSetId,
            createdAt: new Date().toISOString()
        };
        meta.variants.push(newVariant);
        meta.activeCrop = newCropFile; // Auto-set active on creation? Spec says "new crop ... creates a NEW variant". Usually user wants to see it. User also said "apply writes new variant". 
        // "Manual crop always creates a new variant by default ... Set active (primary button)"
        // Let's assume creating a manual crop sets it as active for convenience, unless specified otherwise.

        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));

        // Update project stats
        await updateProjectStats(id);

        return NextResponse.json({ ok: true, variant: newVariant });

    } catch (error) {
        console.error('Create variant error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
