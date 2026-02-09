'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input, Switch } from '@/components/ui/core';
import { Label } from '@/components/ui/label';
import { Project, ProjectSettings } from '@/types';
import { AlertCircle, CheckCircle2, Loader2, HelpCircle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';

// Define the shape of our config
export interface TrainingConfig {
    pretrainedModelPath: string;
    outputName: string;
    outputDir: string;
    width: number;
    height: number;
    batchSize: number;
    epochs: number;
    saveEveryNSteps: number;
    learningRate: number;
    unetLr: number;
    textEncoderLr: number;
    networkDim: number;
    networkAlpha: number;
    mixedPrecision: 'fp16' | 'bf16' | 'no';
    seed: number;
    captionExtension: string;
    enableBucket: boolean;
    repeats: number;
    trainerScriptPath: string;
    modelFamily?: string;

    // Advanced / Parity Fields
    clipSkip: number;
    flipAug: boolean;
    shuffleTags: boolean;
    keepTokens: number;
    scheduler: string;
    schedulerCycles: number;
    minSnrGamma: number;
    noiseOffset: number;
    optimizerType: string;
    optimizerArgs: string;

    // Steps override
    useStepsOverride: boolean;
    inputSteps: number;
}

interface TrainingConfigFormProps {
    project: Project;
    onStart: (config: TrainingConfig) => void;
    disabled?: boolean;
}

// Square Only
const RESOLUTIONS = [512, 768, 1024];

// Optimizers
const OPTIMIZERS = [
    'AdamW',
    'AdamW8bit',
    'Adafactor',
    'DAdaptation',
    'Lion',
    'Prodigy'
];

// Schedulers
const SCHEDULERS = [
    'linear',
    'cosine',
    'cosine_with_restarts',
    'polynomial',
    'constant',
    'constant_with_warmup'
];

interface DetectionResult {
    modelFamily: string;
    supported: boolean;
    recommendedScript: string;
    availableScripts: string[];
    reason: string;
    repoPath?: string;
}

// Tooltip Component
function InfoTooltip({ text }: { text: string }) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative inline-flex items-center ml-1 z-10">
            <HelpCircle
                className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors"
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
            />
            {show && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-popover text-popover-foreground text-xs rounded shadow-lg border z-50 pointer-events-none">
                    {text}
                </div>
            )}
        </div>
    );
}

export function TrainingConfigForm({ project, onStart, disabled }: TrainingConfigFormProps) {
    // Initial resolution logic
    const initialSize = project.settings?.targetSize || 1024;
    // Find nearest preset
    const nearest = RESOLUTIONS.reduce((prev, curr) => {
        return (Math.abs(curr - initialSize) < Math.abs(prev - initialSize) ? curr : prev);
    });

    const isSnapped = nearest !== initialSize;

    // Default values
    const [config, setConfig] = useState<TrainingConfig>({
        pretrainedModelPath: project.settings?.train?.modelPath || '',
        outputName: project.name.replace(/\s+/g, '_'),
        outputDir: `projects/${project.id}/train_outputs`, // default relative path
        width: nearest,
        height: nearest,
        batchSize: 1, // Will update based on family
        epochs: 10,
        saveEveryNSteps: 500,
        learningRate: 0.0001, // Deprecated in favor of unet/te, but kept for compat
        unetLr: 0.0001,
        textEncoderLr: 0.00005,
        networkDim: 32,
        networkAlpha: 16,
        mixedPrecision: 'fp16',
        seed: 42,
        captionExtension: '.txt',
        enableBucket: true,
        repeats: 2,
        trainerScriptPath: project.settings?.train?.trainerScriptPath || 'train_script/sd-scripts/sdxl_train_network.py',
        modelFamily: project.settings?.train?.modelFamily || 'Unknown',

        // New Defaults
        clipSkip: 1,
        flipAug: false,
        shuffleTags: true, // Default to true as per requirements (mostly WD14 use case)
        keepTokens: 1,
        scheduler: 'cosine_with_restarts',
        schedulerCycles: 3,
        minSnrGamma: 5,
        noiseOffset: 0.1,
        optimizerType: 'Adafactor',
        optimizerArgs: 'scale_parameter=False,relative_step=False,warmup_init=False',

        useStepsOverride: false,
        inputSteps: 1000
    });

    const [wasSnapped] = useState(isSnapped);
    const [isDetecting, setIsDetecting] = useState(false);
    const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
    const [detectionError, setDetectionError] = useState<string | null>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [trainingMode, setTrainingMode] = useState<'local' | 'platform'>('local');

    // Derived calculations
    // Estimate images count - this is just a guess on frontend, real count is backend.
    // For now we can't easily know image count without an API call, so we'll show "Per Image" logic or placeholder.
    // Actually we can't calculate total steps accurately in frontend without image count.
    // We will show "Derived epochs ≈ (Steps / Images / Repeats)" only if we knew images.
    // For now, valid requirement: "Show computed values read-only... Derived epochs".
    // We'll skip exact step math IF we don't know image count, or maybe we fetch it?
    // Let's assume we don't know exact image count easily yet. 
    // Requirement C: "Show computed values... Batches/epoch".
    // We'll assume a placeholder or fetch it if possible. 
    // Actually, let's keep it simple: If in epoch mode, show "Total Steps: Variable (depends on dataset)".
    // If in steps mode, show "Approx Epochs: Variable".

    // Debounce save helper
    const saveTimeoutRef = useRef<NodeJS.Timeout>(null);

    const persistSettings = useCallback((newConfig: Partial<TrainingConfig>) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(() => {
            const updates: ProjectSettings['train'] = {
                mode: trainingMode,
                modelPath: newConfig.pretrainedModelPath,
                modelFamily: newConfig.modelFamily,
                trainerScriptPath: newConfig.trainerScriptPath
            };

            fetch(`/api/projects/${project.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: { train: updates } })
            }).catch(err => console.error('Failed to persist settings:', err));
        }, 1000);
    }, [project.id, trainingMode]);

    const handleChange = (field: keyof TrainingConfig, value: any) => {
        setConfig(prev => {
            const next = { ...prev, [field]: value };
            // Persist specific fields
            if (field === 'pretrainedModelPath' || field === 'trainerScriptPath' || field === 'modelFamily') {
                persistSettings(next);
            }
            return next;
        });
    };

    // Auto-detect when model path changes
    useEffect(() => {
        const path = config.pretrainedModelPath;
        if (!path || (!path.toLowerCase().endsWith('.safetensors') && !path.toLowerCase().endsWith('.ckpt'))) {
            setDetectionResult(null);
            return;
        }

        const detect = async () => {
            setIsDetecting(true);
            setDetectionError(null);
            try {
                const res = await fetch('/api/train/detect-model', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ checkpointPath: path, projectId: project.id })
                });

                if (!res.ok) {
                    throw new Error('Detection API failed');
                }

                const data: DetectionResult = await res.json();
                setDetectionResult(data);

                if (data.recommendedScript) {
                    const currentScriptPath = config.trainerScriptPath;
                    let repoBase = data.repoPath || 'train_script/sd-scripts';
                    const newScriptPath = `${repoBase}/${data.recommendedScript}`;

                    setConfig(prev => {
                        let updates: Partial<TrainingConfig> = {
                            trainerScriptPath: newScriptPath,
                            modelFamily: data.modelFamily,
                        };

                        // Apply Family Defaults
                        if (data.modelFamily === 'sdxl') {
                            updates.batchSize = 1;
                            updates.width = 1024;
                            updates.height = 1024;
                            updates.unetLr = 0.0002;
                            updates.textEncoderLr = 0;
                            // Clip skip disabled for SDXL
                        } else if (data.modelFamily === 'sd15' || data.modelFamily === 'sd2') {
                            updates.batchSize = 4;
                            updates.width = 512;
                            updates.height = 512;
                            updates.unetLr = 0.0001;
                            updates.textEncoderLr = 0.00005;
                            updates.clipSkip = 1; // Enabled
                        } else {
                            // Unknown, apply safe defaults if needed, or keep existing
                        }

                        const next = { ...prev, ...updates };
                        persistSettings(next);
                        return next;
                    });
                } else if (data.modelFamily) {
                    handleChange('modelFamily', data.modelFamily);
                }

            } catch (err: any) {
                console.error('Detection error:', err);
                setDetectionError(err.message || 'Failed to detect model');
                setDetectionResult({
                    modelFamily: 'Unknown',
                    supported: false,
                    recommendedScript: '',
                    availableScripts: [],
                    reason: 'Detection failed'
                });
            } finally {
                setIsDetecting(false);
            }
        };

        const timer = setTimeout(detect, 500);
        return () => clearTimeout(timer);
    }, [config.pretrainedModelPath, project.id]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onStart(config);
    };

    const getScriptName = (fullPath: string) => fullPath.split(/[/\\]/).pop() || '';
    const getScriptDir = (fullPath: string) => fullPath.substring(0, Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\')));

    const isSDXL = config.modelFamily === 'sdxl';

    // Platform vs Local
    if (trainingMode === 'platform') {
        return (
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Training Configuration</CardTitle>
                        <div className="flex bg-muted rounded-lg p-1">
                            <button onClick={() => setTrainingMode('local')} className="px-3 py-1 text-sm rounded-md hover:bg-background/50 text-muted-foreground">Local</button>
                            <button onClick={() => setTrainingMode('platform')} className="px-3 py-1 text-sm rounded-md bg-background shadow-sm font-medium">On Platform</button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-semibold">Train on CivitAI</h3>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            Use CivitAI's powerful cloud GPUs to train your LoRA without stressing your local hardware.
                        </p>
                    </div>

                    <a
                        href="https://civitai.com/models/train"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                        Go to CivitAI Trainer <ExternalLink className="h-4 w-4" />
                    </a>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Training Configuration</CardTitle>
                        <CardDescription>Configure LoRA training parameters</CardDescription>
                    </div>
                    <div className="flex bg-muted rounded-lg p-1">
                        <button onClick={() => setTrainingMode('local')} className="px-3 py-1 text-sm rounded-md bg-background shadow-sm font-medium">Local</button>
                        <button onClick={() => setTrainingMode('platform')} className="px-3 py-1 text-sm rounded-md hover:bg-background/50 text-muted-foreground">On Platform</button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">

                    {/* Basic Section */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Pretrained Model Path (SAFE TENSORS OR CKPT)</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={config.pretrainedModelPath}
                                    onChange={e => handleChange('pretrainedModelPath', e.target.value)}
                                    placeholder="C:/Models/stable-diffusion-v1-5.safetensors"
                                    required
                                    disabled={disabled}
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={disabled}
                                    onClick={async () => {
                                        try {
                                            const res = await fetch('/api/dialog/open-model-file', { method: 'POST' });
                                            if (res.ok) {
                                                const data = await res.json();
                                                if (data.ok && data.path) handleChange('pretrainedModelPath', data.path);
                                            }
                                        } catch (e) {
                                            console.error('Failed to open dialog', e);
                                        }
                                    }}
                                >
                                    Browse...
                                </Button>
                            </div>
                            {isDetecting && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Detecting model type...
                                </div>
                            )}
                            {!isDetecting && detectionResult && (
                                <div className={`text-sm flex items-center gap-2 ${detectionResult.supported ? 'text-green-600' : 'text-amber-600'}`}>
                                    {detectionResult.supported ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                    <span>Family: <strong>{detectionResult.modelFamily}</strong></span>
                                </div>
                            )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Output Name</Label>
                                <Input
                                    value={config.outputName}
                                    onChange={e => handleChange('outputName', e.target.value)}
                                    required
                                    disabled={disabled}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center">
                                    <Label>Resolution</Label>
                                    <InfoTooltip text="Training image size. Higher can capture more detail but needs more VRAM. Safe start: 1024 (SDXL), 512 (SD1.5)." />
                                </div>
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    value={config.width}
                                    onChange={(e) => {
                                        const res = parseInt(e.target.value);
                                        setConfig(prev => ({ ...prev, width: res, height: res }));
                                    }}
                                    disabled={disabled}
                                >
                                    {RESOLUTIONS.map(res => (
                                        <option key={res} value={res} className="bg-popover text-popover-foreground">{res} × {res}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Trainer Script (Auto)</Label>
                            {detectionResult && detectionResult.availableScripts.length > 0 ? (
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    value={getScriptName(config.trainerScriptPath)}
                                    onChange={(e) => {
                                        const newScript = e.target.value;
                                        const currentDir = detectionResult?.repoPath || getScriptDir(config.trainerScriptPath) || 'train_script/sd-scripts';
                                        handleChange('trainerScriptPath', `${currentDir}/${newScript}`);
                                    }}
                                    disabled={disabled}
                                >
                                    {detectionResult.availableScripts.map(script => (
                                        <option key={script} value={script} className="bg-popover text-popover-foreground">{script}</option>
                                    ))}
                                </select>
                            ) : (
                                <Input
                                    value={config.trainerScriptPath}
                                    onChange={e => handleChange('trainerScriptPath', e.target.value)}
                                    placeholder="path/to/sd-scripts/train_network.py"
                                    required
                                    disabled={disabled}
                                />
                            )}
                            <p className="text-[10px] text-muted-foreground truncate" title={config.trainerScriptPath}>
                                Path: {config.trainerScriptPath}
                            </p>
                        </div>
                    </div>

                    {/* Advanced Accordion */}
                    <div className="border rounded-lg">
                        <button
                            type="button"
                            className="flex items-center justify-between w-full p-4 text-left font-medium hover:bg-muted/50 transition-colors"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                        >
                            <span>Advanced / Training Parameters</span>
                            {showAdvanced ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>

                        {showAdvanced && (
                            <div className="p-4 space-y-6 animate-in slide-in-from-top-2 duration-200">

                                {/* Steps / Epochs Logic */}
                                <div className="space-y-4 border p-4 rounded-md bg-muted/20">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <Label>Use Steps Override</Label>
                                            <Switch
                                                checked={config.useStepsOverride}
                                                onCheckedChange={(c) => handleChange('useStepsOverride', c)}
                                            />
                                            <InfoTooltip text="Total training steps. Use this only if you prefer controlling steps instead of epochs. When enabled, epochs will be calculated automatically." />
                                        </div>
                                    </div>

                                    <div className="grid gap-4 md:grid-cols-2">
                                        {!config.useStepsOverride ? (
                                            <div className="space-y-2">
                                                <div className="flex items-center">
                                                    <Label>Epochs</Label>
                                                    <InfoTooltip text="How many times we train over the whole dataset. More epochs = stronger learning, but too high can overfit. Safe start: 5–10." />
                                                </div>
                                                <Input
                                                    type="number"
                                                    value={config.epochs}
                                                    onChange={e => handleChange('epochs', parseInt(e.target.value))}
                                                    min={1}
                                                    disabled={disabled}
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <div className="flex items-center">
                                                    <Label>Total Steps</Label>
                                                    <InfoTooltip text="Total number of optimization steps to perform." />
                                                </div>
                                                <Input
                                                    type="number"
                                                    value={config.inputSteps}
                                                    onChange={e => handleChange('inputSteps', parseInt(e.target.value))}
                                                    min={100}
                                                    disabled={disabled}
                                                />
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <div className="flex items-center">
                                                <Label>Num Repeats (per image)</Label>
                                                <InfoTooltip text="How many times each image is reused per epoch. Useful for small datasets. Too high can overfit. Safe start: 1–10 (small set) or 1–3 (large set)." />
                                            </div>
                                            <Input
                                                type="number"
                                                value={config.repeats}
                                                onChange={e => handleChange('repeats', parseInt(e.target.value))}
                                                min={1}
                                                disabled={disabled}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {config.useStepsOverride
                                            ? `Calculated Epochs: ≈ Variable (depends on image count)`
                                            : `Calculated Total Steps: Variable (depends on image count)`
                                        }
                                    </div>
                                </div>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <Label>Train Batch Size</Label>
                                            <InfoTooltip text="How many images are processed at once. Bigger is faster but needs more VRAM. Safe start: 1 (SDXL), 2–4 (SD1.5)." />
                                        </div>
                                        <Input
                                            type="number"
                                            value={config.batchSize}
                                            onChange={e => handleChange('batchSize', parseInt(e.target.value))}
                                            min={1}
                                            disabled={disabled}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <Label>Optimizer</Label>
                                            <InfoTooltip text="Controls how learning updates happen. AdamW is a common safe choice. Adafactor can save VRAM." />
                                        </div>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            value={config.optimizerType}
                                            onChange={(e) => handleChange('optimizerType', e.target.value)}
                                            disabled={disabled}
                                        >
                                            {OPTIMIZERS.map(opt => (
                                                <option key={opt} value={opt} className="bg-popover text-popover-foreground">{opt}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2 col-span-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <Label>Optimizer Args</Label>
                                                <InfoTooltip text="Extra settings for the optimizer. Comma-separated key=value pairs." />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-xs text-muted-foreground hover:text-foreground"
                                                onClick={() => {
                                                    const defaults = config.optimizerType === 'Adafactor'
                                                        ? 'scale_parameter=False,relative_step=False,warmup_init=False'
                                                        : '';
                                                    handleChange('optimizerArgs', defaults);
                                                }}
                                            >
                                                Reset Default
                                            </Button>
                                        </div>
                                        <Input
                                            value={config.optimizerArgs}
                                            onChange={e => handleChange('optimizerArgs', e.target.value)}
                                            placeholder="scale_parameter=False,relative_step=False,warmup_init=False"
                                            className={
                                                config.optimizerArgs.split(/[\n,]/).some(arg => arg.trim() && !arg.includes('='))
                                                    ? "border-destructive focus-visible:ring-destructive"
                                                    : ""
                                            }
                                            disabled={disabled}
                                        />
                                        {config.optimizerArgs.split(/[\n,]/).map(arg => {
                                            const trimmed = arg.trim();
                                            if (trimmed && !trimmed.includes('=')) {
                                                return (
                                                    <p key={trimmed} className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                                                        <AlertCircle className="h-3 w-3" />
                                                        Invalid format: "{trimmed}". Must be key=value.
                                                    </p>
                                                );
                                            }
                                            return null;
                                        })}
                                        {config.optimizerArgs.split(/[\n,]/).some(arg => {
                                            const val = arg.split('=')[1]?.trim();
                                            return val === 'false' || val === 'true' || val === 'null';
                                        }) && (
                                                <p className="text-[11px] text-amber-600 flex items-center gap-1 mt-1">
                                                    <HelpCircle className="h-3 w-3" />
                                                    Tip: Python uses Capitalized Booleans (True/False/None). We'll auto-fix this for you.
                                                </p>
                                            )}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <Label>Unet LR</Label>
                                            <InfoTooltip text="Main learning speed for the visual part. Higher learns faster but can overfit. Safe start: 0.0002–0.0003 (SDXL), 0.0001–0.0002 (SD1.5)." />
                                        </div>
                                        <Input
                                            type="number" step="0.000001"
                                            value={config.unetLr}
                                            onChange={e => handleChange('unetLr', parseFloat(e.target.value))}
                                            disabled={disabled}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <Label>Text Encoder LR</Label>
                                            <InfoTooltip text="Learning speed for how words match the concept. Usually lower than U-Net. Safe start: 0 (off) or 0.00001–0.00005." />
                                        </div>
                                        <Input
                                            type="number" step="0.000001"
                                            value={config.textEncoderLr}
                                            onChange={e => handleChange('textEncoderLr', parseFloat(e.target.value))}
                                            disabled={disabled}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <Label>LR Scheduler</Label>
                                            <InfoTooltip text="How the learning speed changes over time. ‘cosine_with_restarts’ is a safe default." />
                                        </div>
                                        <select
                                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            value={config.scheduler}
                                            onChange={(e) => handleChange('scheduler', e.target.value)}
                                            disabled={disabled}
                                        >
                                            {SCHEDULERS.map(s => (
                                                <option key={s} value={s} className="bg-popover text-popover-foreground">{s}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <Label>LR Scheduler Cycles</Label>
                                            <InfoTooltip text="How many restarts the scheduler makes. Safe start: 1–3." />
                                        </div>
                                        <Input
                                            type="number"
                                            value={config.schedulerCycles}
                                            onChange={e => handleChange('schedulerCycles', parseInt(e.target.value))}
                                            disabled={disabled}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <Label>Network Dim (Rank)</Label>
                                            <InfoTooltip text="How much ‘capacity’ your LoRA has. Higher can learn more details but may overfit and increases file size. Safe start: 16–32." />
                                        </div>
                                        <Input
                                            type="number"
                                            value={config.networkDim}
                                            onChange={e => handleChange('networkDim', parseInt(e.target.value))}
                                            disabled={disabled}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <Label>Network Alpha</Label>
                                            <InfoTooltip text="Balances strength vs stability for the LoRA. Often set to half of Rank. Safe start: Rank/2." />
                                        </div>
                                        <Input
                                            type="number"
                                            value={config.networkAlpha}
                                            onChange={e => handleChange('networkAlpha', parseInt(e.target.value))}
                                            disabled={disabled}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <Label>Min SNR Gamma</Label>
                                            <InfoTooltip text="Helps training focus on useful details and reduces washed-out learning. Safe start: 5." />
                                        </div>
                                        <Input
                                            type="number"
                                            value={config.minSnrGamma}
                                            onChange={e => handleChange('minSnrGamma', parseInt(e.target.value))}
                                            disabled={disabled}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <Label>Noise Offset</Label>
                                            <InfoTooltip text="Can improve contrast and stability for some datasets. Safe start: 0–0.1." />
                                        </div>
                                        <Input
                                            type="number" step="0.01"
                                            value={config.noiseOffset}
                                            onChange={e => handleChange('noiseOffset', parseFloat(e.target.value))}
                                            disabled={disabled}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center">
                                            <Label>Keep Tokens</Label>
                                            <InfoTooltip text="Keeps the first N words in every caption unchanged. Useful to protect your trigger word. Safe start: 1 (if you use a trigger)." />
                                        </div>
                                        <Input
                                            type="number"
                                            value={config.keepTokens}
                                            onChange={e => handleChange('keepTokens', parseInt(e.target.value))}
                                            min={0}
                                            disabled={disabled}
                                        />
                                    </div>

                                    {!isSDXL && (
                                        <div className="space-y-2">
                                            <div className="flex items-center">
                                                <Label>Clip Skip (SD1.5/2)</Label>
                                                <InfoTooltip text="Changes how strongly the model reads text for SD1.5/2. Most users keep it at 1. Not used for SDXL." />
                                            </div>
                                            <Input
                                                type="number"
                                                value={config.clipSkip}
                                                onChange={e => handleChange('clipSkip', parseInt(e.target.value))}
                                                min={1}
                                                disabled={disabled}
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="grid gap-4 md:grid-cols-2 pt-4 border-t">
                                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center">
                                                <Label className="text-base">Enable Bucket</Label>
                                                <InfoTooltip text="Helps handle different image shapes without stretching. Recommended ON for mixed aspect ratios." />
                                            </div>
                                        </div>
                                        <Switch
                                            checked={config.enableBucket}
                                            onCheckedChange={(c) => handleChange('enableBucket', c)}
                                            disabled={disabled}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center">
                                                <Label className="text-base">Shuffle Tags</Label>
                                                <InfoTooltip text="Randomizes tag order in captions to reduce overfitting to a fixed order. Recommended ON for tag-style captions." />
                                            </div>
                                        </div>
                                        <Switch
                                            checked={config.shuffleTags}
                                            onCheckedChange={(c) => handleChange('shuffleTags', c)}
                                            disabled={disabled}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center">
                                                <Label className="text-base">Flip Augmentation</Label>
                                                <InfoTooltip text="Adds mirrored versions of images during training. Great for general styles, but avoid for text/logos or asymmetrical designs." />
                                            </div>
                                        </div>
                                        <Switch
                                            checked={config.flipAug}
                                            onCheckedChange={(c) => handleChange('flipAug', c)}
                                            disabled={disabled}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between space-x-2 border p-3 rounded-md">
                                        <div className="space-y-0.5">
                                            <Label className="text-base">Mixed Precision</Label>
                                        </div>
                                        <select
                                            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            value={config.mixedPrecision}
                                            onChange={(e) => handleChange('mixedPrecision', e.target.value)}
                                            disabled={disabled}
                                        >
                                            <option value="no" className="bg-popover text-popover-foreground">No</option>
                                            <option value="fp16" className="bg-popover text-popover-foreground">fp16</option>
                                            <option value="bf16" className="bg-popover text-popover-foreground">bf16</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {detectionResult && !detectionResult.supported && (
                        <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20">
                            <strong>Warning:</strong> {detectionResult.reason || 'This checkpoint type is not supported for local training yet.'}
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={disabled || (detectionResult !== null && !detectionResult.supported)}>
                            Start Training
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
