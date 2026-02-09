import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const trainScriptDir = path.join(process.cwd(), 'train_script');
    const sdScriptsDir = path.join(trainScriptDir, 'sd-scripts');
    const gitDir = path.join(sdScriptsDir, '.git');

    try {
        // Step 1: Ensure train_script directory exists
        await fs.mkdir(trainScriptDir, { recursive: true });

        // Step 2: Check if sd-scripts is already cloned (idempotent)
        try {
            await fs.access(gitDir);
            // Already exists, return ready immediately
            return NextResponse.json({
                status: 'ready',
                message: 'sd-scripts already set up',
                logs: []
            });
        } catch {
            // .git doesn't exist, proceed with clone
        }

        // Step 3: Clone the repository with streaming logs
        const logs: string[] = [];
        let hasError = false;
        let errorMessage = '';

        await new Promise<void>((resolve, reject) => {
            const gitProcess = spawn('git', [
                'clone',
                'https://github.com/kohya-ss/sd-scripts',
                sdScriptsDir
            ], {
                cwd: trainScriptDir,
                env: process.env
            });

            gitProcess.stdout?.on('data', (data) => {
                const line = data.toString().trim();
                if (line) {
                    logs.push(`[stdout] ${line}`);
                }
            });

            gitProcess.stderr?.on('data', (data) => {
                const line = data.toString().trim();
                if (line) {
                    logs.push(`[stderr] ${line}`);
                }
            });

            gitProcess.on('error', (err) => {
                hasError = true;

                // Check if git is not found
                if (err.message.includes('ENOENT') || err.message.includes('not found')) {
                    errorMessage = 'Git is required for Local Training. Please install Git and restart LoRA Bento.';
                } else {
                    errorMessage = `Failed to start git process: ${err.message}`;
                }

                reject(new Error(errorMessage));
            });

            gitProcess.on('close', (code) => {
                if (code === 0) {
                    logs.push('Clone completed successfully');
                    resolve();
                } else {
                    hasError = true;
                    errorMessage = `Git clone failed with exit code ${code}`;
                    reject(new Error(errorMessage));
                }
            });
        });

        // Success
        return NextResponse.json({
            status: 'ready',
            message: 'sd-scripts setup complete',
            logs
        });

    } catch (error: any) {
        // Check for git-specific errors
        const isGitNotFound = error.message?.includes('Git is required') ||
            error.message?.includes('ENOENT') ||
            error.message?.includes('not found');

        return NextResponse.json({
            status: 'error',
            message: isGitNotFound
                ? 'Git is required for Local Training. Please install Git and restart LoRA Bento.'
                : error.message || 'Failed to set up sd-scripts',
            logs: [],
            isGitNotFound
        }, { status: isGitNotFound ? 424 : 500 });
    }
}
