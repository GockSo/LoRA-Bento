import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { checkpointPath, projectId } = body;

        if (!checkpointPath) {
            return NextResponse.json(
                { error: 'checkpointPath is required' },
                { status: 400 }
            );
        }

        // Path to the python script
        const scriptPath = path.join(process.cwd(), 'scripts', 'detect_model.py');
        const repoPath = path.join(process.cwd(), 'train_script', 'sd-scripts'); // Hardcoded default for now based on context, or configurable

        // Use python from environment or specific path if needed. 
        // Assuming 'python' is available in PATH for now as per other scripts in this project likely do.
        const pythonProcess = spawn('python', [
            scriptPath,
            '--checkpoint_path', checkpointPath,
            '--repo_path', repoPath
        ]);

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
        });

        const result: any = await new Promise((resolve, reject) => {
            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error('Model detection failed:', stderrData);
                    reject(new Error(`Process exited with code ${code}: ${stderrData}`));
                    return;
                }
                try {
                    resolve(JSON.parse(stdoutData));
                } catch (e) {
                    // Sometimes stdout might contain other logs if not careful, 
                    // but our script should only print JSON to stdout.
                    // valid json search
                    const jsonStart = stdoutData.indexOf('{');
                    const jsonEnd = stdoutData.lastIndexOf('}');
                    if (jsonStart !== -1 && jsonEnd !== -1) {
                        try {
                            const parsed = JSON.parse(stdoutData.substring(jsonStart, jsonEnd + 1));
                            // Inject repoPath into result so frontend knows it
                            if (typeof parsed === 'object' && parsed !== null) {
                                parsed.repoPath = repoPath;
                            }
                            resolve(parsed);
                        } catch (parseErr) {
                            reject(new Error(`Failed to parse JSON output: ${parseErr}`));
                        }
                    } else {
                        reject(new Error('Invalid output format from detection script'));
                    }
                }
            });

            pythonProcess.on('error', (err) => {
                reject(err);
            });
        });

        return NextResponse.json(result);

    } catch (error: any) {
        console.error('Error in detect-model:', error);
        return NextResponse.json(
            {
                error: error.message || 'Internal server error',
                supported: false,
                modelFamily: 'Unknown',
                reason: 'Internal Server Error during detection'
            },
            { status: 500 }
        );
    }
}
