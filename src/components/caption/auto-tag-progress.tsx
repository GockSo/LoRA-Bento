'use client';

import { Progress } from '@/components/ui/core';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AutoTagProgressProps {
    current: number;
    total: number;
    currentFilename: string;
    elapsedSeconds?: number;
}

export function AutoTagProgress({ current, total, currentFilename, elapsedSeconds }: AutoTagProgressProps) {
    const { t } = useTranslation();
    const progress = total > 0 ? (current / total) * 100 : 0;

    const formatElapsed = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            {t('caption.progress.tagging', { current, total })}
                        </span>
                        <span className="text-sm text-blue-700 dark:text-blue-300">
                            {Math.round(progress)}%
                        </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>
            </div>

            {currentFilename && (
                <div className="text-sm text-blue-700 dark:text-blue-300">
                    {t('caption.progress.current_file', { filename: currentFilename })}
                </div>
            )}

            {elapsedSeconds !== undefined && (
                <div className="text-xs text-blue-600 dark:text-blue-400">
                    {t('caption.progress.elapsed', { time: formatElapsed(elapsedSeconds) })}
                </div>
            )}
        </div>
    );
}
