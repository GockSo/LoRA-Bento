import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import AdmZip from 'adm-zip';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = new URL(request.url);
        const filename = url.searchParams.get('file');
        const downloadAll = url.searchParams.get('all') === 'true';

        const projectDir = path.join(process.cwd(), 'projects', id);
        const outputsDir = path.join(projectDir, 'train_outputs');

        // Check if outputs directory exists
        try {
            await fs.access(outputsDir);
        } catch {
            return new NextResponse('Outputs directory not found', { status: 404 });
        }

        // Handle "Download All" as Zip
        if (downloadAll) {
            const zip = new AdmZip();
            // Add local folder to zip
            zip.addLocalFolder(outputsDir);

            const zipBuffer = zip.toBuffer();

            return new NextResponse(zipBuffer as any, {
                headers: {
                    'Content-Type': 'application/zip',
                    'Content-Disposition': `attachment; filename="${id}_outputs.zip"`,
                },
            });
        }

        // Handle Single File Download
        if (!filename) {
            return new NextResponse('Filename is required', { status: 400 });
        }

        // Security check: prevent directory traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return new NextResponse('Invalid filename', { status: 400 });
        }

        const filePath = path.join(outputsDir, filename);

        try {
            await fs.access(filePath);
        } catch {
            return new NextResponse('File not found', { status: 404 });
        }

        const stats = await fs.stat(filePath);
        const stream = createReadStream(filePath) as any;

        return new NextResponse(stream, {
            headers: {
                'Content-Length': stats.size.toString(),
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        console.error('Download error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
