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
        const resizedDir = path.join(process.cwd(), 'projects', id, 'resized');
        const jobPath = path.join(projectDir, JOB_FILE);

        // Source Discovery logic
        const manifest = await getManifest(id);
        const allItems = manifest.items || [];
        const includedItems = allItems.filter(item => !item.excluded);

        const rawCount = includedItems.filter(item => item.stage === 'raw').length;
        const augCount = includedItems.filter(item => item.stage === 'augmented').length;
        const totalCount = includedItems.length;
        const excludedCount = allItems.length - totalCount;

        // Determine input source (prefer resized if not empty)
        const resizedFiles = await fs.readdir(resizedDir).catch(() => []);
        const resizedImages = resizedFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

        if (resizedImages.length === 0) {
            return NextResponse.json({ error: 'No resized images to caption. Please complete Step 4 first.' }, { status: 400 });
        }

        // Save caption config
        const configPath = path.join(projectDir, 'caption_config.json');
        await fs.writeFile(configPath, JSON.stringify({ ...config, lastRun: new Date().toISOString() }, null, 2));

        // Initialize Job with breakdown
        const initialJob = {
            status: 'starting',
            progress: 0,
            total: totalCount,
            current: 0,
            rawCount,
            augCount,
            totalCount,
            excludedCount,
            sourceStage: 'resized' as const
        };
        await fs.writeFile(jobPath, JSON.stringify(initialJob, null, 2));

        // Determine which provider script to use
        const scriptsDir = path.join(process.cwd(), 'scripts', 'caption');
        let scriptPath: string;
        let scriptArgs: string[] = ['--input_dir', resizedDir];

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

        const STOPWORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'were', 'it', 'that', 'this']);

        pythonProcess.on('close', async (code) => {
            console.log(`Captioning finished for ${id} with code ${code}`);

            if (code === 0) {
                try {
                    // New provider scripts write .txt files directly to resized/
                    // We need to copy them to train_data/ along with images

                    const trainDataTmpDir = path.join(projectDir, 'train_data_tmp');
                    const trainDataDir = path.join(projectDir, 'train_data');

                    // Clean up any existing tmp folder from previous runs
                    await fs.rm(trainDataTmpDir, { recursive: true, force: true });
                    await fs.mkdir(trainDataTmpDir, { recursive: true });

                    // Read all .txt files from resized/ directory
                    const allFiles = await fs.readdir(resizedDir);
                    const txtFiles = allFiles.filter(f => f.endsWith('.txt'));
                    const imageFiles = allFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));

                    let writtenImages = 0;
                    let writtenCaptions = 0;
                    const counts: Record<string, number> = {};
                    const allCaptionTexts: string[] = [];
                    const STOPWORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'is', 'are', 'was', 'were', 'it', 'that', 'this']);

                    // Determine mode based on config for proper aggregation
                    const displayMode = config.mode === 'caption' ? 'sentence' : 'tags';

                    // Copy images and captions to train_data_tmp/
                    for (const img of imageFiles) {
                        const imgStem = path.parse(img).name;
                        const txtFile = `${imgStem}.txt`;

                        // Copy image
                        try {
                            await fs.copyFile(
                                path.join(resizedDir, img),
                                path.join(trainDataTmpDir, img)
                            );
                            writtenImages++;
                        } catch (err) {
                            console.error(`Failed to copy ${img}:`, err);
                            continue;
                        }

                        // Copy caption if exists
                        if (txtFiles.includes(txtFile)) {
                            try {
                                const captionText = await fs.readFile(
                                    path.join(resizedDir, txtFile),
                                    'utf-8'
                                );

                                await fs.writeFile(
                                    path.join(trainDataTmpDir, txtFile),
                                    captionText
                                );
                                writtenCaptions++;

                                // Aggregate for stats
                                if (displayMode === 'tags') {
                                    // Parse tags
                                    captionText.split(',').forEach(t => {
                                        const tag = t.trim();
                                        if (tag) counts[tag] = (counts[tag] || 0) + 1;
                                    });
                                } else {
                                    // Sentence mode - extract keywords
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
                            } catch (err) {
                                console.error(`Failed to copy ${txtFile}:`, err);
                            }
                        }

                        // Clean up .txt from resized/ (we've copied to train_data)
                        try {
                            await fs.unlink(path.join(resizedDir, txtFile));
                        } catch { }
                    }

                    // Atomic replacement: delete old train_data/ and rename tmp
                    await fs.rm(trainDataDir, { recursive: true, force: true });
                    await fs.rename(trainDataTmpDir, trainDataDir);

                    console.log(`Created train_data/ with ${writtenImages} images and ${writtenCaptions} captions`);

                    // Prepare Summary Data
                    const topItems = Object.entries(counts)
                        .map(([text, count]) => ({ text, count }))
                        .sort((a, b) => b.count - a.count)
                        .slice(0, 50);

                    // Pick samples for sentence mode
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
                        writtenImages,
                        writtenCaptions,
                        updatedAt: new Date().toISOString()
                    };

                    // Persist for Analysis/Export screen
                    const statsPath = path.join(projectDir, 'caption_stats.json');
                    await fs.writeFile(statsPath, JSON.stringify(finalSummary, null, 2));

                    // Final Job Update
                    await fs.writeFile(jobPath, JSON.stringify({
                        status: 'completed',
                        progress: writtenCaptions,
                        total: totalCount,
                        rawCount,
                        augCount,
                        totalCount,
                        excludedCount,
                        sourceStage: 'resized',
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
