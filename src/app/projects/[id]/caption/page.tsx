'use client';

import { useState, use, useEffect, useRef } from 'react';
import { Button, Card, Input, Progress } from '@/components/ui/core';
import { Label } from '@/components/ui/label';
import { Loader2, Play, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import {
    CaptionMode,
    TaggerModel,
    CaptionerModel,
    CaptionConfig,
    DEFAULT_CAPTION_CONFIG,
    CaptionPreviewResult
} from '@/types/caption';

interface JobStatus {
    status: 'idle' | 'starting' | 'processing' | 'completed' | 'error';
    progress: number;
    total: number;
    current_file?: string;
    error?: string;
    summary?: {
        mode: 'tags' | 'sentence';
        topItems: { text: string; count: number }[];
        uniqueCount: number;
        samples?: string[];
    };
}

export default function CaptionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { t } = useTranslation();
    const router = useRouter();

    // State
    const [config, setConfig] = useState<CaptionConfig>(DEFAULT_CAPTION_CONFIG);
    const [job, setJob] = useState<JobStatus>({ status: 'idle', progress: 0, total: 0 });
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewSamples, setPreviewSamples] = useState<CaptionPreviewResult[]>([]);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // Load project name and config on mount
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Load project for trigger word suggestion
                const projectRes = await fetch(`/api/projects/${id}`);
                const projectData = await projectRes.json();

                // Load saved caption config
                const configRes = await fetch(`/api/projects/${id}/caption/config`);
                const savedConfig = await configRes.json();

                setConfig({
                    ...savedConfig,
                    triggerWord: savedConfig.triggerWord || projectData.name || ''
                });
            } catch (e) {
                console.error('Failed to load initial data', e);
            }
        };
        loadInitialData();
        checkStatus();

        return () => stopPolling();
    }, [id]);

    // Polling
    const startPolling = () => {
        if (pollingRef.current) return;
        pollingRef.current = setInterval(checkStatus, 1000);
    };

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    const checkStatus = async () => {
        try {
            const res = await fetch(`/api/projects/${id}/caption`);
            if (res.ok) {
                const data: JobStatus = await res.json();
                setJob(data);

                if (data.status === 'completed' || data.status === 'error') {
                    stopPolling();
                    if (data.status === 'completed') router.refresh();
                } else if (data.status === 'processing' || data.status === 'starting') {
                    startPolling();
                }
            }
        } catch {
            // ignore
        }
    };

    // Save config
    const saveConfig = async (newConfig: CaptionConfig) => {
        try {
            await fetch(`/api/projects/${id}/caption/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newConfig)
            });
        } catch (e) {
            console.error('Failed to save config', e);
        }
    };

    // Update config helper
    const updateConfig = (updates: Partial<CaptionConfig>) => {
        const newConfig = { ...config, ...updates };
        setConfig(newConfig);
        saveConfig(newConfig);
    };

    const updateAdvanced = (updates: Partial<CaptionConfig['advanced']>) => {
        const newConfig = {
            ...config,
            advanced: { ...config.advanced, ...updates }
        };
        setConfig(newConfig);
        saveConfig(newConfig);
    };

    // Run preview
    const runPreview = async () => {
        setIsPreviewing(true);
        try {
            const res = await fetch(`/api/projects/${id}/caption/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                const data = await res.json();
                setPreviewSamples(data.samples);
                setShowPreview(true);
            } else {
                const err = await res.json();
                toast.error(err.error || 'Preview failed');
            }
        } catch {
            toast.error('Failed to generate preview');
        } finally {
            setIsPreviewing(false);
        }
    };

    // Run captioning
    const runCaptioning = async () => {
        setJob({ status: 'starting', progress: 0, total: 0 });
        try {
            const res = await fetch(`/api/projects/${id}/caption`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                startPolling();
            } else {
                const err = await res.json();
                setJob(prev => ({ ...prev, status: 'error', error: err.error }));
                toast.error(err.error);
            }
        } catch {
            setJob(prev => ({ ...prev, status: 'error', error: 'Failed to start' }));
        }
    };

    const isRunning = job.status === 'processing' || job.status === 'starting';
    const progressPercent = job.total > 0 ? Math.round((job.progress / job.total) * 100) : 0;

    return (
        <div className="container mx-auto py-8 px-4 max-w-4xl space-y-6">
            <h1 className="text-3xl font-bold">Caption Images</h1>

            {/* Mode Selector */}
            <Card className="p-6">
                <Label className="text-base font-semibold mb-3 block">
                    {t('caption_v2.mode.label')}
                </Label>
                <div className="grid grid-cols-3 gap-3">
                    {(['tags', 'caption', 'hybrid'] as CaptionMode[]).map(mode => (
                        <button
                            key={mode}
                            onClick={() => updateConfig({ mode })}
                            disabled={isRunning}
                            className={cn(
                                "px-4 py-3 rounded-lg border-2 text-sm font-medium transition-all",
                                config.mode === mode
                                    ? "border-blue-600 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100"
                                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
                                isRunning && "opacity-50 cursor-not-allowed"
                            )}
                        >
                            {t(`caption_v2.mode.${mode}`)}
                        </button>
                    ))}
                </div>
            </Card>

            {/* Model Selectors */}
            <Card className="p-6 space-y-4">
                {(config.mode === 'tags' || config.mode === 'hybrid') && (
                    <div>
                        <Label className="mb-2">{t('caption_v2.model.tagger_label')}</Label>
                        <select
                            value={config.taggerModel}
                            onChange={(e) => updateConfig({ taggerModel: e.target.value as TaggerModel })}
                            disabled={isRunning}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                        >
                            <option value="legacy">{t('caption_v2.model.wd14_legacy')}</option>
                            <option value="convnext">{t('caption_v2.model.wd14_convnext')}</option>
                            <option value="swinv2">{t('caption_v2.model.wd14_swinv2')}</option>
                        </select>
                    </div>
                )}

                {(config.mode === 'caption' || config.mode === 'hybrid') && (
                    <div>
                        <Label className="mb-2">{t('caption_v2.model.captioner_label')}</Label>
                        <select
                            value={config.captionerModel}
                            onChange={(e) => updateConfig({ captionerModel: e.target.value as CaptionerModel })}
                            disabled={isRunning}
                            className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                        >
                            <option value="blip">{t('caption_v2.model.blip_legacy')}</option>
                            <option value="blip2">{t('caption_v2.model.blip2')}</option>
                            <option value="florence2">{t('caption_v2.model.florence2')}</option>
                        </select>
                    </div>
                )}

                {/* Trigger Word */}
                <div>
                    <Label className="mb-2">{t('caption_v2.trigger.label')}</Label>
                    <Input
                        value={config.triggerWord}
                        onChange={(e) => updateConfig({ triggerWord: e.target.value })}
                        placeholder={t('caption_v2.trigger.placeholder')}
                        disabled={isRunning}
                    />
                    <p className="text-sm text-gray-500 mt-1">{t('caption_v2.trigger.desc')}</p>
                </div>
            </Card>

            {/* Advanced Settings Accordion */}
            <Card className="p-6">
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center justify-between w-full text-left"
                >
                    <span className="text-base font-semibold">{t('caption_v2.advanced.title')}</span>
                    {showAdvanced ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>

                {showAdvanced && (
                    <div className="mt-6 space-y-6">
                        {/* Tagger Parameters */}
                        {(config.mode === 'tags' || config.mode === 'hybrid') && (
                            <div className="space-y-4 pb-6 border-b dark:border-gray-700">
                                <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300">
                                    {t('caption_v2.advanced.tagger_params')}
                                </h3>

                                <div>
                                    <Label className="mb-2">
                                        {t('caption_v2.advanced.tag_threshold')}: {config.advanced.tagThreshold.toFixed(2)}
                                    </Label>
                                    <input
                                        type="range"
                                        min="0.10"
                                        max="0.90"
                                        step="0.05"
                                        value={config.advanced.tagThreshold}
                                        onChange={(e) => updateAdvanced({ tagThreshold: parseFloat(e.target.value) })}
                                        disabled={isRunning}
                                        className="w-full"
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {t('caption_v2.advanced.tag_threshold_desc')}
                                    </p>
                                </div>

                                <div>
                                    <Label className="mb-2">{t('caption_v2.advanced.max_tags')}</Label>
                                    <Input
                                        type="number"
                                        value={config.advanced.maxTags}
                                        onChange={(e) => updateAdvanced({ maxTags: parseInt(e.target.value) || 60 })}
                                        disabled={isRunning}
                                    />
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {t('caption_v2.advanced.max_tags_desc')}
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="normalize"
                                        checked={config.advanced.normalizeTags}
                                        onChange={(e) => updateAdvanced({ normalizeTags: e.target.checked })}
                                        disabled={isRunning}
                                    />
                                    <Label htmlFor="normalize">{t('caption_v2.advanced.normalize_tags')}</Label>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="shuffle"
                                        checked={config.advanced.shuffleTags}
                                        onChange={(e) => updateAdvanced({ shuffleTags: e.target.checked })}
                                        disabled={isRunning}
                                    />
                                    <Label htmlFor="shuffle">{t('caption_v2.advanced.shuffle_tags')}</Label>
                                </div>

                                <div>
                                    <Label className="mb-2">{t('caption_v2.advanced.tag_ordering')}</Label>
                                    <select
                                        value={config.advanced.tagOrdering}
                                        onChange={(e) => updateAdvanced({ tagOrdering: e.target.value as any })}
                                        disabled={isRunning}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                    >
                                        <option value="confidence">{t('caption_v2.advanced.order_confidence')}</option>
                                        <option value="alphabetical">{t('caption_v2.advanced.order_alphabetical')}</option>
                                        <option value="model">{t('caption_v2.advanced.order_model')}</option>
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Captioner Parameters */}
                        {(config.mode === 'caption' || config.mode === 'hybrid') && (
                            <div className="space-y-4 pb-6 border-b dark:border-gray-700">
                                <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300">
                                    {t('caption_v2.advanced.captioner_params')}
                                </h3>

                                <div>
                                    <Label className="mb-2">{t('caption_v2.advanced.caption_style')}</Label>
                                    <select
                                        value={config.advanced.captionStyle}
                                        onChange={(e) => updateAdvanced({ captionStyle: e.target.value as any })}
                                        disabled={isRunning}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                    >
                                        <option value="short">{t('caption_v2.advanced.style_short')}</option>
                                        <option value="medium">{t('caption_v2.advanced.style_medium')}</option>
                                        <option value="detailed">{t('caption_v2.advanced.style_detailed')}</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="avoid-generic"
                                        checked={config.advanced.avoidGenericPhrases}
                                        onChange={(e) => updateAdvanced({ avoidGenericPhrases: e.target.checked })}
                                        disabled={isRunning}
                                    />
                                    <Label htmlFor="avoid-generic">{t('caption_v2.advanced.avoid_generic')}</Label>
                                </div>
                            </div>
                        )}

                        {/* Hybrid Parameters */}
                        {config.mode === 'hybrid' && (
                            <div className="space-y-4">
                                <h3 className="font-medium text-sm text-gray-700 dark:text-gray-300">
                                    {t('caption_v2.advanced.hybrid_params')}
                                </h3>

                                <div>
                                    <Label className="mb-2">{t('caption_v2.advanced.merge_format')}</Label>
                                    <select
                                        value={config.advanced.mergeFormat}
                                        onChange={(e) => updateAdvanced({ mergeFormat: e.target.value as any })}
                                        disabled={isRunning}
                                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                                    >
                                        <option value="trigger_tags_caption">{t('caption_v2.advanced.merge_ttc')}</option>
                                        <option value="trigger_caption_tags">{t('caption_v2.advanced.merge_tct')}</option>
                                        <option value="tags_only">{t('caption_v2.advanced.merge_tags_only')}</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="dedupe"
                                        checked={config.advanced.deduplicate}
                                        onChange={(e) => updateAdvanced({ deduplicate: e.target.checked })}
                                        disabled={isRunning}
                                    />
                                    <Label htmlFor="dedupe">{t('caption_v2.advanced.deduplicate')}</Label>
                                </div>

                                <div>
                                    <Label className="mb-2">{t('caption_v2.advanced.max_length')}</Label>
                                    <Input
                                        type="number"
                                        value={config.advanced.maxCaptionLength}
                                        onChange={(e) => updateAdvanced({ maxCaptionLength: parseInt(e.target.value) || 220 })}
                                        disabled={isRunning}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button
                    onClick={runPreview}
                    disabled={isRunning || isPreviewing}
                    variant="outline"
                    className="flex-1"
                >
                    {isPreviewing ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('caption_v2.status.previewing')}
                        </>
                    ) : (
                        <>
                            <Eye className="w-4 h-4 mr-2" />
                            {t('caption_v2.preview.button')}
                        </>
                    )}
                </Button>

                <Button
                    onClick={runCaptioning}
                    disabled={isRunning}
                    className="flex-1"
                >
                    {isRunning ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {t('caption_v2.status.running')}
                        </>
                    ) : (
                        <>
                            <Play className="w-4 h-4 mr-2" />
                            {t('caption_v2.status.start_captioning')}
                        </>
                    )}
                </Button>
            </div>

            {/* Progress */}
            {isRunning && (
                <Card className="p-6">
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span>Progress: {job.progress} / {job.total}</span>
                            <span>{progressPercent}%</span>
                        </div>
                        <Progress value={progressPercent} />
                        {job.current_file && (
                            <p className="text-xs text-gray-500">Processing: {job.current_file}</p>
                        )}
                    </div>
                </Card>
            )}

            {/* Results Summary */}
            {job.status === 'completed' && job.summary && (
                <Card className="p-6">
                    <h2 className="text-lg font-semibold mb-4">Results</h2>
                    <div className="space-y-4">
                        <p className="text-sm">
                            <strong>{job.summary.uniqueCount}</strong> unique {job.summary.mode === 'tags' ? 'tags' : 'keywords'}
                        </p>

                        <div className="flex flex-wrap gap-2">
                            {job.summary.topItems.slice(0, 30).map((item, i) => (
                                <span
                                    key={i}
                                    className="px-3 py-1 rounded-full text-xs border"
                                >
                                    {item.text} <span className="opacity-60">({item.count})</span>
                                </span>
                            ))}
                        </div>

                        {job.summary.samples && job.summary.samples.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium mb-2">Sample Captions:</h3>
                                <div className="space-y-1">
                                    {job.summary.samples.map((sample, i) => (
                                        <p key={i} className="text-sm italic text-gray-600 dark:text-gray-400">
                                            "{sample}"
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            )}

            {/* Preview Modal */}
            {showPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="max-w-3xl w-full max-h-[90vh] overflow-auto p-6">
                        <h2 className="text-xl font-bold mb-4">{t('caption_v2.preview.modal_title')}</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                            {t('caption_v2.preview.modal_desc')}
                        </p>

                        <div className="space-y-6">
                            {previewSamples.map((sample, i) => (
                                <div key={i} className="border rounded-lg p-4 dark:border-gray-700">
                                    <img
                                        src={sample.imageUrl}
                                        alt={sample.image}
                                        className="w-full h-48 object-contain mb-3 rounded"
                                    />
                                    <p className="text-sm font-mono bg-gray-100 dark:bg-gray-800 p-3 rounded">
                                        {sample.caption}
                                    </p>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => setShowPreview(false)}
                                className="flex-1"
                            >
                                Close
                            </Button>
                            <Button
                                onClick={() => {
                                    setShowPreview(false);
                                    runCaptioning();
                                }}
                                className="flex-1"
                            >
                                {t('caption_v2.preview.apply')}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
