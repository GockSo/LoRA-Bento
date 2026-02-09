'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input } from '@/components/ui/core';
import { Label } from '@/components/ui/label';
import { Project, ProjectSettings } from '@/types';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

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
    trainerScriptPath: string; // Path to sd-scripts train_network.py
    modelFamily?: string;
}

interface TrainingConfigFormProps {
    project: Project;
    onStart: (config: TrainingConfig) => void;
    disabled?: boolean;
}

// Square Only
const RESOLUTIONS = [512, 768, 1024];

interface DetectionResult {
    modelFamily: string;
    supported: boolean;
    recommendedScript: string;
    availableScripts: string[];
    reason: string;
    repoPath?: string;
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
        batchSize: 1,
        epochs: 10,
        saveEveryNSteps: 500,
        learningRate: 0.0001,
        unetLr: 0.0001,
        textEncoderLr: 0.00005,
        networkDim: 32,
        networkAlpha: 16,
        mixedPrecision: 'fp16',
        seed: 42,
        captionExtension: '.txt',
        enableBucket: true,
        repeats: 40,
        trainerScriptPath: project.settings?.train?.trainerScriptPath || 'train_script/sd-scripts/sdxl_train_network.py',
        modelFamily: project.settings?.train?.modelFamily || 'Unknown'
    });

    const [wasSnapped] = useState(isSnapped);
    const [isDetecting, setIsDetecting] = useState(false);
    const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
    const [detectionError, setDetectionError] = useState<string | null>(null);

    // Debounce save helper
    const saveTimeoutRef = useRef<NodeJS.Timeout>(null);

    const persistSettings = useCallback((newConfig: Partial<TrainingConfig>) => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

        saveTimeoutRef.current = setTimeout(() => {
            const updates: ProjectSettings['train'] = {
                mode: project.settings?.train?.mode || 'local',
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
    }, [project.id, project.settings?.train?.mode]);

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
        if (!path || !path.toLowerCase().endsWith('.safetensors') && !path.toLowerCase().endsWith('.ckpt')) {
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
                    // Construct full path assuming standard structure or just filename if that's what we want?

                    const currentScriptPath = config.trainerScriptPath;
                    // Use detected repo path or relative fallback if not available
                    let repoBase = data.repoPath || 'train_script/sd-scripts';

                    // Note: We prioritize the backend's reported repoPath. 
                    // Only fallback to parsing currentScriptPath if absolutely necessary, but strictly speaking backend should provide it now.

                    const newScriptPath = `${repoBase}/${data.recommendedScript}`;

                    setConfig(prev => {
                        const next = {
                            ...prev,
                            trainerScriptPath: newScriptPath,
                            modelFamily: data.modelFamily
                        };
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

        const timer = setTimeout(detect, 500); // Debounce detection slightly
        return () => clearTimeout(timer);
    }, [config.pretrainedModelPath, project.id]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onStart(config);
    };

    // Helper to get filename from path
    const getScriptName = (fullPath: string) => {
        return fullPath.split(/[/\\]/).pop() || '';
    };

    // Helper to get directory from path
    const getScriptDir = (fullPath: string) => {
        return fullPath.substring(0, Math.max(fullPath.lastIndexOf('/'), fullPath.lastIndexOf('\\')));
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Training Configuration</CardTitle>
                <CardDescription>Configure LoRA training parameters</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2 col-span-2">
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
                                            const res = await fetch('/api/dialog/open-model-file', {
                                                method: 'POST'
                                            });
                                            if (res.ok) {
                                                const data = await res.json();
                                                if (data.ok && data.path) {
                                                    handleChange('pretrainedModelPath', data.path);
                                                }
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
                                    {!detectionResult.supported && (
                                        <span className="text-xs ml-2">({detectionResult.reason})</span>
                                    )}
                                </div>
                            )}
                        </div>

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
                            <Label>Trainer Script (Auto)</Label>
                            {/* If we have available scripts, show dropdown, else fallback to input or show empty */}
                            {detectionResult && detectionResult.availableScripts.length > 0 ? (
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    value={getScriptName(config.trainerScriptPath)}
                                    onChange={(e) => {
                                        const newScript = e.target.value;
                                        // Use repo path from detection result if available, otherwise try to parse from current or fallback
                                        const currentDir = detectionResult?.repoPath || getScriptDir(config.trainerScriptPath) || 'train_script/sd-scripts';
                                        handleChange('trainerScriptPath', `${currentDir}/${newScript}`);
                                    }}
                                    disabled={disabled}
                                >
                                    {detectionResult.availableScripts.map(script => (
                                        <option key={script} value={script} className="bg-popover text-popover-foreground">
                                            {script}
                                        </option>
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
                                Resolved path: {config.trainerScriptPath}
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Resolution</Label>
                            <div className="space-y-2">
                                <select
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    value={config.width} // Both will be same
                                    onChange={(e) => {
                                        const res = parseInt(e.target.value);
                                        setConfig(prev => ({ ...prev, width: res, height: res }));
                                    }}
                                    disabled={disabled}
                                >
                                    {RESOLUTIONS.map(res => (
                                        <option key={res} value={res} className="bg-popover text-popover-foreground">
                                            {res} × {res}
                                        </option>
                                    ))}
                                </select>
                                {wasSnapped && (
                                    <p className="text-xs text-yellow-500">
                                        Note: Resolution was adjusted to the nearest supported square preset.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Batch Size</Label>
                            <Input
                                type="number"
                                value={config.batchSize}
                                onChange={e => handleChange('batchSize', parseInt(e.target.value))}
                                min={1}
                                disabled={disabled}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Epochs</Label>
                            <Input
                                type="number"
                                value={config.epochs}
                                onChange={e => handleChange('epochs', parseInt(e.target.value))}
                                min={1}
                                disabled={disabled}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Repeats (per image)</Label>
                            <Input
                                type="number"
                                value={config.repeats}
                                onChange={e => handleChange('repeats', parseInt(e.target.value))}
                                min={1}
                                disabled={disabled}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Learning Rate</Label>
                            <Input
                                type="number" step="0.000001"
                                value={config.learningRate}
                                onChange={e => handleChange('learningRate', parseFloat(e.target.value))}
                                disabled={disabled}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Network Dim</Label>
                            <Input
                                type="number"
                                value={config.networkDim}
                                onChange={e => handleChange('networkDim', parseInt(e.target.value))}
                                disabled={disabled}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Network Alpha</Label>
                            <Input
                                type="number"
                                value={config.networkAlpha}
                                onChange={e => handleChange('networkAlpha', parseInt(e.target.value))}
                                disabled={disabled}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Mixed Precision</Label>
                            <select
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                value={config.mixedPrecision}
                                onChange={(e) => handleChange('mixedPrecision', e.target.value)}
                                disabled={disabled}
                            >
                                <option value="no" className="bg-popover text-popover-foreground">No</option>
                                <option value="fp16" className="bg-popover text-popover-foreground">fp16</option>
                                <option value="bf16" className="bg-popover text-popover-foreground">bf16</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <Label>Seed</Label>
                            <Input
                                type="number"
                                value={config.seed}
                                onChange={e => handleChange('seed', parseInt(e.target.value))}
                                disabled={disabled}
                            />
                        </div>
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
