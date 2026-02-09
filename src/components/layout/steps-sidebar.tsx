'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    FolderInput,
    Wand2,
    Scaling,
    Type,
    BarChart,
    ArrowRight,
    CheckCircle,
    Crop,
    Settings
} from 'lucide-react';
import { Project } from '@/types';
import { Button } from '@/components/ui/core';
import { useSettings } from '@/components/settings/settings-provider';
import { useTranslation } from 'react-i18next';

interface StepsSidebarProps {
    project: Project;
}

const steps = [
    { id: 'import', key: 'sidebar.import', icon: FolderInput, path: 'raw' },
    { id: 'crop', key: 'sidebar.crop', icon: Crop, path: 'crop' },
    { id: 'augment', key: 'sidebar.augment', icon: Wand2, path: 'augmented' },
    { id: 'process', key: 'sidebar.resize', icon: Scaling, path: 'processed' },
    { id: 'caption', key: 'sidebar.caption', icon: Type, path: 'caption' },
    { id: 'export', key: 'sidebar.export', icon: ArrowRight, path: 'export' },
    { id: 'train', key: 'sidebar.train', icon: BarChart, path: 'train' },
];

export function StepsSidebar({ project }: StepsSidebarProps) {
    const pathname = usePathname();
    const currentStep = pathname.split('/').pop() || 'raw';
    const { openSettings } = useSettings();
    const { t } = useTranslation('common');

    return (
        <div className="w-64 border-r bg-card flex flex-col h-full">
            <div className="p-6 border-b">
                <h2 className="font-semibold truncate" title={project.name}>{project.name}</h2>
                <p className="text-xs text-muted-foreground mt-1">{t('app.workspace')}</p>
            </div>

            <div className="flex-1 overflow-auto py-4">
                <nav className="space-y-1 px-2">
                    {steps.map((step) => {
                        const isActive = pathname.includes(`/${step.path}`);
                        return (
                            <Link
                                key={step.id}
                                href={`/projects/${project.id}/${step.path}`}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                    isActive
                                        ? "bg-primary text-primary-foreground"
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                )}
                            >
                                <step.icon className="h-4 w-4" />
                                {t(step.key)}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t bg-muted/20">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 mb-4 text-muted-foreground"
                    onClick={openSettings}
                >
                    <Settings className="h-4 w-4" />
                    {t('settings.title')}
                </Button>
                <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                        <span>{project.stats.total} {t('sidebar.images')}</span>
                        {project.stats.total > 0 && <CheckCircle className="h-3 w-3 text-green-500" />}
                    </div>
                    <div className="flex justify-between">
                        <span>{t('sidebar.cropped')}</span>
                        <span className="font-mono">{project.stats.cropped}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>{t('sidebar.augmented')}</span>
                        <span className="font-mono">{project.stats.augmented}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>{t('sidebar.processed')}</span>
                        <span className="font-mono">{project.stats.processed}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
