import { MainNav } from '@/components/layout/main-nav';
import { ProjectCard } from '@/components/project-card';
import { NewProjectDialog } from '@/components/new-project-dialog';
import { getProjects } from '@/lib/projects';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const projects = await getProjects();

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />
      <main className="flex-1 container py-8 px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-2">
              Manage your LoRA training datasets.
            </p>
          </div>
          <NewProjectDialog />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}

          {projects.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-card text-muted-foreground text-center">
              <p className="mb-4">No projects yet.</p>
              <NewProjectDialog />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
