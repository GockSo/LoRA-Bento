'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/core';
import { Layers, Trash2, CheckCircle2 } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { ManifestItem } from '@/types';

interface DuplicateManagerProps {
    projectId: string;
    items: ManifestItem[];
    onUpdate: () => void;
}

export function DuplicateManager({ projectId, items, onUpdate }: DuplicateManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [results, setResults] = useState<{ deleted: number, kept: number } | null>(null);

    // Identify duplicates from items
    const duplicates = items.filter(i => i.flags?.isDuplicate);

    // Group them for display count (rough approximation: count of items with flag)
    // Precise: group by hash.
    const groups = new Set(duplicates.map(i => i.hash)).size;
    const count = duplicates.length;

    if (count === 0) return null;

    const handleAutoDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/projects/${projectId}/qa/duplicates/auto-delete`, {
                method: 'POST'
            });
            if (res.ok) {
                const data = await res.json();
                setResults({ deleted: data.deleted, kept: data.kept });
                onUpdate();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-yellow-600">
                        <Layers className="h-5 w-5" />
                        <div>
                            <div className="font-semibold text-sm">Duplicate Groups Detect: {groups}</div>
                            <div className="text-xs opacity-80">{count} duplicate candidates found.</div>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="bg-background text-yellow-600 hover:text-yellow-700 border-yellow-200">
                        Manage
                    </Button>
                </div>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Duplicate Management</DialogTitle>
                    <DialogDescription>
                        We detected {groups} groups of similar images ({count} total files).
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {!results ? (
                        <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                            <p><strong>Auto-Delete Strategy:</strong></p>
                            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                                <li>Keeps the highest quality version (based on file size).</li>
                                <li>If sizes match, keeps the earliest imported file.</li>
                                <li>All other versions will be permanently deleted.</li>
                            </ul>
                        </div>
                    ) : (
                        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg text-green-700 flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5" />
                            <div>
                                <p className="font-medium">Cleanup Complete</p>
                                <p className="text-xs">Deleted {results.deleted} files, kept {results.kept} originals.</p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {!results ? (
                        <>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleAutoDelete} disabled={isDeleting}>
                                {isDeleting ? 'Processing...' : `Auto Delete ${count - groups} Duplicates`}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => setIsOpen(false)}>Done</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
