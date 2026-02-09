'use client';

import { Button } from '@/components/ui/core';
import { CheckCircle2 } from 'lucide-react';

type TrainingMode = 'local' | 'platform';

interface TrainingModeSelectorProps {
    mode: TrainingMode;
    onChange: (mode: TrainingMode) => void;
    disabled?: boolean;
    isLocalReady?: boolean;
}

export function TrainingModeSelector({ mode, onChange, disabled, isLocalReady }: TrainingModeSelectorProps) {
    return (
        <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
            <Button
                variant={mode === 'local' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onChange('local')}
                disabled={disabled}
                className={`
                    transition-all flex items-center gap-2
                    ${mode === 'local'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-muted-foreground/10'
                    }
                `}
            >
                Local Training
                {isLocalReady && (
                    <CheckCircle2
                        size={14}
                        className="text-green-500"
                        title="sd-scripts repository is ready"
                    />
                )}
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
