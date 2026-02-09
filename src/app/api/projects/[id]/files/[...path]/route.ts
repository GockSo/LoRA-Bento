import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
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
        const filePath = path.join(projectDir, ...pathSegments);

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

            const fileBuffer = await fs.readFile(filePath);
            const contentType = mime.getType(filePath) || 'application/octet-stream';

            return new NextResponse(fileBuffer as any, {
                headers: {
                    'Content-Type': contentType,
                    'Cache-Control': 'private, no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0'
                }
            });
        } catch {
            return new NextResponse('File not found', { status: 404 });
        }
    } catch (error) {
        console.error('File serve error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
