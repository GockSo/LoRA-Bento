import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { updateProjectStats, updateProject } from '@/lib/projects';

const JOB_FILE = 'caption_job.json';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const projectDir = path.join(process.cwd(), 'projects', id);
        const jobPath = path.join(projectDir, JOB_FILE);

        try {
            const data = await fs.readFile(jobPath, 'utf-8');
            return NextResponse.json(JSON.parse(data));
        } catch {
            return NextResponse.json({ status: 'idle', progress: 0, total: 0 });
        }
    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { model, triggerWord } = body;

        const projectDir = path.join(process.cwd(), 'projects', id);
        const processedDir = path.join(projectDir, 'processed');
        const metadataPath = path.join(projectDir, 'captions.json');
        const jobPath = path.join(projectDir, JOB_FILE);

        // Check if processed images exist
        const files = await fs.readdir(processedDir).catch(() => []);
        if (files.length === 0) {
            return NextResponse.json({ error: 'No processed images to caption. Please complete Step 3 first.' }, { status: 400 });
        }

        // Save settings
        await updateProject(id, { settings: { captionModel: model, triggerWord } as any });

        // Initialize Job
        const initialJob = { status: 'starting', progress: 0, total: files.length, current: 0 };
        await fs.writeFile(jobPath, JSON.stringify(initialJob, null, 2));

        // Spawn Background Process
        const scriptPath = path.join(process.cwd(), 'scripts', 'caption.py');
        const pythonProcess = spawn('python', [
            scriptPath,
            '--image_dir', processedDir,
            '--metadata_out', metadataPath,
            '--model', model
        ]);

        console.log(`Started captioning job for ${id}`);

        pythonProcess.stdout.on('data', async (data) => {
            const str = data.toString();
            if (str.includes('PROGRESS:')) {
                const lines = str.split('\n');
                for (const line of lines) {
                    if (line.trim().startsWith('PROGRESS:')) {
                        try {
                            const jsonStr = line.replace('PROGRESS:', '').trim();
                            const progressData = JSON.parse(jsonStr);
                            // Update job file (careful with concurrency, but simple write should be "okay" for this scale)
                            const currentJob = JSON.parse(await fs.readFile(jobPath, 'utf-8').catch(() => '{}'));
                            await fs.writeFile(jobPath, JSON.stringify({ ...currentJob, ...progressData }, null, 2));
                        } catch (e) {
                            console.error('Error parsing progress:', e);
                        }
                    }
                }
            } else {
                console.log(`[Caption ${id}] ${str}`);
            }
        });

        pythonProcess.stderr.on('data', (data) => {
            console.error(`[Caption ${id} ERR] ${data}`);
        });

        pythonProcess.on('close', async (code) => {
            console.log(`Captioning finished for ${id} with code ${code}`);

            if (code === 0) {
                try {
                    // Convert metadata.json to individual .txt files
                    const captionsData = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

                    // Stats aggregation
                    const tagCounts: Record<string, number> = {};

                    for (const [filename, data] of Object.entries(captionsData)) {
                        let text = '';
                        if (data && typeof data === 'object' && 'tags' in data) {
                            text = data.tags as string;
                            // Aggregate tags
                            text.split(',').forEach(t => {
                                const tag = t.trim();
                                if (tag) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                            });
                        } else if (data && typeof data === 'object' && 'caption' in data) {
                            text = data.caption as string;
                        }

                        if (triggerWord) {
                            text = `${triggerWord}, ${text}`;
                        }

                        const txtPath = path.join(processedDir, `${path.parse(filename).name}.txt`);
                        await fs.writeFile(txtPath, text);
                    }

                    // Sort and transform stats
                    const sortedTags = Object.entries(tagCounts)
                        .map(([tag, count]) => ({ tag, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 20); // Top 20

                    await updateProjectStats(id);
                    await fs.writeFile(jobPath, JSON.stringify({
                        status: 'completed',
                        progress: 100,
                        total: files.length,
                        tagStats: sortedTags
                    }, null, 2));

                } catch (e) {
                    console.error('Post-captioning error:', e);
                    await fs.writeFile(jobPath, JSON.stringify({ status: 'error', error: 'Post-processing failed' }, null, 2));
                }
            } else {
                await fs.writeFile(jobPath, JSON.stringify({ status: 'error', error: 'Process exited with error' }, null, 2));
            }
        });

        return NextResponse.json({ status: 'started' });

    } catch (error) {
        console.error('Caption error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
