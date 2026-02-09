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
import { useTranslation } from 'react-i18next';

interface DuplicateManagerProps {
    projectId: string;
    items: ManifestItem[];
    onUpdate: () => void;
}

export function DuplicateManager({ projectId, items, onUpdate }: DuplicateManagerProps) {
    const { t } = useTranslation('common');
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
                            <div className="font-semibold text-sm">{t('qa.dup_title')}</div>
                            <div className="text-xs opacity-80">{t('qa.dup_found', { count })}</div>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="bg-background text-yellow-600 hover:text-yellow-700 border-yellow-200">
                        {t('actions.manage')}
                    </Button>
                </div>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('qa.dup_manage_title')}</DialogTitle>
                    <DialogDescription>
                        {t('qa.dup_manage_desc', { groups, count })}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {!results ? (
                        <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
                            <p><strong>{t('qa.auto_delete_strategy')}</strong></p>
                            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                                <li>{t('qa.strategy_1')}</li>
                                <li>{t('qa.strategy_2')}</li>
                                <li>{t('qa.strategy_3')}</li>
                            </ul>
                        </div>
                    ) : (
                        <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg text-green-700 flex items-center gap-3">
                            <CheckCircle2 className="h-5 w-5" />
                            <div>
                                <p className="font-medium">{t('qa.cleanup_complete')}</p>
                                <p className="text-xs">{t('qa.cleanup_stats', { deleted: results.deleted, kept: results.kept })}</p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    {!results ? (
                        <>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>{t('actions.cancel')}</Button>
                            <Button variant="destructive" onClick={handleAutoDelete} disabled={isDeleting}>
                                {isDeleting ? t('actions.processing') : t('qa.auto_delete_btn', { count: count - groups })}
                            </Button>
                        </>
                    ) : (
                        <Button onClick={() => setIsOpen(false)}>{t('actions.done')}</Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
