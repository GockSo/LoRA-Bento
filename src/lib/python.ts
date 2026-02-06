import { spawn } from 'child_process';
import path from 'path';

export async function runPythonScript(scriptName: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(process.cwd(), 'scripts', scriptName);
        const pythonProcess = spawn('python', [scriptPath, ...args]);

        let output = '';
        let errorOutput = '';

        pythonProcess.stdout.on('data', (data) => {
            output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Python script exited with code ${code}: ${errorOutput}`));
            } else {
                resolve(output);
            }
        });

        pythonProcess.on('error', (err) => {
            reject(err);
        });
    });
}
