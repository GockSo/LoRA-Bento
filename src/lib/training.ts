import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

export interface TrainingConfig {
    pretrainedModelPath: string;
    outputName: string;
    outputDir: string;
    width: number;
    height: number;
    batchSize: number;
    epochs?: number;
    // steps override
    useStepsOverride?: boolean;
    inputSteps?: number;
    saveEveryNSteps?: number;
    learningRate: number;
    unetLr: number;
    textEncoderLr: number;
    networkDim: number;
    networkAlpha: number;
    mixedPrecision: 'fp16' | 'bf16' | 'no';
    seed?: number;
    captionExtension: string;
    enableBucket: boolean;
    repeats: number;
    trainerScriptPath: string;
    modelFamily?: string;

    // Advanced / Parity Fields
    clipSkip?: number;
    flipAug?: boolean;
    shuffleTags?: boolean;
    keepTokens?: number;
    scheduler?: string;
    schedulerCycles?: number;
    minSnrGamma?: number;
    noiseOffset?: number;
    optimizerType?: string;
    optimizerArgs?: string;
}

export interface TrainingStatus {
    runId: string | null;
    status: 'idle' | 'running' | 'completed' | 'failed' | 'canceled';
    startedAt: string | null;
    progress: {
        step: number;
        totalSteps: number;
        percent: number;
        message: string;
    };
    lastLogs: string[];
}

interface ActiveJob {
    projectId: string;
    runId: string;
    process: ChildProcess;
    status: TrainingStatus;
    logBuffer: string[];
}

class TrainingManager {
    private static instance: TrainingManager;
    private jobs: Map<string, ActiveJob> = new Map(); // projectId -> Job

    private constructor() { }

    public static getInstance(): TrainingManager {
        if (!TrainingManager.instance) {
            TrainingManager.instance = new TrainingManager();
        }
        return TrainingManager.instance;
    }

    public getJobStatus(projectId: string): TrainingStatus {
        const job = this.jobs.get(projectId);
        if (!job) {
            return {
                runId: null,
                status: 'idle',
                startedAt: null,
                progress: { step: 0, totalSteps: 0, percent: 0, message: '' },
                lastLogs: []
            };
        }
        return {
            ...job.status,
            lastLogs: [...job.logBuffer] // Return copy
        };
    }

    public async startTraining(projectId: string, config: TrainingConfig, pythonPath: string = 'python', trainerScriptPath: string): Promise<string> {
        if (this.jobs.has(projectId)) {
            const job = this.jobs.get(projectId);
            if (job && job.status.status === 'running') {
                throw new Error('Training already in progress for this project');
            }
        }

        // --- PREFLIGHT CHECKS & STAGING ---
        // 1. Validate train_data directory exists and has images
        const projectDir = path.join(process.cwd(), 'projects', projectId);
        // CHANGED: Source is now train_data, not processed
        const sourceDir = path.join(projectDir, 'train_data');

        try {
            await fs.access(sourceDir);
        } catch {
            throw new Error(`Training data directory not found at ${sourceDir}. Please process/caption images first.`);
        }

        const files = await fs.readdir(sourceDir);
        const imageFiles = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
        if (imageFiles.length === 0) {
            throw new Error('No images found in train_data directory. Please add images/captions.');
        }

        // 2. Stage Dataset for sd-scripts
        // Structure: projects/<id>/train_dataset/<repeats>_<outputName>
        // We COPY from train_data to this structure to ensure sd-scripts compatibility without messing up the source.
        const stagingRoot = path.join(projectDir, 'train_dataset');

        // Sanitize outputName for folder usage
        const sanitizedName = config.outputName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const conceptFolder = `${config.repeats}_${sanitizedName}`;
        const stagingDir = path.join(stagingRoot, conceptFolder);

        console.log(`Staging dataset from ${sourceDir} to: ${stagingDir}`);

        // Clean staging dir if exists (to ensure fresh copy)
        await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => { });
        await fs.mkdir(stagingDir, { recursive: true });

        // Copy all files from sourceDir to stagingDir
        for (const file of files) {
            // Copy images and text files
            if (/\.(png|jpg|jpeg|webp|txt|caption)$/i.test(file)) {
                await fs.copyFile(path.join(sourceDir, file), path.join(stagingDir, file));
            }
        }

        // Verify staging
        const stagedFiles = await fs.readdir(stagingDir);
        const stagedImages = stagedFiles.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
        if (stagedImages.length === 0) {
            throw new Error('Failed to stage images. Staging directory is empty.');
        }

        // --- START TRAINING ---
        const runId = uuidv4();
        const startedAt = new Date().toISOString();

        // Generate Command
        // Pass the STAGING ROOT as train_data_dir (parent of concept folder)
        const args = this.constructArgs(config, stagingRoot);

        console.log('Starting training with command:', pythonPath, '-X utf8', trainerScriptPath, args.join(' '));

        const child = spawn(pythonPath, ['-X', 'utf8', trainerScriptPath, ...args], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                PYTHONUNBUFFERED: '1',
                PYTHONUTF8: '1',
                PYTHONIOENCODING: 'utf-8'
            }
        });

        // Determine total steps for progress bar
        let totalSteps = 0;
        if (config.useStepsOverride && config.inputSteps) {
            totalSteps = config.inputSteps;
        } else if (config.epochs) {
            // Approximation: images * repeats * epochs / batchSize
            // We know stagedImages.length
            const numImages = stagedImages.length;
            totalSteps = Math.ceil((numImages * config.repeats * config.epochs) / config.batchSize);
        }

        const initialStatus: TrainingStatus = {
            runId,
            status: 'running',
            startedAt,
            progress: { step: 0, totalSteps: totalSteps, percent: 0, message: 'Starting...' },
            lastLogs: []
        };

        const job: ActiveJob = {
            projectId,
            runId,
            process: child,
            status: initialStatus,
            logBuffer: []
        };

        this.jobs.set(projectId, job);

        // Stream Handling
        const handleOutput = (data: Buffer) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                this.appendLog(job, line);
                this.parseProgress(job, line);
            }
        };

        child.stdout?.on('data', handleOutput);
        child.stderr?.on('data', handleOutput);

        child.on('close', (code) => {
            if (job.status.status === 'canceled') return;

            if (code === 0) {
                job.status.status = 'completed';
                job.status.progress.percent = 100;
                job.status.progress.message = 'Training completed successfully';
            } else {
                job.status.status = 'failed';
                job.status.progress.message = `Failed with exit code ${code}`;
            }
        });

        child.on('error', (err) => {
            job.status.status = 'failed';
            this.appendLog(job, `Error spawning process: ${err.message}`);
        });

        return runId;
    }

    public async stopTraining(projectId: string): Promise<void> {
        const job = this.jobs.get(projectId);
        if (!job || job.status.status !== 'running') return;

        job.status.status = 'canceled';
        job.status.progress.message = 'Canceled by user';
        job.process.kill();
    }

    private constructArgs(config: TrainingConfig, datasetRoot: string): string[] {
        const args: string[] = [];

        if (config.pretrainedModelPath) args.push('--pretrained_model_name_or_path', config.pretrainedModelPath);
        if (config.outputDir) args.push('--output_dir', config.outputDir);
        if (config.outputName) args.push('--output_name', config.outputName);

        // Dataset
        args.push('--train_data_dir', datasetRoot);

        // Resolution & Batch
        args.push('--resolution', `${config.width},${config.height}`);
        args.push('--train_batch_size', config.batchSize.toString());

        // Epochs vs Steps Logic
        if (config.useStepsOverride && config.inputSteps) {
            args.push('--max_train_steps', config.inputSteps.toString());
        } else {
            // Default to epochs
            const epochs = config.epochs || 10;
            args.push('--max_train_epochs', epochs.toString());
        }

        if (config.saveEveryNSteps) args.push('--save_every_n_steps', config.saveEveryNSteps.toString());

        // Learning Rates
        // Note: sd-scripts prioritizes unet_lr/text_encoder_lr over learning_rate if present
        args.push('--learning_rate', config.learningRate.toString());
        args.push('--unet_lr', config.unetLr.toString());
        args.push('--text_encoder_lr', config.textEncoderLr.toString());

        // Network
        args.push('--network_dim', config.networkDim.toString());
        args.push('--network_alpha', config.networkAlpha.toString());
        args.push('--network_module', 'networks.lora');

        // Precision
        if (config.mixedPrecision && config.mixedPrecision !== 'no') {
            args.push('--mixed_precision', config.mixedPrecision);
            args.push('--save_precision', config.mixedPrecision);
        }

        // Common Args
        if (config.seed) args.push('--seed', config.seed.toString());
        if (config.captionExtension) args.push('--caption_extension', config.captionExtension);
        if (config.enableBucket) args.push('--enable_bucket');

        // Advanced / Parity Args
        if (config.clipSkip && config.clipSkip > 1) {
            // Only add if > 1 to avoid clutter, though strictly 1 is default
            args.push('--clip_skip', config.clipSkip.toString());
        }

        if (config.flipAug) args.push('--flip_aug');
        if (config.shuffleTags) args.push('--shuffle_caption');
        if (config.keepTokens && config.keepTokens > 0) args.push('--keep_tokens', config.keepTokens.toString());

        if (config.scheduler) args.push('--lr_scheduler', config.scheduler);
        if (config.schedulerCycles) args.push('--lr_scheduler_num_cycles', config.schedulerCycles.toString());

        if (config.minSnrGamma && config.minSnrGamma > 0) args.push('--min_snr_gamma', config.minSnrGamma.toString());
        if (config.noiseOffset && config.noiseOffset > 0) args.push('--noise_offset', config.noiseOffset.toString());

        if (config.optimizerType) args.push('--optimizer_type', config.optimizerType);

        if (config.optimizerArgs) {
            // Split by comma or newline, trim
            const rawArgs = config.optimizerArgs.split(/[\n,]/);
            const sanitizedArgs: string[] = [];

            for (const arg of rawArgs) {
                const trimmed = arg.trim();
                if (!trimmed) continue;

                // Ensure key=value format
                const eqIndex = trimmed.indexOf('=');
                if (eqIndex === -1) {
                    // If no equals sign, it might be a flag or malformed. 
                    // To be safe, warn and skip, or pass through if we trust it. 
                    // Given the crash, we should probably skip or log.
                    console.warn(`Skipping invalid optimizer arg (no '='): ${trimmed}`);
                    continue;
                }

                const key = trimmed.substring(0, eqIndex).trim();
                let val = trimmed.substring(eqIndex + 1).trim();

                // Normalize values for Python ast.literal_eval
                const lowerVal = val.toLowerCase();

                if (lowerVal === 'true') {
                    val = 'True';
                } else if (lowerVal === 'false') {
                    val = 'False';
                } else if (lowerVal === 'null' || lowerVal === 'none') {
                    val = 'None';
                } else if (!isNaN(Number(val))) {
                    // It's a number, keep as is (e.g. 0.01, 1e-4)
                } else if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    // Already quoted, keep as is
                } else {
                    // Check if it's a valid identifier or complex string
                    // ast.literal_eval fails on bare words like 'dynamic'. 
                    // We must quote them.
                    val = `'${val}'`;
                }

                sanitizedArgs.push(`${key}=${val}`);
            }

            if (sanitizedArgs.length > 0) {
                console.log('Resolved Optimizer Args:', sanitizedArgs);
                args.push('--optimizer_args', ...sanitizedArgs);
            }
        }

        return args;
    }

    private appendLog(job: ActiveJob, line: string) {
        job.logBuffer.push(line);
        if (job.logBuffer.length > 2000) {
            job.logBuffer.shift();
        }
        job.status.lastLogs = [...job.logBuffer];
    }

    private parseProgress(job: ActiveJob, line: string) {
        // Regex for "Step 123/1000" or similar
        const match = line.match(/(\d+)\/(\d+)/);
        if (match && (line.includes('|') || line.includes('it/s') || line.includes('steps:'))) {
            const current = parseInt(match[1]);
            const total = parseInt(match[2]);
            if (!isNaN(current) && !isNaN(total) && total > 0) {
                job.status.progress.step = current;
                // Only update total if not yet set or drastically different (like initial estimate was wrong)
                if (job.status.progress.totalSteps === 0 || Math.abs(job.status.progress.totalSteps - total) > 100) {
                    job.status.progress.totalSteps = total;
                }
                job.status.progress.percent = Math.round((current / total) * 100);
                job.status.progress.message = `Step ${current} / ${total}`;
            }
        }
    }
}

export const trainingManager = TrainingManager.getInstance();
