import { NextRequest, NextResponse } from 'next/server';
import { trainingManager } from '@/lib/training';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    // Simple polling endpoint
    const status = trainingManager.getJobStatus(id);

    return NextResponse.json(status);
}
