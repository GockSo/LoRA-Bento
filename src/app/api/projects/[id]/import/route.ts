import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProject, updateProjectStats } from '@/lib/projects';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const formData = await req.formData();
        const files = formData.getAll('files') as File[];
        const { id } = await params;
        const projectId = id;

        if (!files.length) {
            return NextResponse.json({ error: 'No files uploaded' }, { status: 400 });
        }

        const project = await getProject(projectId);
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const projectsDir = path.join(process.cwd(), 'projects');
        const rawDir = path.join(projectsDir, projectId, 'raw');

        // Ensure raw dir exists (it should via project creation but safe check)
        await fs.mkdir(rawDir, { recursive: true });

        // Load Manifest to determine next ID and check duplicates
        const { getManifest, saveManifest, addToManifest } = await import('@/lib/manifest');
        const manifest = await getManifest(projectId);

        let maxGroupId = 0;
        const existingHashes = new Set<string>();

        // Build efficient lookups
        manifest.items.forEach(item => {
            if (item.groupId && item.groupId > maxGroupId) maxGroupId = item.groupId;
            if (item.hash) existingHashes.add(item.hash);
        });

        // Prepare QA Lib (Moved to Background Job)
        // const { calculatePHash, detectBlur } = await import('@/lib/qa');

        const results = [];
        const newManifestItems: any[] = [];

        let nextId = maxGroupId + 1;

        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Generate Numeric Filename
            // e.g. 1.png, 2.jpg
            const ext = path.extname(file.name);
            const canonicalName = `${nextId}${ext}`; // Simple N.ext
            const filePath = path.join(rawDir, canonicalName);

            // Write File
            await fs.writeFile(filePath, buffer);

            const newItem = {
                id: uuidv4(),
                stage: 'raw',
                src: `/api/images?path=${encodeURIComponent(filePath)}&t=${Date.now()}`,
                path: filePath,
                displayName: canonicalName,
                originalName: file.name,
                groupId: nextId,
                groupKey: canonicalName,
                // Flags init
                flags: {
                    isDuplicate: false,
                    isBlurry: false
                },
                excluded: false
            };

            newManifestItems.push(newItem);
            results.push(newItem);

            nextId++;
        }

        // Add to Manifest (Using specific helper or manual push since we did manual ID gen)
        // We'll manually push to update maxGroupId correctly? 
        // addToManifest handles pushing.
        await addToManifest(projectId, newManifestItems);

        await updateProjectStats(projectId);

        return NextResponse.json({ imported: results.length, items: results });
    } catch (error) {
        console.error('Import error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
