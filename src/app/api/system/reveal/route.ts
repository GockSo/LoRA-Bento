import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

export async function POST(request: NextRequest) {
    try {
        const { path: targetPath } = await request.json();

        if (!targetPath) {
            return NextResponse.json(
                { error: 'Path is required' },
                { status: 400 }
            );
        }

        // Security: Ensure path is absolute and within allowed directories (projects)
        const allowedRoot = path.resolve(process.cwd(), 'projects');
        const resolvedPath = path.resolve(targetPath);

        if (!resolvedPath.startsWith(allowedRoot)) {
            return NextResponse.json(
                { error: 'Path not allowed' },
                { status: 403 }
            );
        }

        const platform = os.platform();
        let command = '';
        let args: string[] = [];

        if (platform === 'win32') {
            command = 'explorer.exe';
            args = ['/select,', resolvedPath];
        } else if (platform === 'darwin') {
            command = 'open';
            args = ['-R', resolvedPath];
        } else if (platform === 'linux') {
            // Linux is tricky, try xdg-open on parent dir as generic fallback
            // Most linux file managers don't support "select file" cleanly via cli standard
            command = 'xdg-open';
            args = [path.dirname(resolvedPath)];
        } else {
            return NextResponse.json(
                { error: `Platform ${platform} not supported for reveal` },
                { status: 400 }
            );
        }

        console.log(`Revealing file: ${command} ${args.join(' ')}`);

        // Spawn detached process so we don't wait for UI to close
        const proc = spawn(command, args, {
            detached: true,
            stdio: 'ignore'
        });

        proc.unref();

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to reveal file:', error);
        return NextResponse.json(
            { error: 'Failed to reveal file' },
            { status: 500 }
        );
    }
}
