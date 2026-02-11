'use client';

import { useState } from 'react';
import { Button, Card } from '@/components/ui/core';
import { Settings, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModelSelector } from '@/components/caption/model-selector';
import { ModelInstallerModal } from '@/components/caption/model-installer-modal';
import { TagEditorPanel } from '@/components/caption/tag-editor-panel';
import { ImageBrowserPanel } from '@/components/caption/image-browser-panel';
import { CaptionSettingsPanel } from '@/components/caption/caption-settings-panel';
import { AutoTagProgress } from '@/components/caption/auto-tag-progress';
import { WDModel, ModelInfo, CaptionImage } from '@/types/wd-models';
import { CaptionAdvancedSettings } from '@/types/caption';

// Mock data for demonstration
const MOCK_MODELS: ModelInfo[] = [
    {
        key: 'wd-v1-4-convnext-tagger-v2',
        repo_id: 'SmilingWolf/wd-v1-4-convnext-tagger-v2',
        label: 'WD v1.4 ConvNeXt',
        installed: true,
        size_mb: 255
    },
    {
        key: 'wd-v1-4-moat-tagger-v2',
        repo_id: 'SmilingWolf/wd-v1-4-moat-tagger-v2',
        label: 'WD v1.4 MoAT (SwinV2)',
        installed: false,
        size_mb: 344
    },
    {
        key: 'wd-eva02-large-tagger-v3',
        repo_id: 'SmilingWolf/wd-eva02-large-tagger-v3',
        label: 'WD EVA02-Large v3',
        installed: false,
        size_mb: 921
    },
    {
        key: 'wd-v1-4-vit-tagger-v2',
        repo_id: 'SmilingWolf/wd-v1-4-vit-tagger-v2',
        label: 'WD v1.4 ViT',
        installed: false,
        size_mb: 312
    }
];

const MOCK_IMAGES: CaptionImage[] = [
    {
        id: '1',
        filename: 'image_001.jpg',
        url: '/placeholder-image.jpg',
        tags: ['1girl', 'solo', 'long_hair', 'blue_eyes', 'smile', 'looking_at_viewer'],
        has_caption: true,
        is_edited: false
    },
    {
        id: '2',
        filename: 'image_002.jpg',
        url: '/placeholder-image.jpg',
        tags: ['1boy', 'short_hair', 'sword', 'armor'],
        has_caption: true,
        is_edited: true
    },
    // Add more mock images as needed
];

export function CaptionDemo() {
    const { t } = useTranslation();

    // Model management
    const [selectedModel, setSelectedModel] = useState<WDModel>('wd-v1-4-convnext-tagger-v2');
    const [isInstallerOpen, setIsInstallerOpen] = useState(false);
    const [installJobId, setInstallJobId] = useState<string | null>(null);
    const [installingRepoId, setInstallingRepoId] = useState('');
    const [isInstalling, setIsInstalling] = useState(false);

    // Image/tag management
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [editedIds, setEditedIds] = useState<Set<string>>(new Set());

    // Settings
    const [showSettings, setShowSettings] = useState(false);
    const [settings, setSettings] = useState<CaptionAdvancedSettings>({
        tagThreshold: 0.35,
        maxTags: 60,
        excludeTags: '',
        normalizeTags: true,
        tagOrdering: 'confidence',
        keepFirstTokens: 1,
        shuffleTags: true
    });

    // Auto-tag progress
    const [isAutoTagging, setIsAutoTagging] = useState(false);
    const [autoTagProgress, setAutoTagProgress] = useState({ current: 0, total: 0, filename: '' });

    const selectedImage = MOCK_IMAGES.find(img => img.id === selectedImageId) || null;

    const handleInstallClick = async (repoId: string) => {
        setInstallingRepoId(repoId);
        setIsInstalling(true);
        setIsInstallerOpen(true);

        // Mock API call
        // In real implementation: const res = await fetch('/api/wd/models/install', { method: 'POST', body: JSON.stringify({ repo_id: repoId }) });
        // const { job_id } = await res.json();
        setInstallJobId('mock-job-id');
    };

    const handleSaveTags = async (tags: string[]) => {
        // Mock save
        console.log('Saving tags:', tags);
        setEditedIds(prev => new Set([...prev, selectedImageId!]));
    };

    const handleRegenerateTags = async () => {
        // Mock regenerate
        console.log('Regenerating tags for:', selectedImageId);
    };

    const handleRevertTags = () => {
        // Mock revert
        console.log('Reverting tags for:', selectedImageId);
    };

    const handleAutoTagAll = () => {
        setIsAutoTagging(true);
        // Mock progress
        let current = 0;
        const interval = setInterval(() => {
            current++;
            setAutoTagProgress({ current, total: MOCK_IMAGES.length, filename: `image_${current.toString().padStart(3, '0')}.jpg` });
            if (current >= MOCK_IMAGES.length) {
                clearInterval(interval);
                setIsAutoTagging(false);
            }
        }, 1000);
    };

    const isModelInstalled = MOCK_MODELS.find(m => m.key === selectedModel)?.installed || false;

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Top Bar */}
            <Card className="p-6 space-y-4">
                <h1 className="text-2xl font-bold">{t('caption.wd_only_title')}</h1>

                {/* Model Selector */}
                <ModelSelector
                    value={selectedModel}
                    onChange={setSelectedModel}
                    models={MOCK_MODELS}
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
                        images={MOCK_IMAGES}
                        selectedId={selectedImageId}
                        onSelect={setSelectedImageId}
                        editedIds={editedIds}
                    />
                </Card>

                {/* Right: Tag Editor or Settings */}
                <Card className="p-4 lg:col-span-2 h-[600px] overflow-auto">
                    {showSettings ? (
                        <CaptionSettingsPanel
                            settings={settings}
                            onChange={(newSettings) => setSettings({ ...settings, ...newSettings })}
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
                    setIsInstallerOpen(false);
                    setIsInstalling(false);
                }}
                jobId={installJobId}
                repoId={installingRepoId}
            />
        </div>
    );
}
