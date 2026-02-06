
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import sharp from 'sharp';
import fs from 'fs/promises';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const body = await req.json();
        const { image, settings } = body;
        const { rotate, flipH, zoom } = settings;
        const { id } = await params;

        // Use the first image from raw if no specific image selected (or passed image name)
        const rawDir = path.join(process.cwd(), 'projects', id, 'raw');

        // Safety check path
        let imagePath = '';
        if (image) {
            imagePath = path.join(rawDir, image);
        }

        // Check if exists
        try {
            if (!image) throw new Error('No image specified');
            await fs.access(imagePath);
        } catch {
            // If specific image not found, try to find ANY image to preview with
            const files = await fs.readdir(rawDir);
            const firstImage = files.find(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
            if (!firstImage) {
                return new NextResponse('No images to preview', { status: 404 });
            }
            // Use the found image
            imagePath = path.join(rawDir, firstImage);
        }

        let pipeline = sharp(imagePath);

        if (rotate) {
            pipeline = pipeline.rotate(rotate, { background: { r: 0, g: 0, b: 0, alpha: 0 } });
        }
        if (flipH) {
            pipeline = pipeline.flop();
        }
        if (zoom && zoom !== 1) {
            const metadata = await sharp(imagePath).metadata();
            if (metadata.width && metadata.height) {
                const width = metadata.width;
                const height = metadata.height;

                if (zoom > 1) {
                    const cropWidth = Math.round(width / zoom);
                    const cropHeight = Math.round(height / zoom);
                    const left = Math.round((width - cropWidth) / 2);
                    const top = Math.round((height - cropHeight) / 2);

                    pipeline = pipeline.extract({ left, top, width: cropWidth, height: cropHeight })
                        .resize(width, height);
                }
            }
        }

        const buffer = await pipeline.png().toBuffer();

        return new NextResponse(buffer as any, {
            headers: {
                'Content-Type': 'image/png'
            }
        });

    } catch (error) {
        console.error('Preview error:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
