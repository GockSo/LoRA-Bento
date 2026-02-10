import { spawn } from 'child_process';

const REPO_ROOT = process.cwd();

interface GitResult {
    stdout: string;
    stderr: string;
}

export async function runGit(
    args: string[],
    cwd: string = REPO_ROOT
): Promise<GitResult> {
    return new Promise((resolve, reject) => {
        const child = spawn('git', args, {
            cwd,
            windowsHide: true,
            env: process.env,
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
            } else {
                const error = new Error(
                    `Git command failed: git ${args.join(' ')}\n${stderr}`
                );
                (error as any).code = code;
                (error as any).stderr = stderr;
                reject(error);
            }
        });

        child.on('error', (err) => {
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
        await runGit(['reset', '--hard', 'head']);

        await runGit(['clean', '-fdx']);

        // Only check for modified/deleted tracked files, ignore untracked files
        const { stdout } = await runGit([
            'status',
            '--porcelain',
            '--untracked-files=no',
        ]);
        return stdout.length > 0;
    } catch {
        return true; // Assume dirty on error for safety
    }
}

export async function getUntrackedFiles(): Promise<string[]> {
    try {
        const { stdout } = await runGit(['ls-files', '--others', '--exclude-standard']);
        return stdout.split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

export async function hasStagedChanges(): Promise<boolean> {
    try {
        const { stdout } = await runGit(['diff', '--cached', '--name-only']);
        return stdout.length > 0;
    } catch {
        return false;
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

/**
 * Fetch latest remote refs + tags.
 * - --force: update tags if they were moved
 * - --prune: remove deleted remote refs
 * - try --prune-tags (newer git) to remove deleted remote tags
 */
export async function fetchTags() {
    await runGit(['fetch', 'origin', '--tags', '--force', '--prune']);
    try {
        await runGit(['fetch', 'origin', '--prune-tags']);
    } catch {
        // git version may not support --prune-tags; ignore
    }
}

function parseSemver(tag: string) {
    // v1.2.3 or v1.2.3-rc1 (simple support)
    const m = tag.match(/^v(\d+)\.(\d+)\.(\d+)(.*)?$/);
    if (!m) return null;
    return {
        major: Number(m[1]),
        minor: Number(m[2]),
        patch: Number(m[3]),
        suffix: (m[4] ?? '').trim(), // "" means stable
        raw: tag,
    };
}

function compareSemverDesc(a: string, b: string) {
    const A = parseSemver(a);
    const B = parseSemver(b);

    // Prefer proper semver tags, fallback to lexicographic
    if (!A && !B) return b.localeCompare(a);
    if (!A) return 1;
    if (!B) return -1;

    if (A.major !== B.major) return B.major - A.major;
    if (A.minor !== B.minor) return B.minor - A.minor;
    if (A.patch !== B.patch) return B.patch - A.patch;

    // Stable (no suffix) should come before prerelease
    const aStable = A.suffix === '';
    const bStable = B.suffix === '';
    if (aStable && !bStable) return -1;
    if (!aStable && bStable) return 1;

    // Both stable or both prerelease: fallback suffix compare
    return B.suffix.localeCompare(A.suffix);
}

/**
 * Get latest tag from REMOTE (origin) so we don't rely on local tags.
 * This fixes "tag updated but app still sees old tag" cases.
 */
export async function getLatestTag(): Promise<string | null> {
    try {
        // Example line: "<hash>\trefs/tags/v1.2.3"
        const { stdout } = await runGit(['ls-remote', '--tags', '--refs', 'origin', 'v*']);
        const tags = stdout
            .split('\n')
            .map((line) => line.split('\t')[1])
            .filter(Boolean)
            .map((ref) => ref.replace('refs/tags/', '').trim())
            .filter((t) => t.startsWith('v'));

        tags.sort(compareSemverDesc);
        return tags[0] ?? null;
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
            `HEAD...origin/${branch}`,
        ]);
        // Output format: "ahead\tbehind"
        const parts = stdout.split(/\s+/);
        if (parts.length >= 2) return parseInt(parts[1], 10);
        return 0;
    } catch {
        return 0;
    }
}

/**
 * Checkout a tag safely:
 * - ensure the tag object exists locally (fetch the tag ref)
 * - force checkout to avoid "stale working tree" weirdness
 */
export async function checkoutTag(tag: string) {

    // Make sure the tag exists locally even if local tags are stale
    await runGit(['fetch', 'origin', 'tag', tag, '--force']);
    // Detached HEAD at tag (expected behavior for tag checkout)
    await runGit(['checkout', '-f', tag]);
}

export async function pullBranch(branch: string) {
    await runGit(['pull', '--ff-only', 'origin', branch]);
}
