import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import crypto from 'crypto';

// Shared job storage - export for use in progress polling
// TODO: In production, replace with Redis or database
export const installJobs = new Map<string, any>();

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { repo_id } = body;

        if (!repo_id) {
            return NextResponse.json(
                { error: 'repo_id is required' },
                { status: 400 }
            );
        }

        // Validate repo_id format (must be owner/repo)
        if (!repo_id.includes('/') || repo_id === 'legacy') {
            console.error(`Blocked invalid repo_id: ${repo_id}`);
            return NextResponse.json(
                { error: 'Invalid repo_id. Must be in format "owner/repo"' },
                { status: 400 }
            );
        }

        // Create job ID
        const job_id = crypto.randomUUID();

        // Initialize job
        installJobs.set(job_id, {
            status: 'starting',
            repo_id,
            progress: 0,
            downloaded_bytes: 0,
            total_bytes: 0,
            current_file: '',
            error: null
        });

        // Start download in background (don't await)
        console.log(`[WD Models] Starting download for ${repo_id} with job_id ${job_id}`);
        downloadModel(job_id, repo_id).catch(err => {
            console.error(`[WD Models] Download failed for job ${job_id}:`, err);
        });

        return NextResponse.json({ job_id });
    } catch (error) {
        console.error('Failed to start model installation:', error);
        return NextResponse.json(
            { error: 'Failed to start installation' },
            { status: 500 }
        );
    }
}

async function downloadModel(job_id: string, repo_id: string) {
    try {
        console.log(`[WD Models] [${job_id}] Starting download for ${repo_id}`);

        const modelsDir = path.join(process.cwd(), 'models', 'wd-tagger');
        const modelName = repo_id.split('/')[1];
        const modelPath = path.join(modelsDir, modelName);

        console.log(`[WD Models] [${job_id}] Creating directory: ${modelPath}`);
        // Ensure models directory exists
        await fs.mkdir(modelPath, { recursive: true });

        // Update job status
        installJobs.set(job_id, {
            ...installJobs.get(job_id),
            status: 'downloading',
            current_file: 'Preparing download...'
        });
        console.log(`[WD Models] [${job_id}] Status updated to 'downloading'`);

        // Use Python script for downloading with real progress
        const scriptPath = path.join(process.cwd(), 'scripts', 'download_hf_model.py');

        try {
            await downloadWithPythonScript(job_id, repo_id, modelPath, scriptPath);
        } catch (error: any) {
            // If Python script fails, try fallback to git clone
            console.warn(`[WD Models] [${job_id}] Python download failed, falling back to git clone:`, error.message);
            await downloadWithGit(job_id, repo_id, modelPath);
        }

        // Download successful
        installJobs.set(job_id, {
            ...installJobs.get(job_id),
            status: 'completed',
            progress: 100
        });
        console.log(`[WD Models] [${job_id}] Download completed successfully`);

    } catch (error: any) {
        console.error(`[WD Models] [${job_id}] Download failed:`, error);
        installJobs.set(job_id, {
            ...installJobs.get(job_id),
            status: 'error',
            error: error.message || 'Download failed'
        });
    }
}

async function downloadWithPythonScript(
    job_id: string,
    repo_id: string,
    modelPath: string,
    scriptPath: string
): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        console.log(`[WD Models] [${job_id}] Using Python script: ${scriptPath}`);

        // Try to use python3 first, then python
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

        const proc = spawn(pythonCmd, [scriptPath, repo_id, modelPath]);

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');

            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const progressData = JSON.parse(line);

                    // Check for error
                    if (progressData.error) {
                        console.error(`[WD Models] [${job_id}] Python error:`, progressData.error);
                        reject(new Error(progressData.error));
                        return;
                    }

                    // Update job with real progress
                    const currentJob = installJobs.get(job_id);
                    if (currentJob) {
                        installJobs.set(job_id, {
                            ...currentJob,
                            status: progressData.status || 'downloading',
                            progress: progressData.progress || 0,
                            downloaded_bytes: progressData.downloaded_bytes || 0,
                            total_bytes: progressData.total_bytes || 0,
                            current_file: progressData.current_file || ''
                        });

                        console.log(`[WD Models] [${job_id}] Progress:`, {
                            progress: progressData.progress,
                            downloaded_mb: ((progressData.downloaded_bytes || 0) / 1024 / 1024).toFixed(1),
                            total_mb: ((progressData.total_bytes || 0) / 1024 / 1024).toFixed(1),
                            file: progressData.current_file
                        });
                    }
                } catch (e) {
                    // Not JSON, might be regular output
                    stdout += line + '\n';
                }
            }
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
            console.error(`[WD Models] [${job_id}] Python stderr:`, data.toString());
        });

        proc.on('close', (code) => {
            if (code === 0) {
                console.log(`[WD Models] [${job_id}] Python download successful`);
                resolve();
            } else {
                const errorMsg = stderr || stdout || 'Python script failed';
                console.error(`[WD Models] [${job_id}] Python script exited with code ${code}:`, errorMsg);
                reject(new Error(errorMsg));
            }
        });

        proc.on('error', (err) => {
            console.error(`[WD Models] [${job_id}] Failed to spawn Python:`, err);
            reject(new Error(`Failed to run Python: ${err.message}`));
        });
    });
}

async function downloadWithGit(job_id: string, repo_id: string, modelPath: string) {
    return new Promise<void>((resolve, reject) => {
        const repoUrl = `https://huggingface.co/${repo_id}`;

        // For git clone fallback, show indeterminate progress
        installJobs.set(job_id, {
            ...installJobs.get(job_id),
            current_file: 'Cloning repository...',
            progress: 0,
            downloaded_bytes: 0,
            total_bytes: 0  // 0 indicates indeterminate progress
        });

        const proc = spawn('git', [
            'clone',
            repoUrl,
            modelPath
        ]);

        let stderr = '';

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
            // Git clone shows progress on stderr, but we can't parse bytes reliably
            // Keep progress at 0 to trigger indeterminate UI
        });

        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`git clone failed: ${stderr}`));
        });
    });
}

export async function GET(request: NextRequest) {
    // List all jobs (for debugging)
    const allJobs = Array.from(installJobs.entries()).map(([id, job]) => ({
        id,
        ...job
    }));
    return NextResponse.json({ jobs: allJobs });
}
