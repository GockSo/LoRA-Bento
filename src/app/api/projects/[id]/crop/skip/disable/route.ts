import { NextRequest, NextResponse } from 'next/server';
import { updateProject, getProject } from '@/lib/projects';

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

        // Update Project Config
        await updateProject(id, {
            crop: {
                mode: 'normal'
            }
        });

        return NextResponse.json({
            success: true,
            mode: 'normal'
        });

    } catch (error) {
        console.error('Disable skip crop error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
