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

        // Use huggingface-cli to download (if available)
        // Otherwise, use git clone or manual download
        const useHfCli = await checkHfCli();
        console.log(`[WD Models] [${job_id}] huggingface-cli available: ${useHfCli}`);

        if (useHfCli) {
            console.log(`[WD Models] [${job_id}] Using huggingface-cli download`);
            await downloadWithHfCli(job_id, repo_id, modelPath);
        } else {
            console.log(`[WD Models] [${job_id}] Falling back to git clone`);
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

async function checkHfCli(): Promise<boolean> {
    try {
        await new Promise<void>((resolve, reject) => {
            const proc = spawn('huggingface-cli', ['--version']);
            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject();
            });
        });
        return true;
    } catch {
        return false;
    }
}

async function downloadWithHfCli(job_id: string, repo_id: string, modelPath: string) {
    return new Promise<void>((resolve, reject) => {
        const proc = spawn('huggingface-cli', [
            'download',
            repo_id,
            '--local-dir', modelPath,
            '--local-dir-use-symlinks', 'False'
        ]);

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
            stdout += data.toString();
            // Try to parse progress from output
            const progressMatch = stdout.match(/(\d+)%/);
            if (progressMatch) {
                const progress = parseInt(progressMatch[1]);
                installJobs.set(job_id, {
                    ...installJobs.get(job_id),
                    progress,
                    current_file: 'Downloading model files...'
                });
            }
        });

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        proc.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`huggingface-cli failed: ${stderr}`));
        });
    });
}

async function downloadWithGit(job_id: string, repo_id: string, modelPath: string) {
    return new Promise<void>((resolve, reject) => {
        const repoUrl = `https://huggingface.co/${repo_id}`;

        installJobs.set(job_id, {
            ...installJobs.get(job_id),
            current_file: 'Cloning repository...',
            progress: 50
        });

        const proc = spawn('git', [
            'clone',
            repoUrl,
            modelPath
        ]);

        let stderr = '';

        proc.stderr.on('data', (data) => {
            stderr += data.toString();
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
