'use client';

import { Card, CardContent, CardHeader, CardTitle, Button } from '@/components/ui/core';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export type SetupStatus = 'idle' | 'checking' | 'cloning' | 'ready' | 'error';

interface SetupProgressProps {
    status: SetupStatus;
    logs: string[];
    errorMessage?: string;
    isGitNotFound?: boolean;
    onRetry: () => void;
}

export function SetupProgress({ status, logs, errorMessage, isGitNotFound, onRetry }: SetupProgressProps) {
    if (status === 'idle') return null;

    const getStatusDisplay = () => {
        switch (status) {
            case 'checking':
                return {
                    icon: <Loader2 className="animate-spin" size={20} />,
                    title: 'Checking setup...',
                    color: 'text-blue-500'
                };
            case 'cloning':
                return {
                    icon: <Loader2 className="animate-spin" size={20} />,
                    title: 'Setting up Local Trainer...',
                    color: 'text-blue-500'
                };
            case 'ready':
                return {
                    icon: <CheckCircle2 size={20} />,
                    title: 'Local trainer ready',
                    color: 'text-green-500'
                };
            case 'error':
                return {
                    icon: <AlertCircle size={20} />,
                    title: 'Setup failed',
                    color: 'text-red-500'
                };
        }
    };

    const display = getStatusDisplay();

    return (
        <Card className="mb-6">
            <CardHeader className="pb-3">
                <CardTitle className={`flex items-center gap-2 text-sm font-medium ${display.color}`}>
                    {display.icon}
                    {display.title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Error Message */}
                {status === 'error' && errorMessage && (
                    <div className="bg-destructive/15 text-destructive p-3 rounded-md text-sm">
                        {errorMessage}
                        {isGitNotFound && (
                            <div className="mt-2 text-xs opacity-90">
                                <strong>How to install Git:</strong>
                                <ul className="list-disc list-inside mt-1 ml-2">
                                    <li>Windows: Download from <a href="https://git-scm.com/download/win" target="_blank" rel="noopener noreferrer" className="underline">git-scm.com</a></li>
                                    <li>After installation, restart LoRA Bento</li>
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Logs */}
                {logs.length > 0 && (
                    <div className="border rounded-md bg-black/5 dark:bg-black/20 p-3 font-mono text-xs max-h-32 overflow-y-auto">
                        {logs.map((log, i) => (
                            <div key={i} className="text-muted-foreground py-0.5">
                                {log}
                            </div>
                        ))}
                    </div>
                )}

                {/* Success Message */}
                {status === 'ready' && (
                    <div className="bg-green-500/15 text-green-600 dark:text-green-400 p-3 rounded-md text-sm font-medium">
                        ✓ sd-scripts repository is ready at ./train_script/sd-scripts
                    </div>
                )}

                {/* Retry Button */}
                {status === 'error' && (
                    <Button onClick={onRetry} size="sm" variant="outline">
                        Retry Setup
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
