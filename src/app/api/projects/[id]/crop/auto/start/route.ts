import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { getProject } from '@/lib/projects';
import { runPythonScript } from '@/lib/python';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { referenceIds, mode = 'auto' } = body;

        const project = await getProject(id);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const jobId = uuidv4();
        const projectDir = path.join(process.cwd(), 'projects', id);
        const jobsDir = path.join(projectDir, 'jobs');

        await fs.mkdir(jobsDir, { recursive: true });
        const jobPath = path.join(jobsDir, `${jobId}.json`);

        // Initial job state
        const jobState = {
            id: jobId,
            type: 'auto_crop',
            status: 'pending', // pending -> processing -> completed/failed
            startTime: new Date().toISOString(),
            progress: 0,
            referenceIds,
            mode
        };

        await fs.writeFile(jobPath, JSON.stringify(jobState, null, 2));

        // Start background process
        // We don't await this promise so the response is immediate
        (async () => {
            try {
                // Update to processing
                jobState.status = 'processing';
                await fs.writeFile(jobPath, JSON.stringify(jobState, null, 2));

                // Run python script
                // args: --project-dir <path> --mode <mode> --refs <ref1> <ref2> ...
                const args = [
                    '--project-dir', projectDir,
                    '--mode', mode
                ];
                if (referenceIds && referenceIds.length > 0) {
                    args.push('--refs', ...referenceIds);
                }

                // Note: runPythonScript returns stdout string. 
                // Our script outputs JSON.
                const output = await runPythonScript('auto_crop.py', args);

                let result;
                try {
                    // Python might print other things, find the last JSON object
                    // Or assume strict JSON output.
                    // The script does print(json.dumps(...))
                    result = JSON.parse(output.trim());
                } catch (e) {
                    throw new Error('Invalid output from crop script');
                }

                if (result.status === 'error') {
                    throw new Error(result.message || 'Unknown script error');
                }

                // Update job with results
                const completedState = {
                    ...jobState,
                    status: 'completed',
                    endTime: new Date().toISOString(),
                    progress: 100,
                    result: result // contains { proposals: [...] }
                };

                await fs.writeFile(jobPath, JSON.stringify(completedState, null, 2));

            } catch (error: any) {
                console.error(`Job ${jobId} failed:`, error);
                const failedState = {
                    ...jobState,
                    status: 'failed',
                    endTime: new Date().toISOString(),
                    error: error.message
                };
                await fs.writeFile(jobPath, JSON.stringify(failedState, null, 2));
            }
        })();

        return NextResponse.json({ jobId });

    } catch (error) {
        console.error('Start auto crop error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
