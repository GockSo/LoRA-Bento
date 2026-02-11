'use client';

import { Label } from '@/components/ui/label';
import { Input, Slider } from '@/components/ui/core';
import { useTranslation } from 'react-i18next';
import { CaptionAdvancedSettings } from '@/types/caption';

interface CaptionSettingsPanelProps {
    settings: CaptionAdvancedSettings;
    onChange: (settings: Partial<CaptionAdvancedSettings>) => void;
}

export function CaptionSettingsPanel({ settings, onChange }: CaptionSettingsPanelProps) {
    const { t } = useTranslation();

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold mb-4">{t('caption.settings.title')}</h3>
            </div>

            {/* Tag Threshold */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>{t('caption.settings.threshold')}</Label>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {settings.tagThreshold.toFixed(2)}
                    </span>
                </div>
                <Slider
                    value={[settings.tagThreshold]}
                    onValueChange={([value]) => onChange({ tagThreshold: value })}
                    min={0.1}
                    max={0.9}
                    step={0.05}
                    className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('caption.settings.threshold_desc')}
                </p>
            </div>

            {/* Max Tags */}
            <div className="space-y-2">
                <Label>{t('caption.settings.max_tags')}</Label>
                <Input
                    type="number"
                    value={settings.maxTags}
                    onChange={(e) => onChange({ maxTags: parseInt(e.target.value) || 60 })}
                    min={10}
                    max={200}
                    className="w-full"
                />
            </div>

            {/* Exclude Tags */}
            <div className="space-y-2">
                <Label>{t('caption.settings.exclude_tags')}</Label>
                <textarea
                    value={settings.excludeTags}
                    onChange={(e) => onChange({ excludeTags: e.target.value })}
                    placeholder={t('caption.settings.exclude_tags_placeholder')}
                    rows={3}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700 text-sm resize-none"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Comma-separated list of tags to exclude
                </p>
            </div>

            {/* Trigger Word */}
            <div className="space-y-2">
                <Label>Trigger Word (optional)</Label>
                <Input
                    value={settings.keepFirstTokens > 0 ? 'trigger_word' : ''}
                    placeholder="e.g., ohwx person"
                    className="w-full"
                    disabled
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Configure in main settings
                </p>
            </div>
        </div>
    );
}
