'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, Input } from '@/components/ui/core';
import { X, RotateCcw, Sparkles, Check, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CaptionImage } from '@/types/wd-models';
import { stringToColor } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface TagEditorPanelProps {
    image: CaptionImage | null;
    onSave: (tags: string[], silent?: boolean) => Promise<boolean>;
    onRegenerate: () => Promise<void>;
    onRevert: () => void;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function TagEditorPanel({ image, onSave, onRegenerate, onRevert }: TagEditorPanelProps) {
    const { t } = useTranslation();
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [status, setStatus] = useState<SaveStatus>('idle');
    const [isRegenerating, setIsRegenerating] = useState(false);

    // Refs for debounce and tracking
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastSavedTagsRef = useRef<string[]>([]);
    const isInitialLoadRef = useRef(true);

    // Update tags when image changes
    useEffect(() => {
        // Cancel any pending save from previous image
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }

        if (image) {
            const newTags = image.tags || [];
            setTags(newTags);
            lastSavedTagsRef.current = newTags;
            setStatus('idle');
            isInitialLoadRef.current = true;
        } else {
            setTags([]);
            lastSavedTagsRef.current = [];
            setStatus('idle');
        }
    }, [image]);

    // Auto-save logic
    useEffect(() => {
        if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
            return;
        }

        // Check if tags actually changed from last saved state
        const tagsJson = JSON.stringify(tags);
        const lastSavedJson = JSON.stringify(lastSavedTagsRef.current);

        if (tagsJson === lastSavedJson) return;

        setStatus('saving');

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(async () => {
            const success = await onSave(tags, true); // silent = true
            if (success) {
                lastSavedTagsRef.current = tags;
                setStatus('saved');
                // Reset back to idle after 2 seconds
                setTimeout(() => {
                    setStatus(prev => prev === 'saved' ? 'idle' : prev);
                }, 2000);
            } else {
                setStatus('error');
            }
        }, 600); // 600ms debounce

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [tags, onSave]);

    const displayTag = (tag: string) => tag.replace(/_/g, ' ');

    const addTags = (input: string) => {
        const newTags = input
            .split(',')
            .map(t => t.trim().replace(/\s+/g, '_')) // Convert spaces to underscores for storage
            .filter(t => t.length > 0)
            .filter(t => !tags.some(existing => existing.toLowerCase() === t.toLowerCase()));

        if (newTags.length > 0) {
            setTags(prev => [...prev, ...newTags]);
            setTagInput('');
        }
    };

    const removeTag = (index: number) => {
        setTags(prev => prev.filter((_, i) => i !== index));
    };

    const removeLastTag = () => {
        if (tags.length > 0) {
            setTags(prev => prev.slice(0, -1));
        }
    };

    const handleRegenerate = async () => {
        setIsRegenerating(true);
        try {
            await onRegenerate();
        } finally {
            setIsRegenerating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (tagInput.trim()) {
                addTags(tagInput);
            }
        } else if (e.key === 'Backspace' && !tagInput) {
            removeLastTag();
        }
    };

    if (!image) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                {t('caption.editor.select_image', 'Select an image to view and edit tags')}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-4">
            {/* Image Preview */}
            <div className="relative w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                <img
                    src={image.url}
                    alt={image.filename}
                    className="w-full h-full object-contain"
                />
            </div>

            {/* Filename & Status */}
            <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate max-w-[200px]" title={image.filename}>
                    {image.filename}
                </div>

                {/* Status Indicator */}
                <div className="flex items-center gap-2 text-xs font-medium">
                    {status === 'saving' && (
                        <div className="flex items-center gap-1.5 text-blue-500">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Saving...</span>
                        </div>
                    )}
                    {status === 'saved' && (
                        <div className="flex items-center gap-1.5 text-green-500 animate-in fade-in duration-300">
                            <Check className="w-3 h-3" />
                            <span>Saved</span>
                        </div>
                    )}
                    {status === 'error' && (
                        <div className="flex items-center gap-1.5 text-red-500 cursor-pointer hover:underline"
                            onClick={() => {
                                // Retry logic: just trigger immediate save
                                onSave(tags, false);
                                setStatus('saving');
                            }}>
                            <AlertCircle className="w-3 h-3" />
                            <span>Error saving (Retry)</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tag Chips */}
            <div className="flex-1 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                        <Badge
                            key={index}
                            variant="secondary"
                            className="cursor-pointer hover:opacity-80 transition-opacity text-white border-transparent"
                            style={{ backgroundColor: stringToColor(tag) }}
                        >
                            <span>{displayTag(tag)}</span>
                            <X
                                className="w-3 h-3 ml-1 cursor-pointer hover:text-red-200"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeTag(index);
                                }}
                            />
                        </Badge>
                    ))}
                </div>
            </div>

            {/* Add Tag Input */}
            <div className="space-y-2">
                <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('caption.tag_editor.add_tag_placeholder', 'Add tags...')}
                    className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Press Enter to add • Backspace in empty field removes last tag
                </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 flex-shrink-0">
                <Button
                    variant="outline"
                    onClick={onRevert}
                    disabled={status === 'saving' || isRegenerating}
                    className="flex-1"
                >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {t('caption.revert')}
                </Button>
                <Button
                    variant="outline"
                    onClick={handleRegenerate}
                    disabled={status === 'saving' || isRegenerating}
                    className="flex-1"
                >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {isRegenerating ? 'Regenerating...' : t('caption.regenerate')}
                </Button>
            </div>
        </div>
    );
}
