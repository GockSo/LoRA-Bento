import { UploadZone } from '@/components/upload-zone';
import fs from 'fs/promises';
import path from 'path';
import { Card } from '@/components/ui/core';
import { getProject } from '@/lib/projects';

// Helper to list images
async function getImages(projectId: string) {
    try {
        const rawDir = path.join(process.cwd(), 'projects', projectId, 'raw');
        const files = await fs.readdir(rawDir);
        return files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).map(f => ({
            name: f,
            url: `/api/images?path=${encodeURIComponent(path.join(rawDir, f))}`
        }));
    } catch {
        return [];
    }
}

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const project = await getProject(id);

    if (!project) return <div>Project not found</div>;

    const images = await getImages(id);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Import Images</h1>
                <p className="text-muted-foreground">Drag and drop images or upload a folder.</p>
            </div>

            <UploadZone projectId={id} />

            <div className="space-y-4">
                <h2 className="text-lg font-semibold">Imported Images ({images.length})</h2>
                {images.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {images.map((img) => (
                            <Card key={img.name} className="overflow-hidden group relative aspect-[1/1] border-border/50">
                                <img
                                    src={img.url}
                                    alt={img.name}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                    loading="lazy"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 truncate px-2">
                                    {img.name}
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        No images imported yet.
                    </div>
                )}
            </div>
        </div>
    );
}
