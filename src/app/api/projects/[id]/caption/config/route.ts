import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { CaptionConfig, DEFAULT_CAPTION_CONFIG } from '@/types/caption';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const projectDir = path.join(process.cwd(), 'projects', id);
        const configPath = path.join(projectDir, 'caption_config.json');

        try {
            const data = await fs.readFile(configPath, 'utf-8');
            const config: CaptionConfig = JSON.parse(data);
            return NextResponse.json(config);
        } catch {
            // Return defaults if config doesn't exist
            return NextResponse.json(DEFAULT_CAPTION_CONFIG);
        }
    } catch (error) {
        console.error('Error loading caption config:', error);
        return NextResponse.json(
            { error: 'Failed to load caption configuration' },
            { status: 500 }
        );
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const config: CaptionConfig = await req.json();

        const projectDir = path.join(process.cwd(), 'projects', id);
        const configPath = path.join(projectDir, 'caption_config.json');

        // Ensure project directory exists
        await fs.mkdir(projectDir, { recursive: true });

        // Save configuration
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving caption config:', error);
        return NextResponse.json(
            { error: 'Failed to save caption configuration' },
            { status: 500 }
        );
    }
}
