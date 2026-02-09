import { getProjects } from '@/lib/projects';
import { DashboardView } from '@/components/dashboard-view';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const projects = await getProjects();

  return <DashboardView projects={projects} />;
}
