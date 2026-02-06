import { NextRequest, NextResponse } from 'next/server';
import { renameProject, deleteProject, getProject } from '@/lib/projects';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const project = await getProject(id);

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        return NextResponse.json(project);
    } catch (error) {
        console.error('Get project error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { name } = body;

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const project = await renameProject(id, name);
        return NextResponse.json(project);
    } catch (error) {
        console.error('Rename project error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await deleteProject(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Delete project error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
