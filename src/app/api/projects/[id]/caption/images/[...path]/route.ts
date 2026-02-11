import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import mime from 'mime';
import { spawn } from 'child_process';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; path: string[] }> }
) {
    // ... existing GET implementation ...
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; path: string[] }> }
) {
    // ... existing PUT implementation ...
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; path: string[] }> }
) {
    try {
        const { id, path: pathSegments } = await params;

        // Check if this is a regenerate request
        const lastSegment = pathSegments[pathSegments.length - 1];
        if (lastSegment !== 'regenerate') {
            return new NextResponse('Method Not Allowed', { status: 405 });
        }

        // Image path is everything before "regenerate"
        const imagePathSegments = pathSegments.slice(0, -1);

        if (imagePathSegments.length === 0) {
            return new NextResponse('Not found', { status: 404 });
        }

        const projectDir = path.join(process.cwd(), 'projects', id);
        const trainDataDir = path.join(projectDir, 'train_data');
        const filePath = path.join(trainDataDir, ...imagePathSegments);

        // Security check
        const resolvedPath = path.resolve(filePath);
        if (!resolvedPath.startsWith(path.resolve(trainDataDir))) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            return new NextResponse('Image not found', { status: 404 });
        }

        // Load caption config (prefer body, fallback to file)
        let config;
        try {
            const body = await request.json();
            if (body && (body.wdModel || body.taggerModel)) {
                config = body;
            }
        } catch {
            // Body might be empty or invalid JSON, ignore
        }

        if (!config) {
            const configPath = path.join(projectDir, 'caption_config.json');
            try {
                const configData = await fs.readFile(configPath, 'utf-8');
                config = JSON.parse(configData);
            } catch {
                return new NextResponse('Caption config not found. Please run auto-tag first.', { status: 400 });
            }
        }

        // Construct script arguments
        const scriptsDir = path.join(process.cwd(), 'scripts', 'caption');
        const scriptPath = path.join(scriptsDir, 'tagger_wd14.py');

        const scriptArgs: string[] = [
            '--file', filePath,
            '--model', config.wdModel || config.taggerModel || 'convnext', // Fallback
            '--threshold', (config.advanced?.tagThreshold || 0.35).toString(),
            '--character_threshold', '0.7',
            '--max_tags', (config.advanced?.maxTags || 50).toString(),
            '--keep_tokens', (config.advanced?.keepFirstTokens || 1).toString()
        ];

        if (config.advanced?.normalizeTags) scriptArgs.push('--normalize');
        if (config.advanced?.shuffleTags) scriptArgs.push('--shuffle');

        if (config.taggingMode === 'append') {
            scriptArgs.push('--append');
        }

        const exclude = config.advanced?.excludeTags || config.advanced?.customBlacklist;
        if (exclude) {
            scriptArgs.push('--exclude_tags', exclude);
        }
        if (config.triggerWord) {
            scriptArgs.push('--trigger', config.triggerWord);
        }

        // Spawn python script
        await new Promise<void>((resolve, reject) => {
            const pythonProcess = spawn('python', [scriptPath, ...scriptArgs]);

            let stderr = '';

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    console.error('Tagger failed:', stderr);
                    reject(new Error(`Tagger exited with code ${code}`));
                }
            });
        });

        // Read the generated .txt file
        const txtPath = filePath.replace(/\.[^/.]+$/, '.txt');
        const txtContent = await fs.readFile(txtPath, 'utf-8');
        const tags = txtContent.split(',').map(t => t.trim()).filter(Boolean);

        return NextResponse.json({ tags });

    } catch (error) {
        console.error('Error regenerating tags:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
