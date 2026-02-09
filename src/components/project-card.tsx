'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Project } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription, Progress } from '@/components/ui/core';
import { Button } from '@/components/ui/core';
import { Input } from '@/components/ui/core';
import { FolderOpen, FileText, Pencil, Trash2, Download, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface ProjectCardProps {
    project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
    const router = useRouter();
    const { t } = useTranslation('common');
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [newName, setNewName] = useState(project.name);
    const [isRenaming, setIsRenaming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [trainingStatus, setTrainingStatus] = useState<any>(null);

    // Poll for training status
    useEffect(() => {
        let isMounted = true;
        const fetchStatus = async () => {
            try {
                const res = await fetch(`/api/projects/${project.id}/train/status`);
                if (res.ok && isMounted) {
                    const data = await res.json();
                    setTrainingStatus(data);
                }
            } catch { }
        };

        fetchStatus();
        const interval = setInterval(fetchStatus, 5000); // 5s interval for dashboard
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [project.id]);

    const handleRename = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsRenaming(true);
        try {
            const res = await fetch(`/api/projects/${project.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName }),
            });
            if (!res.ok) throw new Error('Failed to rename');
            setIsRenameOpen(false);
            router.refresh();
        } catch (error) {
            console.error(error);
            alert(t('errors.rename_failed'));
        } finally {
            setIsRenaming(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/projects/${project.id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete');
            setIsDeleteOpen(false);
            router.refresh(); // This might delay if UI doesn't optimistically remove.
        } catch (error) {
            console.error(error);
            alert(t('errors.delete_failed'));
            setIsDeleting(false);
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const res = await fetch(`/api/projects/${project.id}/export-zip`, {
                method: 'POST',
            });
            if (!res.ok) throw new Error('Failed to export');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const contentDisposition = res.headers.get('Content-Disposition');
            let filename = `project-${project.id}.zip`;
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) filename = match[1];
            }
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (error) {
            console.error(error);
            alert(t('errors.export_failed'));
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            <Card className="flex flex-col h-full hover:shadow-lg transition-all duration-300 group hover:-translate-y-1 bg-card/50 backdrop-blur-sm border-muted/60">
                <CardHeader className="pb-3 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1 space-y-1">
                            <CardTitle className="truncate font-bold text-lg" title={project.name}>{project.name}</CardTitle>
                            <CardDescription className="text-xs font-medium">
                                {t('dashboard.col_updated')} {formatDistanceToNow(new Date(project.updatedAt))} ago
                            </CardDescription>
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsRenameOpen(true)} title={t('dashboard.context_rename')}>
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExport} disabled={isExporting} title={t('dashboard.context_export')}>
                                {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setIsDeleteOpen(true)} title={t('dashboard.context_delete')}>
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 pb-4">
                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">{t('dashboard.stats_total')}</p>
                            <p className="text-xl font-bold tracking-tight">{project.stats.total}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">{t('sidebar.augmented')}</p>
                            <p className="text-xl font-bold tracking-tight">{project.stats.augmented}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">{t('sidebar.processed')}</p>
                            <p className="text-xl font-bold tracking-tight">{project.stats.processed}</p>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-muted-foreground font-medium">{t('dashboard.stats_captioned')}</p>
                            <p className="text-xl font-bold tracking-tight">{project.stats.captions}</p>
                        </div>
                    </div>

                    {/* Training Progress */}
                    {trainingStatus?.status === 'running' && (
                        <div className="mt-4 space-y-1.5 p-3 bg-primary/5 rounded-lg border border-primary/10">
                            <div className="flex justify-between text-xs items-center">
                                <span className="text-primary font-semibold animate-pulse flex items-center gap-1.5">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    {t('actions.training')}...
                                </span>
                                <span className="font-mono">{trainingStatus.progress.percent}%</span>
                            </div>
                            <Progress value={trainingStatus.progress.percent} className="h-1.5" />
                            <div className="text-[10px] text-muted-foreground truncate font-mono">
                                Step {trainingStatus.progress.step} / {trainingStatus.progress.totalSteps}
                            </div>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="pt-2 pb-6 px-6">
                    <Button asChild className="w-full transition-transform active:scale-[0.98] theme-gockso:hover:scale-[1.01]">
                        <Link href={`/projects/${project.id}/raw`}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            {t('dashboard.context_open')}
                        </Link>
                    </Button>
                </CardFooter>
            </Card>

            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('dashboard.context_rename')}</DialogTitle>
                        <DialogDescription>
                            {t('dashboard.rename_desc')}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRename}>
                        <div className="grid gap-4 py-4">
                            <Input
                                id="name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder={t('dashboard.col_name')}
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsRenameOpen(false)}>{t('actions.cancel')}</Button>
                            <Button type="submit" disabled={isRenaming}>
                                {isRenaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {t('actions.save')}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('dashboard.context_delete')}?</DialogTitle>
                        <DialogDescription>
                            {t('dashboard.delete_confirm_desc', { name: project.name })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>{t('actions.cancel')}</Button>
                        <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('actions.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
