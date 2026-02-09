import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { isDirty, fetchTags } from '@/lib/git';

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { mode, tag } = body;

    if (!mode || (mode === 'tag' && !tag)) {
        return NextResponse.json({ error: 'Missing mode or tag' }, { status: 400 });
    }

    if (await isDirty()) {
        return NextResponse.json({ error: 'Working directory is dirty. Please commit or stash changes first.' }, { status: 400 });
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
                send(`Error: ${error.message}`);
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
