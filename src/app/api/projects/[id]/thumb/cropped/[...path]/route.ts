import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import mime from 'mime';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; path: string[] }> }
) {
    try {
        const { id, path: pathSegments } = await params;

        if (!pathSegments || pathSegments.length === 0) {
            return new NextResponse('Path required', { status: 400 });
        }

        const projectDir = path.join(process.cwd(), 'projects', id);
        // Construct file path from segments
        // params path is like [imageId, filename]
        const filePath = path.join(projectDir, 'cropped', ...pathSegments);

        // Security check: ensure path is within projects dir
        const relative = path.relative(projectDir, filePath);
        if (relative.startsWith('..') || path.isAbsolute(relative)) {
            return new NextResponse('Invalid path', { status: 403 });
        }

        try {
            await fs.access(filePath);
            const stats = await fs.stat(filePath);

            if (!stats.isFile()) {
                return new NextResponse('Not a file', { status: 400 });
            }

            // Resize on the fly
            const fileBuffer = await fs.readFile(filePath);
            const resizedBuffer = await sharp(fileBuffer)
                .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 80 }) // Convert to JPEG for efficiency? Or keep original? Let's use jpeg for thumbs.
                .toBuffer();

            return new NextResponse(resizedBuffer as any, {
                headers: {
                    'Content-Type': 'image/jpeg',
                    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });

        } catch (err) {
            console.error(err);
            return new NextResponse('File not found', { status: 404 });
        }
    } catch (error) {
        console.error('Thumb serve error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
