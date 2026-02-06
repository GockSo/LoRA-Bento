"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Project } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/core';
import { Button } from '@/components/ui/core';
import { Input } from '@/components/ui/core';
import { FolderOpen, FileText, Pencil, Trash2, Download, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface ProjectCardProps {
    project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
    const router = useRouter();
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [newName, setNewName] = useState(project.name);
    const [isRenaming, setIsRenaming] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

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
            alert('Failed to rename project');
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
            alert('Failed to delete project');
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
            // Content-Disposition should handle filename, but we can try to extract or fallback
            // The browser usually respects the header with just triggering download
            // But we need to click it.
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
            alert('Failed to export project');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            <Card className="flex flex-col hover:shadow-lg transition-all relative group">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <CardTitle className="truncate" title={project.name}>{project.name}</CardTitle>
                            <CardDescription>
                                Updated {formatDistanceToNow(new Date(project.updatedAt))} ago
                            </CardDescription>
                        </div>
                        <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsRenameOpen(true)} title="Rename">
                                <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExport} disabled={isExporting} title="Export ZIP">
                                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setIsDeleteOpen(true)} title="Delete">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 pb-2">
                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                        <div className="flex justify-between">
                            <span>Total Images</span>
                            <span className="font-medium">{project.stats.total}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Augmented</span>
                            <span className="font-medium">{project.stats.augmented}</span>
                        </div>
                        <div className="flex items-center gap-2 col-span-2">
                            <FileText className="h-4 w-4" />
                            <span>{project.stats.captions} Captioned</span>
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button asChild className="w-full">
                        <Link href={`/projects/${project.id}/raw`}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Open Project
                        </Link>
                    </Button>
                </CardFooter>
            </Card>

            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename Project</DialogTitle>
                        <DialogDescription>
                            Enter a new name for this project.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleRename}>
                        <div className="grid gap-4 py-4">
                            <Input
                                id="name"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Project Name"
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={isRenaming}>
                                {isRenaming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Project?</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{project.name}</strong>? This action cannot be undone and will permanently remove all files.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Delete Project
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
