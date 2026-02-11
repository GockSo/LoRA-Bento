import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import mime from 'mime';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; path: string[] }> }
) {
    try {
        const { id, path: pathSegments } = await params;

        // Path segments should be ["subdir", "filename.png"] or just ["filename.png"]
        // But our sync logic creates subdirs, so it's likely ["subdir", "filename.png"]

        if (!pathSegments || pathSegments.length === 0) {
            return new NextResponse('Not found', { status: 404 });
        }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const trainDataDir = path.join(projectDir, 'train_data');

        // Construct file path
        const filePath = path.join(trainDataDir, ...pathSegments);

        // Security check: ensure path is within trainDataDir
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(trainDataDir))) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        try {
            await fs.access(filePath);
            const fileBuffer = await fs.readFile(filePath);
            const contentType = mime.getType(filePath) || 'application/octet-stream';

            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'public, max-age=3600'
                }
            });
        } catch {
            return new NextResponse('Not found', { status: 404 });
        }
    } catch (error) {
        console.error('Error serving image:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
