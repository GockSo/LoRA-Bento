import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { getModelByKey } from '@/lib/wd-models';

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
            wdModel: 'SmilingWolf/wd-v1-4-convnext-tagger-v2',
            advanced: {
                tagThreshold: 0.35,
                maxTags: 60,
                excludeTags: '',
                normalizeTags: true,
                tagOrdering: 'confidence',
                shuffleTags: true
            }
        };

        // Use repo_id directly
        const modelKey = captionConfig.wdModel || 'wd-v1-4-convnext-tagger-v2';
        const modelDef = getModelByKey(modelKey as any);
        const modelRepoId = modelDef?.repo_id || modelKey;

        // Get image path
        const imagePath = path.join(projectDir, 'train_data', imageId);
        const imageDir = path.dirname(imagePath);

        // Run WD tagger on single image
        const scriptsDir = path.join(process.cwd(), 'scripts', 'caption');
        const scriptPath = path.join(scriptsDir, 'tagger_wd14.py');

        const scriptArgs: string[] = [
            scriptPath,
            '--input_dir', imageDir,
            '--model', modelRepoId,
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
