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
    maxTrainSteps?: number;
    saveEveryNSteps?: number;
    learningRate: number;
    unetLr: number;
    textEncoderLr: number;
    networkDim: number;
    networkAlpha: number;
    mixedPrecision: 'fp16' | 'bf16' | 'no';
    optimizerType?: string;
    seed?: number;
    captionExtension: string;
    enableBucket: boolean;
    repeats: number;
    // ... other sd-scripts args
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
        // 1. Validate processed directory exists and has images
        const projectDir = path.join(process.cwd(), 'projects', projectId);
        const processedDir = path.join(projectDir, 'processed');

        try {
            await fs.access(processedDir);
        } catch {
            throw new Error(`Processed directory not found at ${processedDir}. Please run processing step first.`);
        }

        const files = await fs.readdir(processedDir);
        const imageFiles = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
        if (imageFiles.length === 0) {
            throw new Error('No images found in processed directory. Please resize/process images first.');
        }

        // 2. Stage Dataset
        // Structure: projects/<id>/train_dataset/<repeats>_<outputName>
        // outputName is usually the project name or concept name
        const stagingRoot = path.join(projectDir, 'train_dataset');

        // Sanitize outputName for folder usage
        const sanitizedName = config.outputName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const conceptFolder = `${config.repeats}_${sanitizedName}`;
        const stagingDir = path.join(stagingRoot, conceptFolder);

        console.log(`Staging dataset to: ${stagingDir}`);

        // Clean staging dir if exists (to ensure fresh copy)
        await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => { });
        await fs.mkdir(stagingDir, { recursive: true });

        // Copy all files from processed to stagingDir
        for (const file of files) {
            // Copy images and text files
            if (/\.(png|jpg|jpeg|webp|txt|caption)$/i.test(file)) {
                await fs.copyFile(path.join(processedDir, file), path.join(stagingDir, file));
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
        // Pass the STAGING ROOT as train_data_dir
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

        const initialStatus: TrainingStatus = {
            runId,
            status: 'running',
            startedAt,
            progress: { step: 0, totalSteps: config.maxTrainSteps || 0, percent: 0, message: 'Starting...' },
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

        // CRITICAL FIX: Use the staged dataset root
        args.push('--train_data_dir', datasetRoot);

        args.push('--resolution', `${config.width},${config.height}`);
        args.push('--train_batch_size', config.batchSize.toString());

        // FIX: Prioritize epochs over max_train_steps
        if (config.epochs) {
            args.push('--max_train_epochs', config.epochs.toString());
        } else if (config.maxTrainSteps) {
            args.push('--max_train_steps', config.maxTrainSteps.toString());
        }

        if (config.saveEveryNSteps) args.push('--save_every_n_steps', config.saveEveryNSteps.toString());
        args.push('--learning_rate', config.learningRate.toString());
        args.push('--unet_lr', config.unetLr.toString());
        args.push('--text_encoder_lr', config.textEncoderLr.toString());
        args.push('--network_dim', config.networkDim.toString());
        args.push('--network_alpha', config.networkAlpha.toString());

        if (config.mixedPrecision && config.mixedPrecision !== 'no') {
            args.push('--mixed_precision', config.mixedPrecision);
            args.push('--save_precision', config.mixedPrecision);
        }

        if (config.seed) args.push('--seed', config.seed.toString());
        if (config.captionExtension) args.push('--caption_extension', config.captionExtension);
        if (config.enableBucket) args.push('--enable_bucket');

        args.push('--network_module', 'networks.lora');

        return args;
    }

    private appendLog(job: ActiveJob, line: string) {
        job.logBuffer.push(line);
        if (job.logBuffer.length > 1000) {
            job.logBuffer.shift();
        }
        job.status.lastLogs = [...job.logBuffer];
    }

    private parseProgress(job: ActiveJob, line: string) {
        // Regex for "Step 123/1000" or similar
        const match = line.match(/(\d+)\/(\d+)/);
        if (match && (line.includes('|') || line.includes('steps:'))) {
            const current = parseInt(match[1]);
            const total = parseInt(match[2]);
            if (!isNaN(current) && !isNaN(total) && total > 0) {
                job.status.progress.step = current;
                job.status.progress.totalSteps = total;
                job.status.progress.percent = Math.round((current / total) * 100);
                job.status.progress.message = `Step ${current} / ${total}`;
            }
        }
    }
}

export const trainingManager = TrainingManager.getInstance();
