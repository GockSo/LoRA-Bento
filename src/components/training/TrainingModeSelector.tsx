'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/core';

type TrainingMode = 'local' | 'platform';

interface TrainingModeSelectorProps {
    mode: TrainingMode;
    onChange: (mode: TrainingMode) => void;
    disabled?: boolean;
}

export function TrainingModeSelector({ mode, onChange, disabled }: TrainingModeSelectorProps) {
    return (
        <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
            <Button
                variant={mode === 'local' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange('local')}
                disabled={disabled}
                className={`
                    transition-all
                    ${mode === 'local'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-muted-foreground/10'
                    }
                `}
            >
                Local Training
            </Button>
            <Button
                variant={mode === 'platform' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange('platform')}
                disabled={disabled}
                className={`
                    transition-all
                    ${mode === 'platform'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-muted-foreground/10'
                    }
                `}
            >
                Train on Platform
            </Button>
        </div>
    );
}
