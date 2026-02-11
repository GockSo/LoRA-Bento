import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { CaptionConfig } from '@/types/caption';
import { getModelByKey } from '@/lib/wd-models';

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const config: CaptionConfig = await req.json();

        const projectDir = path.join(process.cwd(), 'projects', id);
        const resizedDir = path.join(projectDir, 'resized');

        // Get 3 random images
        const allFiles = await fs.readdir(resizedDir);
        const allImages = allFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

        if (allImages.length === 0) {
            return NextResponse.json(
                { error: 'No images found in resized folder' },
                { status: 400 }
            );
        }

        // Shuffle and take 3
        const shuffled = allImages.sort(() => Math.random() - 0.5);
        const samples = shuffled.slice(0, Math.min(3, shuffled.length));

        // Create temporary preview directory
        const previewDir = path.join(projectDir, '.caption_preview');
        await fs.rm(previewDir, { recursive: true, force: true });
        await fs.mkdir(previewDir, { recursive: true });

        // Copy sample images to preview dir
        for (const img of samples) {
            await fs.copyFile(
                path.join(resizedDir, img),
                path.join(previewDir, img)
            );
        }


        // WD Tagger only
        const scriptsDir = path.join(process.cwd(), 'scripts', 'caption');
        const scriptPath = path.join(scriptsDir, 'tagger_wd14.py');

        // Use repo_id directly
        const modelKey = config.wdModel || 'wd-v1-4-convnext-tagger-v2';
        const modelDef = getModelByKey(modelKey as any);
        const modelRepoId = modelDef?.repo_id || modelKey;

        const scriptArgs: string[] = [
            '--input_dir', previewDir,
            '--model', modelRepoId,
            '--threshold', config.advanced.tagThreshold.toString(),
            '--max_tags', config.advanced.maxTags.toString(),
            '--order', config.advanced.tagOrdering
        ];

        if (config.advanced.normalizeTags) scriptArgs.push('--normalize');
        if (config.advanced.shuffleTags) scriptArgs.push('--shuffle');
        if (config.advanced.excludeTags) {
            scriptArgs.push('--blacklist', config.advanced.excludeTags);
        }


        // Add trigger word if present
        if (config.triggerWord) {
            scriptArgs.push('--trigger', config.triggerWord);
        }

        // Run caption script synchronously for preview
        await new Promise<void>((resolve, reject) => {
            const pythonProcess = spawn('python', [scriptPath, ...scriptArgs]);

            let stdout = '';
            let stderr = '';

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`Preview script failed: ${stderr}`));
                }
            });
        });

        // Read generated captions and encode images as base64
        const results = [];
        for (const img of samples) {
            const imgStem = path.parse(img).name;
            const txtPath = path.join(previewDir, `${imgStem}.txt`);
            const imgPath = path.join(resizedDir, img);

            let caption = '';
            try {
                caption = await fs.readFile(txtPath, 'utf-8');
            } catch (err) {
                caption = `[Error reading caption for ${img}]`;
            }

            // Read image and convert to base64
            let imageDataUrl = '';
            try {
                const imageBuffer = await fs.readFile(imgPath);
                const ext = path.extname(img).toLowerCase();
                const mimeType = ext === '.png' ? 'image/png' :
                    ext === '.webp' ? 'image/webp' : 'image/jpeg';
                imageDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
            } catch (err) {
                console.error(`Failed to read image ${img}:`, err);
            }

            results.push({
                image: img,
                imageUrl: imageDataUrl,
                caption
            });
        }

        // Cleanup preview directory
        await fs.rm(previewDir, { recursive: true, force: true });

        return NextResponse.json({ samples: results });

    } catch (error) {
        console.error('Preview error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Preview failed' },
            { status: 500 }
        );
    }
}
