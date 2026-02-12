'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Progress, Button } from '@/components/ui/core';
import { Terminal } from 'lucide-react';
import { TrainOutputsModal } from './TrainOutputsModal';

export interface TrainingStatus {
    runId: string | null;
    status: 'idle' | 'running' | 'completed' | 'failed' | 'canceled';
    startedAt: string | null;
    progress: {
        step: number;
        totalSteps: number;
        percent: number;
        message: string;
    };
    lastLogs: string[];
}

interface TrainingMonitorProps {
    status: TrainingStatus;
    onStop: () => void;
    projectId: string;
}

export function TrainingMonitor({ status, onStop, projectId }: TrainingMonitorProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [showOutputs, setShowOutputs] = useState(false);
    const [outputCount, setOutputCount] = useState(0);

    // Auto-scroll to bottom of logs
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [status.lastLogs, autoScroll]);

    // Poll for outputs count
    useEffect(() => {
        let interval: NodeJS.Timeout;

        const checkOutputs = async () => {
            try {
                const res = await fetch(`/api/projects/${projectId}/train/outputs?count=true`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.count !== undefined) {
                        setOutputCount(data.count);
                    }
                }
            } catch (e) {
                // Ignore errors
            }
        };

        // Initial check
        checkOutputs();

        // Poll if running OR if we have 0 outputs (to catch first file)
        // If completed and we have outputs, no need to poll aggressively, but maybe once in a while?
        // Let's poll while running, and verify once on mount.
        if (status.status === 'running' || outputCount === 0) {
            interval = setInterval(checkOutputs, 5000);
        }

        return () => clearInterval(interval);
    }, [projectId, status.status, outputCount]);

    const isRunning = status.status === 'running';
    // Show outputs if we have any files, regardless of status (even if running or failed)
    const hasOutputs = outputCount > 0;

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    Training Progress: {status.status.toUpperCase()}
                </CardTitle>
                <div className="flex gap-2">
                    {hasOutputs && (
                        <Button variant="outline" size="sm" onClick={() => setShowOutputs(true)}>
                            View Outputs ({outputCount})
                        </Button>
                    )}
                    {isRunning && (
                        <Button variant="destructive" size="sm" onClick={onStop}>
                            Stop
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
                <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{status.progress.message || 'Ready'}</span>
                        <span>{status.progress.percent}%</span>
                    </div>
                    <Progress value={status.progress.percent} className="h-2" />
                </div>

                <div className="flex-1 border rounded-md bg-black p-4 font-mono text-xs text-green-400 overflow-hidden flex flex-col relative">
                    <div className="absolute top-2 right-2 flex gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-white"
                            onClick={() => setAutoScroll(!autoScroll)}
                            title={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
                        >
                            <Terminal size={14} className={autoScroll ? "text-green-500" : ""} />
                        </Button>
                    </div>
                    <div
                        ref={scrollRef}
                        className="overflow-y-auto flex-1 h-full whitespace-pre-wrap break-all pr-2"
                        onScroll={(e) => {
                            const target = e.currentTarget;
                            if (target.scrollHeight - target.scrollTop - target.clientHeight > 50) {
                                setAutoScroll(false);
                            } else {
                                setAutoScroll(true);
                            }
                        }}
                    >
                        {status.lastLogs.length === 0 ? (
                            <span className="text-muted-foreground opacity-50">Waiting for logs...</span>
                        ) : (
                            status.lastLogs.map((log, i) => (
                                <div key={i} className="py-0.5">{log}</div>
                            ))
                        )}
                    </div>
                </div>
            </CardContent>

            <TrainOutputsModal
                open={showOutputs}
                onOpenChange={setShowOutputs}
                projectId={projectId}
            />
        </Card>
    );
}
