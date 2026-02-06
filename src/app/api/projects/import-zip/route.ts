import { NextRequest, NextResponse } from 'next/server';
import { importProjectZip } from '@/lib/projects';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const project = await importProjectZip(buffer);

        return NextResponse.json(project);
    } catch (error) {
        console.error('Import zip error:', error);
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Import failed' }, { status: 500 });
    }
}
