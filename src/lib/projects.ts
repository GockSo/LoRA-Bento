import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Project, ProjectSettings, ProjectStats } from '@/types';
import AdmZip from 'adm-zip';



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

export async function getProjectStats(projectId: string): Promise<ProjectStats> {
    const projectDir = path.join(PROJECTS_DIR, projectId);

    const countFiles = async (dir: string) => {
        try {
            const files = await fs.readdir(dir);
            return files.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).length;
        } catch { return 0; }
    };

    const countTxt = async (dir: string) => {
        try {
            const files = await fs.readdir(dir);
            return files.filter(f => f.endsWith('.txt')).length;
        } catch { return 0; }
    };

    return {
        total: await countFiles(path.join(projectDir, 'raw')),
        // Update crop count to count all crop variants in subdirectories
        cropped: await (async () => {
            try {
                const cropDir = path.join(projectDir, 'cropped');
                const entries = await fs.readdir(cropDir, { withFileTypes: true });
                let count = 0;
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        // It's a directory for a raw image, count crops inside
                        const subDir = path.join(cropDir, entry.name);
                        const subFiles = await fs.readdir(subDir);
                        count += subFiles.filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f)).length;
                    } else if (/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) {
                        // Legacy flat file support
                        count++;
                    }
                }
                return count;
            } catch { return 0; }
        })(),
        augmented: await countFiles(path.join(projectDir, 'augmented')),
        processed: await countFiles(path.join(projectDir, 'processed')),
        captions: await countTxt(path.join(projectDir, 'processed'))
    };
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
    await ensureDir(path.join(projectDir, 'cropped'));
    await ensureDir(path.join(projectDir, 'augmented'));
    await ensureDir(path.join(projectDir, 'processed'));

    const initialSettings: ProjectSettings = {
        targetSize: 512,
        padMode: 'transparent',
        padColor: '#000000'
    };

    const project: Project = {
        id,
        name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: {
            total: 0,
            cropped: 0,
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
    const croppedFiles = await fs.readdir(path.join(projectDir, 'cropped')).catch(() => []);
    const processedFiles = await fs.readdir(path.join(projectDir, 'processed')).catch(() => []);

    // Basic count of text files in processed for captions (assuming .txt)
    const captionFiles = processedFiles.filter(f => f.endsWith('.txt'));
    const processedImages = processedFiles.filter(f => f.endsWith('.png') || f.endsWith('.jpg'));

    await updateProject(id, {
        stats: {
            total: rawFiles.length,
            cropped: croppedFiles.length,
            augmented: augmentedFiles.length,
            processed: processedImages.length,
            captions: captionFiles.length
        }
    });
}

export async function renameProject(id: string, newName: string): Promise<Project> {
    return updateProject(id, { name: newName });
}

export async function deleteProject(id: string): Promise<void> {
    const projectDir = path.join(PROJECTS_DIR, id);
    // Recursive delete
    await fs.rm(projectDir, { recursive: true, force: true });
}

export async function exportProjectZip(id: string): Promise<Buffer> {
    const project = await getProject(id);
    if (!project) throw new Error('Project not found');

    const projectDir = path.join(PROJECTS_DIR, id);
    const zip = new AdmZip();

    // Add local folder to zip
    // 2nd arg is zipPath in archive. We want contents to be at root or under a folder? 
    // Usually portable zips might have a root folder, but for simple import/export often root contents are easier.
    // Let's stick effectively to "contents of project folder"
    zip.addLocalFolder(projectDir);

    return zip.toBuffer();
}

export async function importProjectZip(zipBuffer: Buffer): Promise<Project> {
    await ensureDir(PROJECTS_DIR); // Ensure projects dir exists

    // We need to inspect the zip before extracting to determine ID / validity
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();

    // Validate: look for config.json
    const configEntry = zipEntries.find(entry => entry.entryName === 'config.json' || entry.entryName.endsWith('/config.json'));

    if (!configEntry) {
        throw new Error('Invalid project zip: config.json not found');
    }

    // Read config to extract ID (or generate new one if we want to avoid collisions, but user asked for "restore" or "import")
    // "either keep original projectId if no collision or generate new projectId"
    // Let's read the config first.
    const configContent = configEntry.getData().toString('utf8');
    let projectConfig: Project;
    try {
        projectConfig = JSON.parse(configContent);
    } catch {
        throw new Error('Invalid project zip: malformed config.json');
    }

    // Check availability
    let finalId = projectConfig.id;
    let existing = await getProject(finalId);

    // If collision, generate new ID
    if (existing) {
        finalId = uuidv4();
        projectConfig.id = finalId;
        // We might need to rewrite other ID refs if they existed, but for now ID is mainly in config.
    }

    const projectDir = path.join(PROJECTS_DIR, finalId);
    await ensureDir(projectDir);

    // Extract all
    zip.extractAllTo(projectDir, true);

    // If we changed ID, we must update the config.json on disk
    if (finalId !== JSON.parse(configContent).id) {
        await fs.writeFile(path.join(projectDir, 'config.json'), JSON.stringify(projectConfig, null, 2));
    }

    return projectConfig;
}
