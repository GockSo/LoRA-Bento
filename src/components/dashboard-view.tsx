'use client';

import { Project } from '@/types';
import { ProjectCard } from '@/components/project-card';
import { NewProjectDialog } from '@/components/new-project-dialog';
import { ImportProjectButton } from '@/components/import-project-button';
import { useTranslation } from 'react-i18next';
import { MainNav } from '@/components/layout/main-nav';

interface DashboardViewProps {
    projects: Project[];
}

export function DashboardView({ projects }: DashboardViewProps) {
    const { t } = useTranslation('common');

    return (
        <div className="flex min-h-screen flex-col">
            <MainNav />
            <main className="flex-1 container py-8 px-4">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
                        <p className="text-muted-foreground mt-2">
                            {t('dashboard.subtitle')}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <ImportProjectButton />
                        <NewProjectDialog />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                    ))}

                    {projects.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-card text-muted-foreground text-center">
                            <p className="mb-4">{t('dashboard.no_projects')}</p>
                            <NewProjectDialog />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
