'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
    FolderInput,
    Wand2,
    Scaling,
    Type,
    BarChart, // Changed from barChart
    ArrowRight,
    ChevronRight,
    CheckCircle
} from 'lucide-react';
import { Project } from '@/types';
import { Button } from '@/components/ui/core';

interface StepsSidebarProps {
    project: Project;
}

const steps = [
    { id: 'import', label: '1. Import', icon: FolderInput, path: 'raw' },
    { id: 'augment', label: '2. Augment', icon: Wand2, path: 'augmented' },
    { id: 'process', label: '3. Resize & Pad', icon: Scaling, path: 'processed' },
    { id: 'caption', label: '4. Caption', icon: Type, path: 'caption' },
    { id: 'export', label: '5. Analysis & Export', icon: ArrowRight, path: 'export' },
];

export function StepsSidebar({ project }: StepsSidebarProps) {
    const pathname = usePathname();
    const currentStep = pathname.split('/').pop() || 'raw';

    return (
        <div className="w-64 border-r bg-card flex flex-col h-full">
            <div className="p-6 border-b">
                <h2 className="font-semibold truncate" title={project.name}>{project.name}</h2>
                <p className="text-xs text-muted-foreground mt-1">Workspace</p>
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
                                {step.label}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t bg-muted/20">
                <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                        <span>{project.stats.total} images</span>
                        {project.stats.total > 0 && <CheckCircle className="h-3 w-3 text-green-500" />}
                    </div>
                    <div className="flex justify-between">
                        <span>Processed</span>
                        <span className="font-mono">{project.stats.processed}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
