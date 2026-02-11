import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { WD_MODELS } from '@/lib/wd-models';

export async function GET(request: NextRequest) {
    try {
        // Get global models directory
        const modelsDir = path.join(process.cwd(), 'models', 'wd-tagger');

        // Check which models are installed
        const modelsWithStatus = await Promise.all(
            WD_MODELS.map(async (model) => {
                const modelPath = path.join(modelsDir, model.repo_id.split('/')[1]);
                let installed = false;

                try {
                    await fs.access(modelPath);
                    // Check if required files exist
                    const hasAllFiles = await Promise.all(
                        model.files.map(async (file) => {
                            try {
                                await fs.access(path.join(modelPath, file));
                                return true;
                            } catch {
                                return false;
                            }
                        })
                    );
                    installed = hasAllFiles.every(Boolean);
                } catch {
                    installed = false;
                }

                return {
                    ...model,
                    installed
                };
            })
        );

        return NextResponse.json(modelsWithStatus);
    } catch (error) {
        console.error('Failed to check WD models:', error);
        // Return models with installed=false as fallback
        return NextResponse.json(WD_MODELS.map(m => ({ ...m, installed: false })));
    }
}
