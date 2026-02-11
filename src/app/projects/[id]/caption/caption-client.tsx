'use client';

import { use, useEffect, useState, useRef } from 'react';
import { Button, Card } from '@/components/ui/core';
import { Settings, Play, SkipForward } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Import our new caption components
import { ModelSelector } from '@/components/caption/model-selector';
import { ModelInstallerModal } from '@/components/caption/model-installer-modal';
import { TagEditorPanel } from '@/components/caption/tag-editor-panel';
import { ImageBrowserPanel } from '@/components/caption/image-browser-panel';
import { CaptionSettingsPanel } from '@/components/caption/caption-settings-panel';
import { AutoTagProgress } from '@/components/caption/auto-tag-progress';

import { WDModel, ModelInfo, CaptionImage } from '@/types/wd-models';
import { CaptionConfig, DEFAULT_CAPTION_CONFIG } from '@/types/caption';
import { WD_MODELS } from '@/lib/wd-models';

export default function CaptionClient({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { t } = useTranslation();
    const router = useRouter();

    // Model management
    const [config, setConfig] = useState<CaptionConfig>(DEFAULT_CAPTION_CONFIG);
    const [models, setModels] = useState<ModelInfo[]>([]);
    const [isInstallerOpen, setIsInstallerOpen] = useState(false);
    const [installJobId, setInstallJobId] = useState<string | null>(null);
    const [installingRepoId, setInstallingRepoId] = useState('');
    const [isInstalling, setIsInstalling] = useState(false);

    // Image/tag management
    const [images, setImages] = useState<CaptionImage[]>([]);
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [editedIds, setEditedIds] = useState<Set<string>>(new Set());

    // UI state
    const [showSettings, setShowSettings] = useState(false);
    const [isAutoTagging, setIsAutoTagging] = useState(false);
    const [autoTagProgress, setAutoTagProgress] = useState({ current: 0, total: 0, filename: '' });

    const pollingRef = useRef<NodeJS.Timeout | null>(null);

    // Load initial data
    useEffect(() => {
        // CRITICAL: Reset install modal state on mount to prevent auto-open
        setIsInstallerOpen(false);
        setIsInstalling(false);
        setInstallJobId(null);
        setInstallingRepoId('');

        loadModels();
        loadConfig();
        loadImages();
        checkAutoTagStatus();

        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, [id]);

    const loadModels = async () => {
        try {
            // Try to fetch from API, fall back to static list
            const res = await fetch('/api/wd/models');
            if (res.ok) {
                const data = await res.json();
                setModels(data);
            } else {
                // Use static list with installed=false
                setModels(WD_MODELS.map(m => ({ ...m, installed: false })));
            }
        } catch (err) {
            setModels(WD_MODELS.map(m => ({ ...m, installed: false })));
        }
    };

    const loadConfig = async () => {
        try {
            const res = await fetch(`/api/projects/${id}/caption/config`);
            if (res.ok) {
                const data = await res.json();
                setConfig(data);
            }
        } catch (err) {
            console.error('Failed to load config:', err);
        }
    };

    const loadImages = async () => {
        try {
            const res = await fetch(`/api/projects/${id}/caption/images`);
            if (res.ok) {
                const data = await res.json();
                setImages(data.images || []);
                if (data.images?.length > 0 && !selectedImageId) {
                    setSelectedImageId(data.images[0].id);
                }
            }
        } catch (err) {
            console.error('Failed to load images:', err);
        }
    };

    const checkAutoTagStatus = async () => {
        try {
            const res = await fetch(`/api/projects/${id}/caption`);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'processing' || data.status === 'starting') {
                    setIsAutoTagging(true);
                    setAutoTagProgress({
                        current: data.progress || 0,
                        total: data.total || 0,
                        filename: data.current_file || ''
                    });
                    startPolling();
                }
            }
        } catch (err) {
            console.error('Failed to check status', err);
        }
    };

    const startPolling = () => {
        if (pollingRef.current) return;
        pollingRef.current = setInterval(async () => {
            const res = await fetch(`/api/projects/${id}/caption`);
            if (res.ok) {
                const data = await res.json();
                setAutoTagProgress({
                    current: data.progress || 0,
                    total: data.total || 0,
                    filename: data.current_file || ''
                });

                if (data.status === 'completed' || data.status === 'error') {
                    stopPolling();
                    setIsAutoTagging(false);
                    if (data.status === 'completed') {
                        toast.success('Auto tagging completed!');
                        loadImages();
                    } else {
                        toast.error('Auto tagging failed');
                    }
                }
            }
        }, 1000);
    };

    const stopPolling = () => {
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
    };

    const handleInstallClick = async (repoId: string) => {
        setInstallingRepoId(repoId);
        setIsInstalling(true);
        setIsInstallerOpen(true);

        try {
            const res = await fetch('/api/wd/models/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repo_id: repoId })
            });

            if (res.ok) {
                const data = await res.json();
                setInstallJobId(data.job_id);
            } else {
                toast.error('Failed to start installation');
                setIsInstalling(false);
                setIsInstallerOpen(false);
            }
        } catch (err) {
            toast.error('Failed to start installation');
            setIsInstalling(false);
            setIsInstallerOpen(false);
        }
    };

    const handleSaveTags = async (tags: string[]) => {
        if (!selectedImageId) return;

        try {
            const res = await fetch(`/api/projects/${id}/caption/images/${selectedImageId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tags })
            });

            if (res.ok) {
                toast.success('Tags saved');
                setEditedIds(prev => new Set([...prev, selectedImageId]));
                // Update local image data
                setImages(prev => prev.map(img =>
                    img.id === selectedImageId ? { ...img, tags, is_edited: true } : img
                ));
            } else {
                toast.error('Failed to save tags');
            }
        } catch (err) {
            toast.error('Failed to save tags');
        }
    };

    const handleRegenerateTags = async () => {
        if (!selectedImageId) return;

        try {
            const res = await fetch(`/api/projects/${id}/caption/images/${selectedImageId}/regenerate`, {
                method: 'POST'
            });

            if (res.ok) {
                const data = await res.json();
                toast.success('Tags regenerated');
                setImages(prev => prev.map(img =>
                    img.id === selectedImageId ? { ...img, tags: data.tags } : img
                ));
            } else {
                toast.error('Failed to regenerate tags');
            }
        } catch (err) {
            toast.error('Failed to regenerate tags');
        }
    };

    const handleRevertTags = () => {
        loadImages(); // Reload to get original tags
        toast.info('Tags reverted');
    };

    const handleAutoTagAll = async () => {
        const selectedModel = models.find(m => m.key === config.wdModel);
        if (!selectedModel?.installed) {
            toast.error('Please install the selected model first');
            return;
        }

        try {
            const res = await fetch(`/api/projects/${id}/caption`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });

            if (res.ok) {
                setIsAutoTagging(true);
                startPolling();
                toast.success('Auto tagging started');
            } else {
                toast.error('Failed to start auto tagging');
            }
        } catch (err) {
            toast.error('Failed to start auto tagging');
        }
    };

    const handleSkipCaptioning = async () => {
        try {
            const res = await fetch(`/api/projects/${id}/caption/skip`, {
                method: 'POST'
            });

            if (res.ok) {
                toast.success('Skipped captioning, moved to train_data');
                router.push(`/projects/${id}/train`);
            } else {
                toast.error('Failed to skip captioning');
            }
        } catch (err) {
            toast.error('Failed to skip captioning');
        }
    };

    const selectedImage = images.find(img => img.id === selectedImageId) || null;
    const selectedModel = models.find(m => m.key === config.wdModel);
    const isModelInstalled = selectedModel?.installed || false;

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Top Bar */}
            <Card className="p-6 space-y-4">
                <h1 className="text-2xl font-bold">{t('caption.wd_only_title')}</h1>

                {/* Model Selector */}
                <ModelSelector
                    value={config.wdModel}
                    onChange={(model) => setConfig({ ...config, wdModel: model })}
                    models={models}
                    onInstallClick={handleInstallClick}
                    isInstalling={isInstalling}
                />

                {/* Actions */}
                <div className="flex gap-3">
                    <Button
                        onClick={handleAutoTagAll}
                        disabled={!isModelInstalled || isAutoTagging}
                        className="flex items-center gap-2"
                    >
                        <Play className="w-4 h-4" />
                        {t('caption.auto_tag_all')}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleSkipCaptioning}
                        className="flex items-center gap-2"
                    >
                        <SkipForward className="w-4 h-4" />
                        Skip Captioning
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => setShowSettings(!showSettings)}
                        className="flex items-center gap-2"
                    >
                        <Settings className="w-4 h-4" />
                        {t('caption.settings.title')}
                    </Button>
                </div>

                {/* Auto-tag Progress */}
                {isAutoTagging && (
                    <AutoTagProgress
                        current={autoTagProgress.current}
                        total={autoTagProgress.total}
                        currentFilename={autoTagProgress.filename}
                    />
                )}
            </Card>

            {/* 3-Zone Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Image Browser */}
                <Card className="p-4 lg:col-span-1 h-[600px]">
                    <ImageBrowserPanel
                        images={images}
                        selectedId={selectedImageId}
                        onSelect={setSelectedImageId}
                        editedIds={editedIds}
                    />
                </Card>

                {/* Right: Tag Editor or Settings */}
                <Card className="p-4 lg:col-span-2 h-[600px] overflow-auto">
                    {showSettings ? (
                        <CaptionSettingsPanel
                            settings={config.advanced}
                            onChange={(newSettings) => setConfig({
                                ...config,
                                advanced: { ...config.advanced, ...newSettings }
                            })}
                        />
                    ) : (
                        <TagEditorPanel
                            image={selectedImage}
                            onSave={handleSaveTags}
                            onRegenerate={handleRegenerateTags}
                            onRevert={handleRevertTags}
                        />
                    )}
                </Card>
            </div>

            {/* Model Installer Modal */}
            <ModelInstallerModal
                isOpen={isInstallerOpen}
                onClose={() => {
                    // Always allow closing - reset all install-related state
                    setIsInstallerOpen(false);
                    setIsInstalling(false);
                    setInstallJobId(null);
                    setInstallingRepoId('');
                    // Refresh model list to show any completed installs
                    loadModels();
                }}
                jobId={installJobId}
                repoId={installingRepoId}
            />
        </div>
    );
}
