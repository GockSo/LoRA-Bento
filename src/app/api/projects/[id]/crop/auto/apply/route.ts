import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject, updateProjectStats } from '@/lib/projects';
import sharp from 'sharp';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { proposals } = body; // Array of { imageId, bbox, source, confidence, ... }

        if (!proposals || !Array.isArray(proposals)) {
            return NextResponse.json({ error: 'Invalid proposals payload' }, { status: 400 });
        }

        const project = await getProject(id);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const cropDir = path.join(projectDir, 'cropped');
        await fs.mkdir(cropDir, { recursive: true });

        const results = [];

        for (const proposal of proposals) {
            const { imageId, bbox, source = 'auto', confidence, referenceSetId } = proposal;

            try {
                const rawPath = path.join(projectDir, 'raw', imageId);
                const imageCropDir = path.join(cropDir, imageId);
                const metaPath = path.join(imageCropDir, 'meta.json');

                // Check raw image
                try {
                    await fs.access(rawPath);
                } catch {
                    results.push({ imageId, status: 'error', error: 'Raw image not found' });
                    continue;
                }

                await fs.mkdir(imageCropDir, { recursive: true });

                // Load existing meta or create new
                let meta: any = { raw: imageId, activeCrop: null, variants: [] };
                try {
                    const metaData = await fs.readFile(metaPath, 'utf-8');
                    meta = JSON.parse(metaData);
                } catch { }

                // Determine filename
                let nextIndex = 1;
                const existingIndices = meta.variants.map((v: any) => {
                    const match = v.file.match(/crop_(\d+)\.png/);
                    return match ? parseInt(match[1]) : 0;
                });
                if (existingIndices.length > 0) {
                    nextIndex = Math.max(...existingIndices) + 1;
                }
                const newCropFile = `crop_${String(nextIndex).padStart(3, '0')}.png`;
                const newCropPath = path.join(imageCropDir, newCropFile);

                // Perform Crop
                const image = sharp(rawPath);
                const metadata = await image.metadata();

                if (metadata.width && metadata.height) {
                    const left = Math.round(bbox.x * metadata.width);
                    const top = Math.round(bbox.y * metadata.height);
                    const width = Math.round(bbox.w * metadata.width);
                    const height = Math.round(bbox.h * metadata.height);

                    const cleanLeft = Math.max(0, left);
                    const cleanTop = Math.max(0, top);
                    const cleanWidth = Math.min(width, metadata.width - cleanLeft);
                    const cleanHeight = Math.min(height, metadata.height - cleanTop);

                    if (cleanWidth > 0 && cleanHeight > 0) {
                        await image
                            .extract({ left: cleanLeft, top: cleanTop, width: cleanWidth, height: cleanHeight })
                            .toFile(newCropPath);

                        const newVariant = {
                            file: newCropFile,
                            bbox,
                            source,
                            confidence,
                            referenceSetId,
                            createdAt: new Date().toISOString()
                        };

                        meta.variants.push(newVariant);
                        // Do NOT auto-set active for bulk auto-apply unless specified? 
                        // Plan: "Applying auto crop ... appends new variants".
                        // "Downstream pipeline uses active crop".
                        // If we don't set active, user has to manually set them?
                        // "No 'activeCrop' -> use most recent variant by default".
                        // So if we don't set active, but our rule is "use most recent", it will implicitly be active.
                        // However, meta.activeCrop is explicit.
                        // I'll set it to null if it was null, or keep it.
                        // But wait, the rule "No activeCrop -> use most recent" means I should ensure I don't break that.
                        // If I *don't* set `activeCrop` in JSON, the logic elsewhere needs to handle it.
                        // Or I just set it to `newCropFile` so it becomes the explicit active one.
                        // "Applying auto crop always appends a new crop variant... Non-destructive".
                        // Usually user wants to see the result of what they just applied.
                        // So I will set it as active.
                        meta.activeCrop = newCropFile;

                        await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
                        results.push({ imageId, status: 'success', file: newCropFile });
                    } else {
                        results.push({ imageId, status: 'error', error: 'Invalid crop dimensions' });
                    }
                } else {
                    results.push({ imageId, status: 'error', error: 'Metadata read failed' });
                }
            } catch (e: any) {
                results.push({ imageId, status: 'error', error: e.message });
            }
        }

        await updateProjectStats(id);

        return NextResponse.json({ ok: true, results });

    } catch (error) {
        console.error('Batch apply error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
