'use client';

import { useState, useEffect, useCallback } from 'react';
import { use } from 'react';
import { notFound } from 'next/navigation';
import { Project } from '@/types';
import { TrainingConfig, TrainingConfigForm } from '@/components/training/TrainingConfigForm';
import { TrainingMonitor, TrainingStatus } from '@/components/training/TrainingMonitor';
import { TrainingModeSelector } from '@/components/training/TrainingModeSelector';
import { PlatformCard } from '@/components/training/PlatformCard';
import { SetupProgress, SetupStatus } from '@/components/training/SetupProgress';
import { Card, CardContent } from '@/components/ui/core';
import { AlertCircle } from 'lucide-react';

type TrainingMode = 'local' | 'platform';

export default function TrainPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [project, setProject] = useState<Project | null>(null);
    const [status, setStatus] = useState<TrainingStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Training mode state
    const [mode, setMode] = useState<TrainingMode>('local');

    // Setup state
    const [setupStatus, setSetupStatus] = useState<SetupStatus>('idle');
    const [setupLogs, setSetupLogs] = useState<string[]>([]);
    const [setupError, setSetupError] = useState<string | undefined>();
    const [isGitNotFound, setIsGitNotFound] = useState(false);

    // Fetch Project and Initial Status
    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                const projRes = await fetch(`/api/projects/${id}`);
                if (!projRes.ok) throw new Error('Project not found');
                const projData = await projRes.json();

                if (mounted) {
                    setProject(projData);
                    // Load saved mode or default to local
                    setMode(projData.settings?.train?.mode || 'local');
                }

                // Fetch training status
                const statusRes = await fetch(`/api/projects/${id}/train/status`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    if (mounted) setStatus(statusData);
                }
            } catch (err: any) {
                if (mounted) setError(err.message);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        init();

        return () => { mounted = false; };
    }, [id]);

    // Polling for training status
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (status?.status === 'running' || status?.status === 'idle') {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/projects/${id}/train/status`);
                    if (res.ok) {
                        const data = await res.json();
                        setStatus(data);
                    }
                } catch (e) {
                    console.error('Polling failed', e);
                }
            }, 1000);
        }

        return () => clearInterval(interval);
    }, [id, status?.status]);

    // Ensure sd-scripts when local mode is selected
    const ensureSdScripts = useCallback(async () => {
        setSetupStatus('checking');
        setSetupLogs([]);
        setSetupError(undefined);
        setIsGitNotFound(false);

        try {
            const res = await fetch('/api/train/ensure-sd-scripts', {
                method: 'POST'
            });

            const data = await res.json();

            if (data.status === 'ready') {
                setSetupStatus('ready');
                setSetupLogs(data.logs || []);
            } else if (data.status === 'error') {
                setSetupStatus('error');
                setSetupError(data.message);
                setIsGitNotFound(data.isGitNotFound || false);
                setSetupLogs(data.logs || []);
            }
        } catch (err: any) {
            setSetupStatus('error');
            setSetupError(err.message || 'Failed to setup sd-scripts');
        }
    }, []);

    // Trigger setup when switching to local mode
    useEffect(() => {
        if (mode === 'local' && setupStatus === 'idle') {
            ensureSdScripts();
        }
    }, [mode, setupStatus, ensureSdScripts]);

    const handleModeChange = async (newMode: TrainingMode) => {
        setMode(newMode);

        // Persist to backend
        try {
            await fetch(`/api/projects/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    settings: {
                        ...project?.settings,
                        train: { mode: newMode }
                    }
                })
            });
        } catch (err) {
            console.error('Failed to persist mode:', err);
        }

        // Reset setup status when switching modes
        if (newMode === 'local') {
            setSetupStatus('idle');
        }
    };

    const handleStart = async (config: TrainingConfig) => {
        setError(null);
        try {
            const res = await fetch(`/api/projects/${id}/train/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    config,
                    trainerScriptPath: config.trainerScriptPath
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to start training');
            }

            const data = await res.json();
            setStatus({
                runId: data.runId,
                status: 'running',
                startedAt: new Date().toISOString(),
                progress: { step: 0, totalSteps: config.epochs * 100, percent: 0, message: 'Starting...' },
                lastLogs: []
            });

        } catch (err: any) {
            setError(err.message);
        }
    };

    const handleStop = async () => {
        if (!confirm('Are you sure you want to stop training?')) return;

        try {
            await fetch(`/api/projects/${id}/train/stop`, { method: 'POST' });
            setStatus(prev => prev ? ({
                ...prev,
                status: 'canceled',
                progress: { ...prev.progress, message: 'Stopping...' }
            }) : null);
        } catch (err: any) {
            setError(err.message);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading...</div>;
    if (!project) return <div className="p-8 text-center text-red-500">Project not found</div>;

    const isRunning = status?.status === 'running';
    const isLocalSetupReady = mode === 'local' && setupStatus === 'ready';
    const canStartTraining = isLocalSetupReady && !isRunning;

    return (
        <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0">
                <h1 className="text-2xl font-bold">Train LoRA</h1>
            </div>

            {/* Mode Selector */}
            <div className="flex-shrink-0">
                <TrainingModeSelector
                    mode={mode}
                    onChange={handleModeChange}
                    disabled={isRunning}
                    isLocalReady={isLocalSetupReady}
                />
            </div>

            {error && (
                <div className="bg-destructive/15 text-destructive p-4 rounded-md flex items-center gap-2 flex-shrink-0">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            {/* Mode-specific content */}
            {mode === 'platform' ? (
                <div className="flex-1">
                    <PlatformCard />
                </div>
            ) : (
                <>
                    {/* Setup Progress for Local Mode */}
                    <SetupProgress
                        status={setupStatus}
                        logs={setupLogs}
                        errorMessage={setupError}
                        isGitNotFound={isGitNotFound}
                        onRetry={ensureSdScripts}
                    />

                    {/* Training UI */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                        {/* Left: Configuration */}
                        <div className="overflow-y-auto pr-2">
                            <TrainingConfigForm
                                project={project}
                                onStart={handleStart}
                                disabled={!canStartTraining}
                            />
                        </div>

                        {/* Right: Monitor */}
                        <div className="h-full min-h-[400px]">
                            {status ? (
                                <TrainingMonitor status={status} onStop={handleStop} />
                            ) : (
                                <Card className="h-full flex items-center justify-center text-muted-foreground">
                                    <CardContent>
                                        {isLocalSetupReady ? 'Ready to train' : 'Setting up...'}
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
