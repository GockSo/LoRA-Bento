import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const searchParams = req.nextUrl.searchParams;
        const jobId = searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
        }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const jobPath = path.join(projectDir, 'jobs', `${jobId}.json`);

        try {
            const data = await fs.readFile(jobPath, 'utf-8');
            const job = JSON.parse(data);
            return NextResponse.json(job);
        } catch {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

    } catch (error) {
        console.error('Get auto crop results error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
