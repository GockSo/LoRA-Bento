'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/core';
import { Loader2, Terminal, CheckCircle2, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface UpdateInfo {
    branch: string;
    currentHash: string;
    latestTag: string | null;
    currentTag: string | null;
    behind: number;
}

interface UpdateModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    updateInfo: UpdateInfo | null;
}

export function UpdateModal({ open, onOpenChange, updateInfo }: UpdateModalProps) {
    const [updating, setUpdating] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [completed, setCompleted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleUpdate = async (mode: 'tag' | 'pull') => {
        setUpdating(true);
        setLogs([]);
        setError(null);
        setCompleted(false);

        try {
            const res = await fetch('/api/update/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode,
                    tag: updateInfo?.latestTag,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Update failed');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response body');

            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(Boolean);

                setLogs(prev => [...prev, ...lines]);

                // Check for completion signal or error
                if (chunk.includes('DONE')) {
                    setCompleted(true);
                    setUpdating(false);
                }
            }
        } catch (err: any) {
            setError(err.message);
            setUpdating(false);
            toast.error(err.message);
        }
    };

    const handleRestart = () => {
        // In a web app, we can just reload the page, but the user requirement implies a full restart might be needed.
        // For now, reloading the window is the best we can do in browser context unless we have an electron IPC bridge.
        window.location.reload();
    };

    if (!updateInfo) return null;

    return (
        <Dialog open={open} onOpenChange={(val) => !updating && onOpenChange(val)}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Update LoRA Bento?</DialogTitle>
                    <DialogDescription>
                        A new version is available.
                    </DialogDescription>
                </DialogHeader>

                {!updating && !completed ? (
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="space-y-1">
                                <p className="font-medium text-muted-foreground">Current Version</p>
                                <div className="p-2 bg-muted/50 rounded border font-mono text-xs">
                                    <p>Branch: {updateInfo.branch}</p>
                                    <p>Hash: {updateInfo.currentHash}</p>
                                    {updateInfo.currentTag && <p>Tag: {updateInfo.currentTag}</p>}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="font-medium text-muted-foreground">Latest Version</p>
                                <div className="p-2 bg-primary/10 rounded border border-primary/20 font-mono text-xs text-primary">
                                    {updateInfo.latestTag ? (
                                        <p className="font-bold">{updateInfo.latestTag}</p>
                                    ) : (
                                        <p>Remote HEAD</p>
                                    )}
                                    {updateInfo.behind > 0 && (
                                        <p className="text-amber-500">{updateInfo.behind} commits behind</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md flex items-start gap-2 text-xs text-yellow-800 dark:text-yellow-200">
                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                            <p>
                                Please make sure you have no uncommitted changes before updating.
                                The update process will fail if your working directory is dirty.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <ScrollArea className="h-[200px] w-full rounded border bg-black/90 p-4">
                            <div className="font-mono text-xs text-green-400 space-y-1">
                                {logs.map((log, i) => (
                                    <div key={i}>{log}</div>
                                ))}
                                {updating && (
                                    <div className="animate-pulse">_</div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                )}

                <DialogFooter className="sm:justify-between gap-2">
                    {!updating && !completed ? (
                        <>
                            <Button variant="ghost" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <div className="flex gap-2">
                                {/* Optional: Update from main */}
                                {/* <Button variant="outline" onClick={() => handleUpdate('pull')}>
                                    Update from Main
                                </Button> */}
                                <Button onClick={() => handleUpdate('tag')} disabled={!updateInfo.latestTag}>
                                    Update to {updateInfo.latestTag || 'Latest'}
                                </Button>
                            </div>
                        </>
                    ) : completed ? (
                        <Button onClick={handleRestart} className="w-full">
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Refresh Page
                        </Button>
                    ) : (
                        <Button disabled className="w-full">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Updating...
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
