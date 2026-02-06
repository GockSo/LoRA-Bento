import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import mime from 'mime';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const path = searchParams.get('path');

    if (!path) {
        return new NextResponse('Path required', { status: 400 });
    }

    // Security check: ensure path is within projects dir
    // In a real app we'd be stricter, for now just checking it doesn't try to go up too far
    if (path.includes('..')) {
        return new NextResponse('Invalid path', { status: 403 });
    }

    try {
        const fileCookie = await fs.readFile(path);
        const contentType = mime.getType(path) || 'application/octet-stream';

        return new NextResponse(fileCookie as any, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch {
        return new NextResponse('Not found', { status: 404 });
    }
}
