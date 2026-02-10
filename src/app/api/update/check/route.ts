import { NextResponse } from 'next/server';
import {
    isGitInstalled,
    isInsideWorkTree,
    getLatestTag,
    getCurrentHash,
    getCurrentBranch,
    runGit,
} from '@/lib/git';

function parseLsRemoteLine(stdout: string): string | null {
    // format: "<hash>\t<ref>"
    const line = stdout.split('\n').map((l) => l.trim()).filter(Boolean)[0];
    if (!line) return null;
    const [hash] = line.split(/\s+/);
    return hash || null;
}

async function getOriginBranchHash(branch: string): Promise<string | null> {
    try {
        // Read remote HEAD hash for this branch without fetching/updating local refs
        const { stdout } = await runGit(['ls-remote', '--heads', 'origin', branch]);
        return parseLsRemoteLine(stdout);
    } catch {
        return null;
    }
}

async function getOriginTagHash(tag: string): Promise<string | null> {
    try {
        // Read remote tag hash without fetching/updating local refs
        // We query refs/tags/<tag> directly.
        const { stdout } = await runGit([
            'ls-remote',
            '--tags',
            '--refs',
            'origin',
            `refs/tags/${tag}`,
        ]);
        return parseLsRemoteLine(stdout);
    } catch {
        return null;
    }
}

async function getBehindCountFromHash(originHash: string): Promise<number> {
    try {
        // commits in originHash that are not in HEAD => "behind"
        const { stdout } = await runGit(['rev-list', '--count', `HEAD..${originHash}`]);
        const n = parseInt(stdout.trim(), 10);
        return Number.isFinite(n) ? n : 0;
    } catch {
        return 0;
    }
}

export async function GET() {
    try {
        const gitInstalled = await isGitInstalled();
        if (!gitInstalled) {
            return NextResponse.json({
                ok: true,
                gitInstalled: false,
                updateAvailable: false,
                message: 'Git is not installed or not found in PATH.',
            });
        }

        const insideWorkTree = await isInsideWorkTree();
        if (!insideWorkTree) {
            return NextResponse.json({
                ok: true,
                gitInstalled: true,
                repo: false,
                updateAvailable: false,
                message: 'Application is not running inside a Git repository.',
            });
        }

        // IMPORTANT:
        // This endpoint MUST be read-only and must NOT mutate local refs/working tree.
        // So we DO NOT call `git fetch` here.
        const [branch, currentHash, latestTag] = await Promise.all([
            getCurrentBranch(),
            getCurrentHash(),
            getLatestTag(), // should be remote-based in lib/git.ts (ls-remote)
        ]);

        // Determine current tag (only if exactly on a tag)
        let currentTag: string | null = null;
        try {
            const { stdout } = await runGit(['describe', '--tags', '--exact-match', 'HEAD']);
            currentTag = stdout.trim() || null;
        } catch {
            // not on a tag
        }

        // Branch behind count (remote) WITHOUT fetch
        let originHash: string | null = null;
        let behind = 0;

        if (branch && branch !== 'HEAD') {
            originHash = await getOriginBranchHash(branch);
            if (originHash) {
                behind = await getBehindCountFromHash(originHash);
            }
        }

        // Tag-based update check (remote) WITHOUT fetch
        let latestTagHash: string | null = null;
        if (latestTag) {
            latestTagHash = await getOriginTagHash(latestTag);
        }

        // Determine if update available
        // - if behind > 0 => update available (branch mode)
        // - else if latestTag exists and HEAD is not that tag's commit => update available
        // - else if latestTag differs from currentTag => update available (simple UI hint)
        let updateAvailable = false;

        if (behind > 0) {
            updateAvailable = true;
        } else if (latestTag && latestTagHash) {
            // currentHash is short; compare using short prefix match
            updateAvailable = !latestTagHash.startsWith(currentHash);
        } else if (latestTag && latestTag !== currentTag) {
            updateAvailable = true;
        }

        return NextResponse.json({
            ok: true,
            repo: true,
            gitInstalled: true,
            branch,
            currentHash,
            currentTag,
            latestTag,
            behind,
            originHash,
            latestTagHash,
            updateAvailable,
        });
    } catch (error) {
        console.error('Update check failed:', error);
        return NextResponse.json(
            { ok: false, error: 'Failed to check for updates.' },
            { status: 500 }
        );
    }
}
