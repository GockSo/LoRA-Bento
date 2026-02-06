import { NextRequest, NextResponse } from 'next/server';
import { exportProjectZip, getProject } from '@/lib/projects';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const project = await getProject(id);

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const zipBuffer = await exportProjectZip(id);

        // Sanitize filename
        const safeName = project.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const filename = `LoRABento_${safeName}_${project.id.slice(0, 8)}.zip`;

        return new NextResponse(zipBuffer as unknown as BodyInit, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${filename}"`
            }
        });
    } catch (error) {
        console.error('Export zip error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
