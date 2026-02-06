import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectSettings } from '@/types';

const PROJECTS_DIR = path.join(process.cwd(), 'projects');

async function ensureDir(dir: string) {
    try {
        await fs.access(dir);
    } catch {
        await fs.mkdir(dir, { recursive: true });
    }
}

export async function getProjects(): Promise<Project[]> {
    await ensureDir(PROJECTS_DIR);
    const dirs = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const projects: Project[] = [];

    for (const dir of dirs) {
        if (dir.isDirectory()) {
            try {
                const configPath = path.join(PROJECTS_DIR, dir.name, 'config.json');
                const configData = await fs.readFile(configPath, 'utf-8');
                const project = JSON.parse(configData);
                projects.push(project);
            } catch (e) {
                console.error(`Failed to load project ${dir.name}:`, e);
            }
        }
    }

    // Sort by updated at desc
    return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function getProject(id: string): Promise<Project | null> {
    try {
        const configPath = path.join(PROJECTS_DIR, id, 'config.json');
        const configData = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(configData);
    } catch {
        return null;
    }
}

export async function createProject(name: string): Promise<Project> {
    const id = uuidv4();
    const projectDir = path.join(PROJECTS_DIR, id);

    await ensureDir(projectDir);
    await ensureDir(path.join(projectDir, 'raw'));
    await ensureDir(path.join(projectDir, 'augmented'));
    await ensureDir(path.join(projectDir, 'processed'));

    const initialSettings: ProjectSettings = {
        targetSize: 512,
        padMode: 'transparent',
    };

    const project: Project = {
        id,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: {
            raw: 0,
            augmented: 0,
            processed: 0,
            captions: 0
        },
        settings: initialSettings
    };

    await fs.writeFile(path.join(projectDir, 'config.json'), JSON.stringify(project, null, 2));
    return project;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const project = await getProject(id);
    if (!project) throw new Error('Project not found');

    const updatedProject = {
        ...project,
        ...updates,
        settings: updates.settings ? { ...project.settings, ...updates.settings } : project.settings,
        updatedAt: new Date().toISOString()
    };

    const projectDir = path.join(PROJECTS_DIR, id);
    await fs.writeFile(path.join(projectDir, 'config.json'), JSON.stringify(updatedProject, null, 2));
    return updatedProject;
}

export async function updateProjectStats(id: string) {
    const project = await getProject(id);
    if (!project) return;

    const projectDir = path.join(PROJECTS_DIR, id);

    const rawFiles = await fs.readdir(path.join(projectDir, 'raw')).catch(() => []);
    const augmentedFiles = await fs.readdir(path.join(projectDir, 'augmented')).catch(() => []);
    const processedFiles = await fs.readdir(path.join(projectDir, 'processed')).catch(() => []);

    // Basic count of text files in processed for captions (assuming .txt)
    const captionFiles = processedFiles.filter(f => f.endsWith('.txt'));
    const processedImages = processedFiles.filter(f => f.endsWith('.png') || f.endsWith('.jpg'));

    await updateProject(id, {
        stats: {
            raw: rawFiles.length,
            augmented: augmentedFiles.length,
            processed: processedImages.length,
            captions: captionFiles.length
        }
    });
}
