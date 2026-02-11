'use client';

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/core';
import { Progress } from '@/components/ui/core';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DownloadProgress } from '@/types/wd-models';

interface ModelInstallerModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string | null;
    repoId: string;
}

export function ModelInstallerModal({ isOpen = false, onClose, jobId, repoId }: ModelInstallerModalProps) {
    const { t } = useTranslation();
    const [progress, setProgress] = useState<DownloadProgress | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // CRITICAL: Only poll if BOTH jobId is valid AND modal is explicitly open
        if (!jobId || !isOpen) {
            // Reset progress state when modal closes or jobId is cleared
            setProgress(null);
            setError(null);
            return;
        }

        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`/api/wd/models/install/${jobId}`);
                if (res.ok) {
                    const data = await res.json();
                    setProgress(data);

                    // API returns 'status' not 'stage'
                    if (data.status === 'completed') {
                        clearInterval(pollInterval);
                        // Don't auto-close or reload - let user see success and close manually
                    } else if (data.status === 'error') {
                        clearInterval(pollInterval);
                        setError(data.error || 'Installation failed');
                    }
                } else {
                    setError('Failed to check installation status');
                }
            } catch (err) {
                console.error('Failed to poll progress:', err);
                setError('Network error - please check your connection');
            }
        }, 500);

        return () => clearInterval(pollInterval);
    }, [jobId, isOpen]);

    const handleClose = () => {
        // Clear all state when closing
        setProgress(null);
        setError(null);
        onClose();
    };

    const handleRetry = () => {
        setError(null);
        setProgress(null);
        handleClose();
    };

    const downloadedMB = progress ? (progress.downloaded_bytes / 1024 / 1024).toFixed(1) : '0.0';
    const totalMB = progress ? (progress.total_bytes / 1024 / 1024).toFixed(1) : '0.0';
    const progressPercent = progress?.progress || 0;

    // CRITICAL: Don't render modal at all if there's no job ID
    // This prevents stale state from showing the modal on page load
    if (!jobId) {
        return null;
    }

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
                    <h2 className="text-xl font-bold mb-4">{t('caption.download.title')}</h2>

                    {error ? (
                        <div className="space-y-4">
                            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg">
                                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-red-800 dark:text-red-200">
                                    {error.includes('network') || error.includes('fetch')
                                        ? t('caption.download.error_network')
                                        : error.includes('permission') || error.includes('EACCES')
                                            ? t('caption.download.error_disk')
                                            : error
                                    }
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Button variant="outline" onClick={handleClose} className="flex-1">
                                    {t('actions.close')}
                                </Button>
                                <Button onClick={handleRetry} className="flex-1">
                                    {t('caption.download.retry')}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Progress Bar */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-600 dark:text-gray-400">
                                        {progress?.status === 'downloading' && t('caption.download.downloading')}
                                        {progress?.status === 'starting' && 'Starting...'}
                                        {progress?.status === 'completed' && t('caption.download.complete')}
                                        {!progress?.status && 'Preparing...'}
                                    </span>
                                    {/* Only show percentage if we have real total_bytes */}
                                    {progress?.total_bytes && progress.total_bytes > 0 ? (
                                        <span className="font-medium">{Math.round(progressPercent)}%</span>
                                    ) : null}
                                </div>

                                {/* Determinate progress bar when total_bytes is known */}
                                {progress?.total_bytes && progress.total_bytes > 0 ? (
                                    <>
                                        <Progress value={progressPercent} className="h-2" />
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {t('caption.download.progress', { downloaded: downloadedMB, total: totalMB })}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Indeterminate progress bar */}
                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                                            <div className="h-full bg-primary animate-pulse w-full opacity-50" />
                                        </div>
                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                            {progress?.current_file?.includes('Fetching') || progress?.current_file?.includes('Calculating')
                                                ? 'Calculating download size...'
                                                : 'Downloading... (size unknown)'}
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Current File */}
                            {progress?.current_file && progress.status === 'downloading' && (
                                <div className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {progress.current_file}
                                </div>
                            )}

                            {/* Success Icon */}
                            {progress?.status === 'completed' && (
                                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                    <CheckCircle2 className="w-5 h-5" />
                                    <span className="text-sm font-medium">{t('caption.download.complete')}</span>
                                </div>
                            )}

                            {/* Close button - always visible */}
                            <Button
                                variant={progress?.status === 'completed' ? 'default' : 'outline'}
                                onClick={handleClose}
                                className="w-full"
                            >
                                {progress?.status === 'completed' ? 'Done' : t('actions.close')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </Dialog>
    );
}
