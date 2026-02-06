import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; jobId: string }> }) {
    const { id, jobId } = await params;

    // Security check: ensure jobId is safe (basic alphanumeric)
    if (!/^[a-z0-9-]+$/i.test(jobId)) {
        return NextResponse.json({ error: 'Invalid Job ID' }, { status: 400 });
    }

    const projectDir = path.join(process.cwd(), 'projects', id);
    const jobsDir = path.join(projectDir, 'jobs');
    const jobPath = path.join(jobsDir, `${jobId}.json`);

    try {
        const data = await fs.readFile(jobPath, 'utf-8');
        const job = JSON.parse(data);
        return NextResponse.json(job);
    } catch {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
}
