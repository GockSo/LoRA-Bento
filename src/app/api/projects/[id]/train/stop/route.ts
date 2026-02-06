import { NextRequest, NextResponse } from 'next/server';
import { trainingManager } from '@/lib/training';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        await trainingManager.stopTraining(id);
        return NextResponse.json({ ok: true });
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || 'Failed to stop training' },
            { status: 500 }
        );
    }
}
