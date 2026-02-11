import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const projectDir = path.join(process.cwd(), 'projects', id);
        const resizedDir = path.join(projectDir, 'resized');

        try {
            await fs.access(resizedDir);
            const files = await fs.readdir(resizedDir);
            // Count image files
            const count = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).length;
            return NextResponse.json({ count });
        } catch {
            // resized dir doesn't exist
            return NextResponse.json({ count: 0 });
        }
    } catch (error) {
        console.error('Failed to check resized images:', error);
        return NextResponse.json(
            { error: 'Failed to duplicate' },
            { status: 500 }
        );
    }
}
