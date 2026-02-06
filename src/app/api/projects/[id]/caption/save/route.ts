
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { filename, content } = body;

        const projectDir = path.join(process.cwd(), 'projects', id);
        const processedDir = path.join(projectDir, 'processed');

        // Security check path
        const safeName = path.basename(filename);
        const txtPath = path.join(processedDir, `${path.parse(safeName).name}.txt`);

        await fs.writeFile(txtPath, content);

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }
}
