'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/core';
import { FileCode, Trash2, ExternalLink, Download, FileText, FileJson, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';
import { formatDistanceToNow } from 'date-fns';

interface OutputFile {
    name: string;
    size: number;
    date: string;
    type: string;
    path: string;
}

interface TrainOutputsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
}

export function TrainOutputsModal({ open, onOpenChange, projectId }: TrainOutputsModalProps) {
    const { t } = useTranslation();
    const [files, setFiles] = useState<OutputFile[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchFiles = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/projects/${projectId}/train/outputs`);
            if (!res.ok) throw new Error('Failed to fetch outputs');
            const data = await res.json();
            setFiles(data.files || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) {
            fetchFiles();
        }
    }, [open, projectId]);

    const handleDownload = (filename: string) => {
        const url = `/api/projects/${projectId}/train/outputs/download?file=${filename}`;
        window.open(url, '_blank');
    };

    const handleDownloadAll = () => {
        const url = `/api/projects/${projectId}/train/outputs/download?all=true`;
        window.open(url, '_blank');
    };

    const handleDelete = async (filename: string) => {
        if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

        try {
            const res = await fetch(`/api/projects/${projectId}/train/outputs`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });

            if (!res.ok) throw new Error('Failed to delete');

            // Refresh
            fetchFiles();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getIcon = (type: string) => {
        if (type === 'json') return <FileJson className="w-5 h-5 text-yellow-500" />;
        if (type === 'safetensors' || type === 'ckpt') return <FileCode className="w-5 h-5 text-green-500" />;
        if (type === 'txt' || type === 'log') return <FileText className="w-5 h-5 text-blue-500" />;
        return <FileCode className="w-5 h-5 text-gray-500" />;
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Training Outputs</DialogTitle>
                    <DialogDescription>
                        Files generated during the training process (checkpoints, logs, configs).
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-[300px] overflow-hidden rounded-md border">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">Loading...</div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full text-red-500">{error}</div>
                    ) : files.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                            <FileCode className="w-10 h-10 opacity-20" />
                            <p>No output files found.</p>
                        </div>
                    ) : (
                        <ScrollArea className="h-full">
                            <div className="divide-y">
                                {files.map((file) => (
                                    <div key={file.name} className="flex items-center justify-between p-3 hover:bg-secondary/50 transition-colors group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {getIcon(file.type)}
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-medium truncate" title={file.name}>{file.name}</span>
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <span>{formatSize(file.size)}</span>
                                                    <span>•</span>
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {formatDistanceToNow(new Date(file.date), { addSuffix: true })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* Download */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Download"
                                                onClick={() => handleDownload(file.name)}
                                            >
                                                <Download className="w-4 h-4" />
                                            </Button>

                                            {/* Delete */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                onClick={() => handleDelete(file.name)}
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                <DialogFooter>
                    <Button onClick={handleDownloadAll} variant="outline" className="mr-auto">
                        <Download className="w-4 h-4 mr-2" />
                        Download All (.zip)
                    </Button>
                    <Button onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
