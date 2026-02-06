import { NextRequest, NextResponse } from 'next/server';
import { trainingManager, TrainingConfig } from '@/lib/training';
import path from 'path';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const body = await req.json();
        const { config, trainerScriptPath, pythonPath } = body;

        if (!config || !trainerScriptPath) {
            return NextResponse.json(
                { error: 'Missing config or trainerScriptPath' },
                { status: 400 }
            );
        }

        // Validate basic config fields if necessary
        // ...

        // Ensure output dir is absolute or relative to CWD correctly
        // If config.outputDir is provided relative, resolve it? 
        // For now, assume frontend sends valid paths or handle resolution here.

        // Ensure processed dir path is correct for the project
        // We enforce the train_data_dir to be the processed folder of this project
        // But trainingManager.constructArgs does this logic? 
        // Let's rely on TrainingManager or pass the processed path explicitly if needed.

        // Actually, let's fix the TrainingManager's reliance on hardcoded path replacement
        // by verifying path here or letting the frontend pass the correct absolute path.
        // Frontend likely constructs the config. Let's start the job.

        const runId = await trainingManager.startTraining(
            id,
            config as TrainingConfig,
            pythonPath, // Optional, defaults to 'python'
            trainerScriptPath
        );

        return NextResponse.json({ runId, status: 'started' });

    } catch (error: any) {
        console.error('Failed to start training:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to start training' },
            { status: 500 }
        );
    }
}
