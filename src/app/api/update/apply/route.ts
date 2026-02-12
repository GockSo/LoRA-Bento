import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { isDirty, fetchTags, hasStagedChanges, getUntrackedFiles } from '@/lib/git';

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { mode, tag } = body;

    if (!mode || (mode === 'tag' && !tag)) {
        const error = { ok: false, code: 'INVALID_REQUEST', error: 'Missing mode or tag' };
        console.error('[Update/Apply] Invalid request:', error);
        return NextResponse.json(error, { status: 400 });
    }

    // Check for uncommitted changes (tracked files or staged changes)
    const [dirty, staged, untrackedFiles] = await Promise.all([
        isDirty(),
        hasStagedChanges(),
        getUntrackedFiles()
    ]);

    if (dirty || staged) {
        const error = {
            ok: false,
            code: 'DIRTY_REPO',
            error: 'Working directory has uncommitted changes. Please commit or stash changes first.',
            details: {
                hasModifiedFiles: dirty,
                hasStagedChanges: staged,
                untrackedFiles: untrackedFiles.slice(0, 10) // Limit to first 10 files
            }
        };
        console.error('[Update/Apply] Repository is dirty:', {
            code: error.code,
            hasModifiedFiles: dirty,
            hasStagedChanges: staged,
            untrackedFileCount: untrackedFiles.length
        });
        return NextResponse.json(error, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (msg: string) => controller.enqueue(encoder.encode(msg + '\n'));

            try {
                send('Starting update process...');

                // Always fetch tags first to be sure
                send('Fetching latest tags...');
                await runCommand('git', ['fetch', '--tags', 'origin'], send);

                if (mode === 'tag') {
                    send(`Checking out tag ${tag}...`);
                    await runCommand('git', ['checkout', tag], send);
                    // If we are detached, maybe we should warn, but user asked for "update to tag".
                    // It's fine for the app to be in detached HEAD state on a tag.
                } else if (mode === 'pull') {
                    send('Pulling latest changes...');
                    // We assume we are on a branch if pulling
                    await runCommand('git', ['pull', '--ff-only'], send);
                }

                send('Update completed successfully.');
                send('DONE'); // Signal completion
                controller.close();
            } catch (error: any) {
                const errorMsg = `Error: ${error.message}`;
                console.error('[Update/Apply] Update failed:', {
                    error: error.message,
                    stack: error.stack
                });
                send(errorMsg);
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}

function runCommand(command: string, args: string[], send: (msg: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        // FAILSAFE: Explicitly block destructive commands
        if (args.includes('clean') || args.includes('stash') || args.includes('reset')) {
            if (args.includes('clean') || args.includes('stash')) {
                return reject(new Error(`SAFEGUARD: Destructive git command '${args[0]}' is BLOCKED.`));
            }
        }

        const proc = spawn(command, args, { cwd: process.cwd() });

        proc.stdout.on('data', (data) => send(data.toString().trim()));
        proc.stderr.on('data', (data) => send(data.toString().trim()));

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with code ${code}`));
            }
        });

        proc.on('error', (err) => reject(err));
    });
}
