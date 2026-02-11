import { NextResponse } from 'next/server';
import { installJobs } from '../route';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ job_id: string }> }
) {
    try {
        const { job_id } = await params;

        // Get job status from shared storage
        const job = installJobs.get(job_id);

        if (!job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(job);
    } catch (error) {
        return NextResponse.json(
            { error: 'Failed to get job status' },
            { status: 500 }
        );
    }
}
