import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { safeDelete } from '@/lib/files';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const projectDir = path.join(process.cwd(), 'projects', id);
        const outputsDir = path.join(projectDir, 'train_outputs');

        try {
            await fs.access(outputsDir);
        } catch {
            // Return empty list or 0 count if directory doesn't exist
            const url = new URL(request.url);
            if (url.searchParams.get('count') === 'true') {
                return NextResponse.json({ count: 0 });
            }
            return NextResponse.json({ files: [] });
        }

        const files = await fs.readdir(outputsDir);

        // Handle count request
        const url = new URL(request.url);
        if (url.searchParams.get('count') === 'true') {
            // Filter out directories if necessary, but readdir usually returns everything.
            // A quick length is usually sufficient for polling, but let's be accurate and filter valid files if performance allows.
            // For raw polling speed on potentially many files, just `files.length` might include junk, 
            // but standard file systems it's okay. Let's do a quick filter for hidden files/dirs if we want to be precise,
            // or just return length.
            // Let's filter simple dotfiles at least.
            const validFiles = files.filter(f => !f.startsWith('.'));
            return NextResponse.json({ count: validFiles.length });
        }

        const fileStats = await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(outputsDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    if (stats.isDirectory()) return null;

                    return {
                        name: file,
                        size: stats.size,
                        date: stats.mtime.toISOString(),
                        type: path.extname(file).replace('.', '') || 'unknown',
                        path: filePath // Absolute path for reveal (legacy support, but we'll use download mainly)
                    };
                } catch {
                    return null;
                }
            })
        );

        const validFiles = fileStats
            .filter((f): f is NonNullable<typeof f> => f !== null)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json({ files: validFiles });
    } catch (error) {
        console.error('Failed to list outputs:', error);
        return NextResponse.json(
            { error: 'Failed to list output files' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { filename } = await request.json();

        if (!filename) {
            return NextResponse.json(
                { error: 'Filename is required' },
                { status: 400 }
            );
        }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const filePath = path.join(projectDir, 'train_outputs', filename);

        // Security check: ensure file is within train_outputs
        const outputsDir = path.join(projectDir, 'train_outputs');
        const resolvedPath = path.resolve(filePath);

        if (!resolvedPath.startsWith(path.resolve(outputsDir))) {
            return NextResponse.json(
                { error: 'Invalid file path' },
                { status: 403 }
            );
        }

        await fs.unlink(resolvedPath);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete output:', error);
        return NextResponse.json(
            { error: 'Failed to delete file' },
            { status: 500 }
        );
    }
}
