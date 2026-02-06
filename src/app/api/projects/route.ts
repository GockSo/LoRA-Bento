import { NextRequest, NextResponse } from 'next/server';
import { createProject, getProjects } from '@/lib/projects';

export async function GET() {
    const projects = await getProjects();
    return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { name } = body;

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const project = await createProject(name);
        return NextResponse.json(project);
    } catch (error) {
        console.error('Create project error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
