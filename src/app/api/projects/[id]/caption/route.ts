import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { spawn } from 'child_process';
import { updateProjectStats, updateProject } from '@/lib/projects';
import { getManifest } from '@/lib/manifest';

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

        // Support both legacy format (model, triggerWord) and new format (full config)
        const config = body.mode ? body : {
            mode: body.model === 'blip' ? 'caption' : 'tags',
            taggerModel: 'legacy',
            captionerModel: body.model === 'blip' ? 'blip' : 'blip2',
            triggerWord: body.triggerWord || '',
            advanced: {
                tagThreshold: 0.35,
                maxTags: 40,
                removeJunkTags: true,
                customBlacklist: '',
                customWhitelist: '',
                normalizeTags: true,
                tagOrdering: 'confidence',
                captionStyle: 'short',
                outputFormat: 'tags',
                avoidGenericPhrases: true,
                mergeFormat: 'trigger_tags_caption',
                deduplicate: true,
                maxCaptionLength: 220,
                keepFirstTokens: 1,
                shuffleTags: true
            }
        };

        const projectDir = path.join(process.cwd(), 'projects', id);
        const trainDataDir = path.join(projectDir, 'train_data');
        const jobPath = path.join(projectDir, JOB_FILE);

        // Check if train_data exists and has subdirectories
        try {
            await fs.access(trainDataDir);
        } catch {
            return NextResponse.json({ error: 'Train data directory not found. Please complete Sync step.' }, { status: 400 });
        }

        const entries = await fs.readdir(trainDataDir, { withFileTypes: true });
        const subDirs = entries.filter(e => e.isDirectory());

        if (subDirs.length === 0) {
            return NextResponse.json({ error: 'No image folders found in train_data. Please sync images first.' }, { status: 400 });
        }

        // Target the first subdirectory (e.g. 10_class)
        // TODO: Support multiple folders if needed in future
        const targetSubDir = subDirs[0].name;
        const targetDir = path.join(trainDataDir, targetSubDir);

        // Verify images exist in target
        const files = await fs.readdir(targetDir);
        const images = files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

        if (images.length === 0) {
            return NextResponse.json({ error: 'No images found in training folder.' }, { status: 400 });
        }

        // Save caption config
        const configPath = path.join(projectDir, 'caption_config.json');
        await fs.writeFile(configPath, JSON.stringify({ ...config, lastRun: new Date().toISOString() }, null, 2));

        // Initialize Job
        const initialJob = {
            status: 'starting',
            progress: 0,
            total: images.length,
            current: 0,
            current_file: '',
            sourceStage: 'train_data' as const
        };
        await fs.writeFile(jobPath, JSON.stringify(initialJob, null, 2));

        // Determine which provider script to use
        const scriptsDir = path.join(process.cwd(), 'scripts', 'caption');
        let scriptPath: string;
        // Input dir is now the train_data subdirectory
        let scriptArgs: string[] = ['--input_dir', targetDir];

        if (config.mode === 'tags') {
            // WD14 Tagger
            scriptPath = path.join(scriptsDir, 'tagger_wd14.py');
            scriptArgs.push(
                '--model', config.taggerModel,
                '--threshold', config.advanced.tagThreshold.toString(),
                '--max_tags', config.advanced.maxTags.toString(),
                '--order', config.advanced.tagOrdering,
                '--keep_tokens', config.advanced.keepFirstTokens.toString()
            );
            if (config.advanced.normalizeTags) scriptArgs.push('--normalize');
            if (config.advanced.shuffleTags) scriptArgs.push('--shuffle');
            if (config.advanced.customBlacklist) {
                scriptArgs.push('--blacklist', config.advanced.customBlacklist);
            }
            if (config.advanced.customWhitelist) {
                scriptArgs.push('--whitelist', config.advanced.customWhitelist);
            }
        } else if (config.mode === 'caption') {
            // Captioner (BLIP/BLIP-2/Florence-2)
            const modelScriptMap: Record<string, string> = {
                blip: 'caption_blip_legacy.py',
                blip2: 'caption_blip2.py',
                florence2: 'caption_florence2.py'
            };
            scriptPath = path.join(scriptsDir, modelScriptMap[config.captionerModel]);
            scriptArgs.push(
                '--style', config.advanced.captionStyle,
                '--format', config.advanced.outputFormat
            );
            if (config.advanced.avoidGenericPhrases) scriptArgs.push('--avoid_generic');
        } else {
            // Hybrid 2-pass
            scriptPath = path.join(scriptsDir, 'hybrid_2pass.py');
            scriptArgs.push(
                '--tagger_model', config.taggerModel,
                '--captioner_model', config.captionerModel,
                '--tag_threshold', config.advanced.tagThreshold.toString(),
                '--max_tags', config.advanced.maxTags.toString(),
                '--tag_order', config.advanced.tagOrdering,
                '--caption_style', config.advanced.captionStyle,
                '--merge_format', config.advanced.mergeFormat,
                '--max_length', config.advanced.maxCaptionLength.toString(),
                '--keep_tokens', config.advanced.keepFirstTokens.toString()
            );
            if (config.advanced.normalizeTags) scriptArgs.push('--tag_normalize');
            if (config.advanced.deduplicate) scriptArgs.push('--dedupe');
            if (config.advanced.shuffleTags) scriptArgs.push('--shuffle');
            if (config.advanced.avoidGenericPhrases) scriptArgs.push('--avoid_generic');
            if (config.advanced.customBlacklist) {
                scriptArgs.push('--tag_blacklist', config.advanced.customBlacklist);
            }
        }

        // Add trigger word if present
        if (config.triggerWord) {
            scriptArgs.push('--trigger', config.triggerWord);
        }

        // Spawn Background Process
        const pythonProcess = spawn('python', [scriptPath, ...scriptArgs]);

        console.log(`Started captioning job for ${id} in ${targetDir}`);

        pythonProcess.stdout.on('data', async (data) => {
            const str = data.toString();
            if (str.includes('PROGRESS:')) {
                const lines = str.split('\n');
                for (const line of lines) {
                    if (line.trim().startsWith('PROGRESS:')) {
                        try {
                            const jsonStr = line.replace('PROGRESS:', '').trim();
                            const progressData = JSON.parse(jsonStr);
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
                    // Update stats only - no file moving

                    const allFiles = await fs.readdir(targetDir);
                    const txtFiles = allFiles.filter(f => f.endsWith('.txt'));

                    let writtenCaptions = 0;
                    const counts: Record<string, number> = {};
                    const allCaptionTexts: string[] = [];
                    const STOPWORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'were', 'it', 'that', 'this']);

                    const displayMode = config.mode === 'caption' ? 'sentence' : 'tags';

                    for (const txtFile of txtFiles) {
                        try {
                            const captionText = await fs.readFile(path.join(targetDir, txtFile), 'utf-8');
                            writtenCaptions++;

                            if (displayMode === 'tags') {
                                captionText.split(',').forEach(t => {
                                    const tag = t.trim();
                                    if (tag) counts[tag] = (counts[tag] || 0) + 1;
                                });
                            } else {
                                allCaptionTexts.push(captionText);
                                const words = captionText.toLowerCase()
                                    .replace(/[^\w\s]/g, '')
                                    .split(/\s+/);
                                words.forEach(w => {
                                    if (w.length > 2 && !STOPWORDS.has(w)) {
                                        counts[w] = (counts[w] || 0) + 1;
                                    }
                                });
                            }
                        } catch (e) {
                            console.error(`Error reading ${txtFile}:`, e);
                        }
                    }

                    // Prepare Summary Data
                    const topItems = Object.entries(counts)
                        .map(([text, count]) => ({ text, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 50);

                    const samples: string[] = [];
                    if (displayMode === 'sentence' && allCaptionTexts.length > 0) {
                        for (let i = 0; i < Math.min(5, allCaptionTexts.length); i++) {
                            const randomIndex = Math.floor(Math.random() * allCaptionTexts.length);
                            samples.push(allCaptionTexts[randomIndex]);
                        }
                    }

                    const uniqueCount = Object.keys(counts).length;

                    await updateProjectStats(id);

                    const finalSummary = {
                        mode: displayMode,
                        topItems,
                        uniqueCount,
                        samples: samples.length > 0 ? samples : undefined,
                        totalCaptioned: writtenCaptions,
                        writtenImages: images.length,
                        writtenCaptions,
                        updatedAt: new Date().toISOString()
                    };

                    const statsPath = path.join(projectDir, 'caption_stats.json');
                    await fs.writeFile(statsPath, JSON.stringify(finalSummary, null, 2));

                    await fs.writeFile(jobPath, JSON.stringify({
                        status: 'completed',
                        progress: writtenCaptions,
                        total: images.length,
                        sourceStage: 'train_data',
                        summary: finalSummary
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
