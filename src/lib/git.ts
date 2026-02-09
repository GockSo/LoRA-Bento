import { spawn } from 'child_process';
import path from 'path';

const REPO_ROOT = process.cwd();

interface GitResult {
    stdout: string;
    stderr: string;
}

export async function runGit(args: string[], cwd: string = REPO_ROOT): Promise<GitResult> {
    return new Promise((resolve, reject) => {
        const process = spawn('git', args, { cwd });
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
            } else {
                const error = new Error(`Git command failed: git ${args.join(' ')}\n${stderr}`);
                (error as any).code = code;
                (error as any).stderr = stderr;
                reject(error);
            }
        });

        process.on('error', (err) => {
            reject(err);
        });
    });
}

export async function isGitInstalled(): Promise<boolean> {
    try {
        await runGit(['--version']);
        return true;
    } catch {
        return false;
    }
}

export async function isInsideWorkTree(): Promise<boolean> {
    try {
        const { stdout } = await runGit(['rev-parse', '--is-inside-work-tree']);
        return stdout === 'true';
    } catch {
        return false;
    }
}

export async function isDirty(): Promise<boolean> {
    try {
        const { stdout } = await runGit(['status', '--porcelain']);
        return stdout.length > 0;
    } catch {
        return true; // Assume dirty on error for safety
    }
}

export async function getCurrentBranch(): Promise<string> {
    const { stdout } = await runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    return stdout;
}

export async function getCurrentHash(): Promise<string> {
    const { stdout } = await runGit(['rev-parse', '--short', 'HEAD']);
    return stdout;
}

export async function fetchTags() {
    await runGit(['fetch', '--tags', 'origin']);
}

export async function getLatestTag(): Promise<string | null> {
    try {
        // Sort by version refname properly
        const { stdout } = await runGit(['tag', '--list', 'v*', '--sort=-v:refname']);
        const tags = stdout.split('\n').filter(Boolean);
        return tags.length > 0 ? tags[0] : null;
    } catch {
        return null;
    }
}

export async function getBehindCount(branch: string): Promise<number> {
    try {
        // Assumes origin is the remote
        const { stdout } = await runGit([
            'rev-list',
            '--left-right',
            '--count',
            `HEAD...origin/${branch}`
        ]);
        // Output format: "ahead\tbehind"
        const parts = stdout.split(/\s+/);
        if (parts.length >= 2) {
            return parseInt(parts[1], 10);
        }
        return 0;
    } catch {
        return 0;
    }
}

export async function checkoutTag(tag: string) {
    await runGit(['checkout', tag]);
}

export async function pullBranch(branch: string) {
    await runGit(['pull', '--ff-only', 'origin', branch]);
}
