'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/core';
import { Download, CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ModelInfo, WDModel } from '@/types/wd-models';

interface ModelSelectorProps {
    value: WDModel;
    onChange: (model: WDModel) => void;
    models: ModelInfo[];
    onInstallClick: (repoId: string) => void;
    isInstalling: boolean;
    disabled?: boolean;
}

export function ModelSelector({
    value,
    onChange,
    models,
    onInstallClick,
    isInstalling,
    disabled = false
}: ModelSelectorProps) {
    const { t } = useTranslation();

    const selectedModel = models.find(m => m.key === value);
    const isInstalled = selectedModel?.installed || false;

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <Select value={value} onValueChange={(v) => onChange(v as WDModel)} disabled={disabled}>
                        <SelectTrigger className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {models.map((model) => (
                                <SelectItem key={model.key} value={model.key}>
                                    <div className="flex items-start gap-2 py-1">
                                        {model.installed ? (
                                            <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                        ) : (
                                            <Download className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                        )}
                                        <div>
                                            <div className="font-medium">{model.label}</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                <span>{model.repo_id}</span>
                                                {!model.installed && model.size_mb && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{model.size_mb} MB</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {!isInstalled && selectedModel && (
                    <Button
                        onClick={() => onInstallClick(selectedModel.repo_id)}
                        disabled={isInstalling || disabled}
                        className="flex items-center gap-2"
                    >
                        {isInstalling ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {t('caption.model_selector.installing')}
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                {t('caption.model_selector.download_button')}
                            </>
                        )}
                    </Button>
                )}
            </div>

            {selectedModel && !isInstalled && (
                <div className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg p-3">
                    {t('caption.model_selector.not_installed')} — Download required to enable tagging.
                </div>
            )}
        </div>
    );
}
