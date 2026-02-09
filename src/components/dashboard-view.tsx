'use client';

import { useState, useMemo, useEffect } from 'react';
import { Project } from '@/types';
import { ProjectCard } from '@/components/project-card';
import { NewProjectDialog } from '@/components/new-project-dialog';
import { ImportProjectButton } from '@/components/import-project-button';
import { useTranslation } from 'react-i18next';
import { MainNav } from '@/components/layout/main-nav';
import { Input, Button } from '@/components/ui/core';
import { Search, Settings, PackageOpen, ArrowUpDown } from 'lucide-react';
import { useSettings } from '@/components/settings/settings-provider';
import { motion, AnimatePresence } from 'framer-motion';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface DashboardViewProps {
    projects: Project[];
}

export function DashboardView({ projects }: DashboardViewProps) {
    const { t } = useTranslation('common');
    const { openSettings } = useSettings();

    // ✅ Source of truth that stays in sync with props
    const [allProjects, setAllProjects] = useState<Project[]>(projects);
    const [query, setQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'updated' | 'name'>('updated');

    useEffect(() => {
        setAllProjects(projects);
    }, [projects]);

    const visibleProjects = useMemo(() => {
        const q = query.trim().toLowerCase();

        const filtered = q
            ? allProjects.filter((p) => p.name.toLowerCase().includes(q))
            : allProjects;

        const sorted = [...filtered].sort((a, b) => {
            if (sortOrder === 'updated') {
                return (
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                );
            }
            return a.name.localeCompare(b.name);
        });

        return sorted;
    }, [allProjects, query, sortOrder]);

    return (
        <div className="flex min-h-screen flex-col bg-background">
            <MainNav />
            <main className="flex-1 container py-8 px-4 space-y-8">
                {/* Header Section */}
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {t('dashboard.title')}
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            {t('dashboard.subtitle')}
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <div className="relative w-full md:w-64 lg:w-80 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder={t('dashboard.search_placeholder')}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                className="pl-9 pr-9 bg-muted/50 focus:bg-background transition-all border-transparent focus:border-input focus:ring-2 focus:ring-primary/20"
                            />
                            {query.length > 0 && (
                                <button
                                    onClick={() => setQuery('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label="Clear search"
                                >
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        width="16"
                                        height="16"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="h-4 w-4"
                                    >
                                        <path d="M18 6 6 18" />
                                        <path d="m6 6 12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="shrink-0"
                                        title={t('dashboard.sort.label')}
                                    >
                                        <ArrowUpDown className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuRadioGroup
                                        value={sortOrder}
                                        onValueChange={(v) =>
                                            setSortOrder(v as 'updated' | 'name')
                                        }
                                    >
                                        <DropdownMenuRadioItem value="updated">
                                            {t('dashboard.sort.updated')}
                                        </DropdownMenuRadioItem>
                                        <DropdownMenuRadioItem value="name">
                                            {t('dashboard.sort.name')}
                                        </DropdownMenuRadioItem>
                                    </DropdownMenuRadioGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <Button
                                variant="outline"
                                size="icon"
                                onClick={openSettings}
                                title={t('settings.title')}
                                className="shrink-0"
                            >
                                <Settings className="h-4 w-4" />
                            </Button>

                            <ImportProjectButton />
                            <NewProjectDialog />
                        </div>
                    </div>
                </div>

                {/* Projects Grid */}
                {visibleProjects.length > 0 ? (
                    <motion.div
                        layout
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                        <AnimatePresence mode="popLayout">
                            {visibleProjects.map((project) => (
                                <motion.div
                                    key={project.id}
                                    layout
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 12 }}
                                    transition={{ duration: 0.18 }}
                                >
                                    <ProjectCard project={project} />
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-card/50 text-muted-foreground text-center h-64"
                    >
                        <div className="p-4 rounded-full bg-muted mb-4">
                            <PackageOpen className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        {query ? (
                            <>
                                <h3 className="text-lg font-medium text-foreground mb-1">
                                    {t('dashboard.no_results')}
                                </h3>
                                <p className="text-sm max-w-xs mx-auto">
                                    {t('dashboard.no_results_desc')}
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="mb-4">{t('dashboard.no_projects')}</p>
                                <NewProjectDialog />
                            </>
                        )}
                    </motion.div>
                )}
            </main>
        </div>
    );
}
