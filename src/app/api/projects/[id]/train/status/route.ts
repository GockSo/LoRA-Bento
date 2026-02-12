import { NextRequest, NextResponse } from 'next/server';
import { trainingManager } from '@/lib/training';
import path from 'path';
import fs from 'fs/promises';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Simple polling endpoint
    const status = trainingManager.getJobStatus(id);

    // Also get output count for dashboard
    let outputsCount = 0;
    try {
        const projectDir = path.join(process.cwd(), 'projects', id);
        const outputsDir = path.join(projectDir, 'train_outputs');
        // Check if dir exists first to avoid error on readdir
        await fs.access(outputsDir);
        const files = await fs.readdir(outputsDir);
        outputsCount = files.filter(f => !f.startsWith('.')).length;
    } catch {
        // Ignore, 0 is fine
    }

    return NextResponse.json({ ...status, outputsCount });
}
