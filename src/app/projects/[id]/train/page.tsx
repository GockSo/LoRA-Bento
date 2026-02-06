'use client';

import { useState, useEffect, useCallback } from 'react';
import { use } from 'react';
import { notFound } from 'next/navigation';
import { Project } from '@/types';
import { TrainingConfig, TrainingConfigForm } from '@/components/training/TrainingConfigForm';
import { TrainingMonitor, TrainingStatus } from '@/components/training/TrainingMonitor';
import { Card, CardContent } from '@/components/ui/core';
import { AlertCircle } from 'lucide-react';

export default function TrainPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [project, setProject] = useState<Project | null>(null);
    const [status, setStatus] = useState<TrainingStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch Project and Initial Status
    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                // 1. Fetch Project
                // For a client component, we might need a client-side fetch or pass project as prop if layout allows.
                // But layout passes project to sidebar, this is a page.
                // We'll fetch from an API or assume we can get it. 
                // Since this is MVP, let's fetch from the generic project API if available, or just use ID.
                // Actually `getProject` is server-side.
                // We'll trust the ID and just fetch status first. If we need project details (name) we can fetch /api/projects/[id]

                const projRes = await fetch(`/api/projects/${id}`);
                if (!projRes.ok) throw new Error('Project not found');
                const projData = await projRes.json();

                if (mounted) {
                    setProject(projData);
                }

                // 2. Fetch Status
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

    // Polling for status
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (status?.status === 'running' || status?.status === 'idle') { // Poll even if idle? Maybe not. Only if running.
            // Actually, if we just started, we want to poll.
            // If we are 'running', poll frequently.
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`/api/projects/${id}/train/status`);
                    if (res.ok) {
                        const data = await res.json();
                        setStatus(data);
                        // If finished, stop polling eventually? 
                        // But user might want to see unrelated updates? 
                        // For now keep polling if running.
                        if (data.status !== 'running') {
                            // Maybe slow down polling?
                        }
                    }
                } catch (e) {
                    console.error('Polling failed', e);
                }
            }, 1000); // 1s polling
        }

        return () => clearInterval(interval);
    }, [id, status?.status]);


    const handleStart = async (config: TrainingConfig) => {
        setError(null);
        try {
            const res = await fetch(`/api/projects/${id}/train/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    config,
                    trainerScriptPath: config.trainerScriptPath // Pass explicitly
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to start training');
            }

            const data = await res.json();
            // Force status update
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
            // Optimistic update
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

    return (
        <div className="space-y-6 h-[calc(100vh-6rem)] flex flex-col">
            <div className="flex items-center justify-between flex-shrink-0">
                <h1 className="text-2xl font-bold">Train LoRA</h1>
            </div>

            {error && (
                <div className="bg-destructive/15 text-destructive p-4 rounded-md flex items-center gap-2 flex-shrink-0">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Left: Configuration */}
                <div className="overflow-y-auto pr-2">
                    <TrainingConfigForm
                        project={project}
                        onStart={handleStart}
                        disabled={isRunning}
                    />
                </div>

                {/* Right: Monitor */}
                <div className="h-full min-h-[400px]">
                    {status ? (
                        <TrainingMonitor status={status} onStop={handleStop} />
                    ) : (
                        <Card className="h-full flex items-center justify-center text-muted-foreground">
                            <CardContent>Ready to train</CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
