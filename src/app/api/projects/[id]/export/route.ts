import { NextRequest, NextResponse } from 'next/server';
import { createExportZip } from '@/lib/export';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const zipBuffer = await createExportZip(id);

        return new NextResponse(zipBuffer as any, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="dataset-${id}.zip"`,
            },
        });
    } catch (error) {
        console.error('Export error:', error);
        return new NextResponse('Export failed', { status: 500 });
    }
}
