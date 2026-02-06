'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Progress, Button } from '@/components/ui/core';
import { AlertCircle, CheckCircle2, Terminal } from 'lucide-react';

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
}

export function TrainingMonitor({ status, onStop }: TrainingMonitorProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);

    // Auto-scroll to bottom of logs
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [status.lastLogs, autoScroll]);

    const isRunning = status.status === 'running';

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                    Training Progress: {status.status.toUpperCase()}
                </CardTitle>
                {isRunning && (
                    <Button variant="destructive" size="sm" onClick={onStop}>
                        Stop
                    </Button>
                )}
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
        </Card>
    );
}
