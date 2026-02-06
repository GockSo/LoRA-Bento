import fs from 'fs/promises';
import path from 'path';

export async function safeDelete(projectDir: string, targetPath: string, force: boolean = false) {
    // 1. Resolve absolute path
    const absoluteTarget = path.resolve(targetPath);
    const absoluteProject = path.resolve(projectDir);

    // 2. Security Check: Must be within project dir
    if (!absoluteTarget.startsWith(absoluteProject)) {
        throw new Error('Path traversal detected');
    }

    // 3. specific Safety Check: NEVER delete from 'raw' folder
    const rawDir = path.join(absoluteProject, 'raw');
    if (absoluteTarget.startsWith(rawDir) && !force) {
        throw new Error('Safety Guard: Attempted to delete raw file');
    }

    // 4. Allowed folders check (Explicit whitelist)
    const allowedFolders = ['raw', 'augmented', 'processed', 'captions', 'analysis', 'export', 'jobs'];
    const isAllowed = allowedFolders.some(folder =>
        absoluteTarget.startsWith(path.join(absoluteProject, folder))
    );

    if (!isAllowed) {
        // Allow deleting specific known files like project.json if strictly needed?
        // For now, only content folders.
        throw new Error('Deletion not allowed in this directory');
    }

    try {
        await fs.unlink(absoluteTarget);
    } catch (e: any) {
        if (e.code !== 'ENOENT') {
            throw e;
        }
    }
}

export async function safeClearFolder(projectDir: string, folderName: string) {
    // Only allow clearing specific folders
    const allowed = ['augmented', 'processed', 'captions', 'analysis', 'export', 'jobs'];
    if (!allowed.includes(folderName)) {
        throw new Error(`Cannot clear folder: ${folderName}`);
    }

    const folderPath = path.join(projectDir, folderName);
    try {
        const files = await fs.readdir(folderPath);
        for (const file of files) {
            const filePath = path.join(folderPath, file);

            try {
                const stats = await fs.lstat(filePath);
                if (stats.isDirectory()) {
                    // Recursively remove directory
                    await fs.rm(filePath, { recursive: true, force: true });
                } else {
                    // Delete file safely
                    await safeDelete(projectDir, filePath, false);
                }
            } catch (e) {
                console.error(`Failed to delete ${file} in ${folderName}`, e);
            }
        }
    } catch (e: any) {
        // Folder might not exist, ignore
        if (e.code !== 'ENOENT') console.error(`Failed to clear ${folderName}`, e);
    }
}
