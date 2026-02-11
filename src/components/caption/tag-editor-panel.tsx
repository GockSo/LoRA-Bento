'use client';

import { useState, useEffect, KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button, Input } from '@/components/ui/core';
import { X, Save, RotateCcw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CaptionImage } from '@/types/wd-models';

interface TagEditorPanelProps {
    image: CaptionImage | null;
    onSave: (tags: string[]) => Promise<void>;
    onRegenerate: () => Promise<void>;
    onRevert: () => void;
}

export function TagEditorPanel({ image, onSave, onRegenerate, onRevert }: TagEditorPanelProps) {
    const { t } = useTranslation();
    const [tags, setTags] = useState<string[]>(image?.tags || []);
    const [tagInput, setTagInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isRegenerating, setIsRegenerating] = useState(false);

    // Update tags when image changes
    useState(() => {
        if (image) setTags(image.tags);
    });

    const hasUnsavedChanges = JSON.stringify(tags) !== JSON.stringify(image?.tags || []);

    const displayTag = (tag: string) => tag.replace(/_/g, ' ');

    const addTags = (input: string) => {
        const newTags = input
            .split(',')
            .map(t => t.trim().replace(/\s+/g, '_')) // Convert spaces to underscores for storage
            .filter(t => t.length > 0)
            .filter(t => !tags.some(existing => existing.toLowerCase() === t.toLowerCase()));

        if (newTags.length > 0) {
            setTags([...tags, ...newTags]);
            setTagInput('');
        }
    };

    const removeTag = (index: number) => {
        setTags(tags.filter((_, i) => i !== index));
    };

    const removeLastTag = () => {
        if (tags.length > 0) {
            setTags(tags.slice(0, -1));
        }
    };

    const handleSave = async () => {
        if (!image) return;
        setIsSaving(true);
        try {
            await onSave(tags);
        } finally {
            setIsSaving(false);
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
                {t('crop.select_image')}
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

            {/* Filename */}
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {image.filename}
            </div>

            {/* Tag Chips */}
            <div className="flex-1 overflow-y-auto">
                <div className="flex flex-wrap gap-2">
                    {tags.map((tag, index) => (
                        <Badge
                            key={index}
                            variant="secondary"
                            className="cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        >
                            <span>{displayTag(tag)}</span>
                            <X
                                className="w-3 h-3 ml-1 cursor-pointer hover:text-red-600"
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
                    placeholder={t('caption.tag_editor.add_tag_placeholder')}
                    className="w-full"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Press Enter to add • Backspace in empty field removes last tag
                </p>
            </div>

            {/* Unsaved Changes Indicator */}
            {hasUnsavedChanges && (
                <div className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                    {t('caption.tag_editor.unsaved_changes')}
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 flex-shrink-0">
                <Button
                    variant="outline"
                    onClick={onRevert}
                    disabled={!hasUnsavedChanges || isSaving || isRegenerating}
                    className="flex-1"
                >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    {t('caption.revert')}
                </Button>
                <Button
                    variant="outline"
                    onClick={handleRegenerate}
                    disabled={isSaving || isRegenerating}
                    className="flex-1"
                >
                    <Sparkles className="w-4 h-4 mr-2" />
                    {isRegenerating ? 'Regenerating...' : t('caption.regenerate')}
                </Button>
                <Button
                    onClick={handleSave}
                    disabled={!hasUnsavedChanges || isSaving || isRegenerating}
                    className="flex-1"
                >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? 'Saving...' : t('actions.save')}
                </Button>
            </div>
        </div>
    );
}
