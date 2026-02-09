import { NextResponse } from 'next/server';
import {
    isGitInstalled,
    isInsideWorkTree,
    fetchTags,
    getLatestTag,
    getCurrentHash,
    getCurrentBranch,
    getBehindCount,
    runGit
} from '@/lib/git';

export async function GET() {
    try {
        const gitInstalled = await isGitInstalled();
        if (!gitInstalled) {
            return NextResponse.json({
                ok: true,
                gitInstalled: false,
                updateAvailable: false,
                message: 'Git is not installed or not found in PATH.'
            });
        }

        const insideWorkTree = await isInsideWorkTree();
        if (!insideWorkTree) {
            return NextResponse.json({
                ok: true,
                gitInstalled: true,
                repo: false,
                updateAvailable: false,
                message: 'Application is not running inside a Git repository.'
            });
        }

        // Fetch latest info
        await fetchTags();

        const [branch, currentHash, latestTag] = await Promise.all([
            getCurrentBranch(),
            getCurrentHash(),
            getLatestTag()
        ]);

        let behind = 0;
        if (branch && branch !== 'HEAD') {
            behind = await getBehindCount(branch);
        }

        // Determine if update is available
        // Logic:
        // 1. If we have a latest tag, and it's different from our current tag (if we were on a tag)... 
        //    Actually, simple check: if strict semantic versioning, we can compare.
        //    But "current tag" is hard if we are just on a commit.
        //    Let's rely on:
        //    a) If latestTag exists, and `currentHash` is NOT the hash of `latestTag`? 
        //       Refining: the user requirement says "Update to latest tag (vX.Y.Z) OR latest main".
        //       So if there is a tag v0.7.0, and we are not on it, show update.
        //       But we might be AHEAD of it (dev version).
        //       For simplicity/safety: default to showing update if `latestTag` exists.
        //       User can check "Current: short hash".

        // Better logic:
        // If behind > 0, definitely update available (for branch mode).
        // If latestTag is present, we should probably check if current HEAD == latestTag's commit.
        // But for now, let's just return the data and let the frontend decide or user decide.
        // actually, the requirement said: "(behind>0) OR (latestTag differs from currentTag)"

        // To strictly check if we are ON the latest tag:
        // We could run `git describe --tags --exact-match HEAD` to see if we are currently on a tag.

        let currentTag = null;
        try {
            // Only if we are exactly on a tag
            const { stdout } = await runGit(['describe', '--tags', '--exact-match', 'HEAD']);
            currentTag = stdout.trim();
        } catch {
            // Not on a tag
        }

        const updateAvailable = (behind > 0) || (latestTag !== null && latestTag !== currentTag);

        return NextResponse.json({
            ok: true,
            repo: true,
            gitInstalled: true,
            branch,
            currentHash,
            currentTag,
            latestTag,
            behind,
            updateAvailable
        });

    } catch (error) {
        console.error('Update check failed:', error);
        return NextResponse.json(
            { ok: false, error: 'Failed to check for updates.' },
            { status: 500 }
        );
    }
}
