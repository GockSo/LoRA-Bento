import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; imageId: string }> }
) {
    try {
        const { id, imageId } = await params;

        // Parse imageId (format: "subdir/filename.jpg")
        const imagePath = path.join(process.cwd(), 'projects', id, 'train_data', imageId);

        // Serve the image file
        const imageBuffer = await fs.readFile(imagePath);
        const ext = path.extname(imageId).toLowerCase();

        const contentTypes: Record<string, string> = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.webp': 'image/webp'
        };

        return new NextResponse(imageBuffer, {
            headers: {
                'Content-Type': contentTypes[ext] || 'image/jpeg',
                'Cache-Control': 'public, max-age=31536000, immutable'
            }
        });
    } catch (error) {
        return NextResponse.json(
            { error: 'Image not found' },
            { status: 404 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; imageId: string }> }
) {
    try {
        const { id, imageId } = await params;
        const body = await request.json();
        const { tags } = body;

        if (!Array.isArray(tags)) {
            return NextResponse.json(
                { error: 'Tags must be an array' },
                { status: 400 }
            );
        }

        // Get .txt file path
        const imagePath = path.join(process.cwd(), 'projects', id, 'train_data', imageId);
        const txtPath = imagePath.replace(/\.(jpg|jpeg|png|webp)$/i, '.txt');

        // Write tags to .txt file
        const tagContent = tags.join(', ');
        await fs.writeFile(txtPath, tagContent, 'utf-8');

        return NextResponse.json({ success: true, tags });
    } catch (error) {
        console.error('Failed to save tags:', error);
        return NextResponse.json(
            { error: 'Failed to save tags' },
            { status: 500 }
        );
    }
}
