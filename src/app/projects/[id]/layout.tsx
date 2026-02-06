import { MainNav } from '@/components/layout/main-nav';
import { StepsSidebar } from '@/components/layout/steps-sidebar';
import { getProject } from '@/lib/projects';
import { notFound } from 'next/navigation';

export default async function ProjectLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) {
        notFound();
    }

    return (
        <div className="flex min-h-screen flex-col">
            <MainNav />
            <div className="flex flex-1 overflow-hidden">
                <StepsSidebar project={project} />
                <main className="flex-1 overflow-y-auto bg-muted/10 p-8">
                    <div className="mx-auto max-w-6xl">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
