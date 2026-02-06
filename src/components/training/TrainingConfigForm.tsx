'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Button, Input } from '@/components/ui/core';
import { Label } from '@/components/ui/label';
import { Project } from '@/types';

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
}

interface TrainingConfigFormProps {
    project: Project;
    onStart: (config: TrainingConfig) => void;
    disabled?: boolean;
}

export function TrainingConfigForm({ project, onStart, disabled }: TrainingConfigFormProps) {
    // Default values
    const [config, setConfig] = useState<TrainingConfig>({
        pretrainedModelPath: '', // User must fill
        outputName: project.name.replace(/\s+/g, '_'),
        outputDir: `projects/${project.id}/train_outputs`, // default relative path
        width: project.settings?.targetSize || 512,
        height: project.settings?.targetSize || 512,
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
        trainerScriptPath: 'D:/train_script/sd-scripts/sdxl_train_network.py'
    });

    const handleChange = (field: keyof TrainingConfig, value: any) => {
        setConfig(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onStart(config);
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
                            <Input
                                value={config.pretrainedModelPath}
                                onChange={e => handleChange('pretrainedModelPath', e.target.value)}
                                placeholder="C:/Models/stable-diffusion-v1-5.safetensors"
                                required
                                disabled={disabled}
                            />
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
                            <Label>Trainer Script Path (.py)</Label>
                            <Input
                                value={config.trainerScriptPath}
                                onChange={e => handleChange('trainerScriptPath', e.target.value)}
                                placeholder="path/to/sd-scripts/train_network.py"
                                required
                                disabled={disabled}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Resolution (W x H)</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    value={config.width}
                                    onChange={e => handleChange('width', parseInt(e.target.value))}
                                    disabled={disabled}
                                />
                                <span className="pt-2">x</span>
                                <Input
                                    type="number"
                                    value={config.height}
                                    onChange={e => handleChange('height', parseInt(e.target.value))}
                                    disabled={disabled}
                                />
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

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={disabled}>
                            Start Training
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
