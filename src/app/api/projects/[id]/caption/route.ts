import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { runPythonScript } from '@/lib/python';
import { updateProjectStats, updateProject } from '@/lib/projects';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { model, triggerWord } = body;

        const projectDir = path.join(process.cwd(), 'projects', id);
        const processedDir = path.join(projectDir, 'processed');
        const metadataPath = path.join(projectDir, 'captions.json');

        // Check if processed images exist
        const files = await fs.readdir(processedDir).catch(() => []);
        if (files.length === 0) {
            return NextResponse.json({ error: 'No processed images to caption. Please complete Step 3 first.' }, { status: 400 });
        }

        // Save settings
        await updateProject(id, { settings: { captionModel: model, triggerWord } as any });

        // Run Python Script
        // Ideally backgrounded, but for stub it's fast. 
        // If real model, MUST be backgrounded.
        // I'll background it.

        (async () => {
            try {
                console.log(`Starting captioning for ${id}`);
                await runPythonScript('caption.py', [
                    '--image_dir', processedDir,
                    '--metadata_out', metadataPath,
                    '--model', model
                ]);

                // Convert metadata.json to individual .txt files (common Lora format)
                const captionsData = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));

                for (const [filename, data] of Object.entries(captionsData)) {
                    let text = '';
                    if (data && typeof data === 'object' && 'tags' in data) {
                        text = data.tags as string;
                    } else if (data && typeof data === 'object' && 'caption' in data) {
                        text = data.caption as string;
                    }

                    if (triggerWord) {
                        text = `${triggerWord}, ${text}`;
                    }

                    const txtPath = path.join(processedDir, `${path.parse(filename).name}.txt`);
                    await fs.writeFile(txtPath, text);
                }

                await updateProjectStats(id);
                console.log(`Finished captioning for ${id}`);
            } catch (e) {
                console.error('Captioning background error:', e);
            }
        })();

        return NextResponse.json({ status: 'started' });

    } catch (error) {
        console.error('Caption error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
