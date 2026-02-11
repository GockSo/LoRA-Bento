import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; imageId: string }> }
) {
    try {
        const { id, imageId } = await params;

        // Load project config to get caption settings
        const projectDir = path.join(process.cwd(), 'projects', id);
        const configPath = path.join(projectDir, 'config.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        const config = JSON.parse(configData);

        const captionConfig = config.caption || {
            wdModel: 'wd-v1-4-convnext-tagger-v2',
            advanced: {
                tagThreshold: 0.35,
                maxTags: 60,
                excludeTags: '',
                normalizeTags: true,
                tagOrdering: 'confidence',
                shuffleTags: true
            }
        };

        // Map WD model key to legacy script model name
        const modelKeyMap: Record<string, string> = {
            'wd-v1-4-convnext-tagger-v2': 'convnext',
            'wd-v1-4-moat-tagger-v2': 'swinv2',
            'wd-eva02-large-tagger-v3': 'convnext',
            'wd-v1-4-vit-tagger-v2': 'legacy'
        };
        const legacyModel = modelKeyMap[captionConfig.wdModel] || 'convnext';

        // Get image path
        const imagePath = path.join(projectDir, 'train_data', imageId);
        const imageDir = path.dirname(imagePath);

        // Run WD tagger on single image
        const scriptsDir = path.join(process.cwd(), 'scripts', 'caption');
        const scriptPath = path.join(scriptsDir, 'tagger_wd14.py');

        const scriptArgs: string[] = [
            scriptPath,
            '--input_dir', imageDir,
            '--model', legacyModel,
            '--threshold', captionConfig.advanced.tagThreshold.toString(),
            '--max_tags', captionConfig.advanced.maxTags.toString(),
            '--order', captionConfig.advanced.tagOrdering
        ];

        if (captionConfig.advanced.normalizeTags) scriptArgs.push('--normalize');
        if (captionConfig.advanced.shuffleTags) scriptArgs.push('--shuffle');
        if (captionConfig.advanced.excludeTags) {
            scriptArgs.push('--blacklist', captionConfig.advanced.excludeTags);
        }

        // Execute Python script
        await new Promise<void>((resolve, reject) => {
            const proc = spawn('python', scriptArgs, { cwd: scriptsDir });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => stdout += data.toString());
            proc.stderr.on('data', (data) => stderr += data.toString());

            proc.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`Script failed: ${stderr}`));
            });
        });

        // Read generated tags
        const txtPath = imagePath.replace(/\.(jpg|jpeg|png|webp)$/i, '.txt');
        const tagContent = await fs.readFile(txtPath, 'utf-8');
        const tags = tagContent.split(',').map(t => t.trim()).filter(Boolean);

        return NextResponse.json({ success: true, tags });
    } catch (error) {
        console.error('Failed to regenerate tags:', error);
        return NextResponse.json(
            { error: 'Failed to regenerate tags' },
            { status: 500 }
        );
    }
}
