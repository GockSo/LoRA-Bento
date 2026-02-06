import Link from 'next/link';
import { Project } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/core';
import { Button } from '@/components/ui/core';
import { FolderOpen, Images, Layers, FileText } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ProjectCardProps {
    project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
    return (
        <Card className="flex flex-col hover:shadow-lg transition-all">
            <CardHeader>
                <CardTitle className="truncate" title={project.name}>{project.name}</CardTitle>
                <CardDescription>
                    Updated {formatDistanceToNow(new Date(project.updatedAt))} ago
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    <div className="flex justify-between">
                        <span>Total Images</span>
                        <span className="font-medium">{project.stats.total}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Total Images</span>
                        <span className="font-medium">{project.stats.total}</span>
                    </div>
                    <div className="flex items-center gap-2 col-span-2">
                        <FileText className="h-4 w-4" />
                        <span>{project.stats.captions} Captioned</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button asChild className="w-full">
                    <Link href={`/projects/${project.id}/raw`}>
                        <FolderOpen className="mr-2 h-4 w-4" />
                        Open Project
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
