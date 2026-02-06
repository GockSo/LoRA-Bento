import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject, updateProjectStats } from '@/lib/projects';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const formData = await req.formData();
        const files = formData.getAll('files') as File[];
        const { id } = await params;
        const projectId = id;

        if (!files.length) {
            return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
        }

        const project = await getProject(projectId);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const projectsDir = path.join(process.cwd(), 'projects');
        const importDir = path.join(projectsDir, projectId, 'raw');

        const results = [];

        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Sanitize name or generate new one to avoid collisions
            const ext = path.extname(file.name);
            // const name = `${uuidv4()}${ext}`; // Optionally rename
            const name = file.name; // Keep original name for now, maybe check collision

            const filePath = path.join(importDir, name);
            await fs.writeFile(filePath, buffer);

            results.push({ name, path: filePath });
        }

        await updateProjectStats(projectId);

        return NextResponse.json({ imported: results.length });
    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
