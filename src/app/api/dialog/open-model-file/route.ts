import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execFileAsync = promisify(execFile);

export async function POST() {
    try {
        const platform = os.platform();
        let selectedPath: string | null = null;

        if (platform === 'win32') {
            // Windows: PowerShell with OpenFileDialog
            const psScript = `
                Add-Type -AssemblyName System.Windows.Forms
                $openFileDialog = New-Object System.Windows.Forms.OpenFileDialog
                $openFileDialog.Filter = "Model Files (*.safetensors;*.ckpt)|*.safetensors;*.ckpt|All files (*.*)|*.*"
                $openFileDialog.Title = "Select Pretrained Model"
                $result = $openFileDialog.ShowDialog()
                if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
                    Write-Host $openFileDialog.FileName
                }
            `;

            const powershellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';

            try {
                const { stdout } = await execFileAsync(powershellPath, ['-NoProfile', '-Command', psScript]);
                selectedPath = stdout.trim();
            } catch (err) {
                // Fallback to just 'powershell' if absolute path fails for some reason
                console.warn('Absolute path failed, trying "powershell" command', err);
                const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psScript]);
                selectedPath = stdout.trim();
            }
        }

        else if (platform === 'darwin') {
            // macOS: AppleScript
            const script = `
                tell application "System Events"
                    activate
                    set filePath to choose file with prompt "Select Pretrained Model" of type {"safetensors", "ckpt"}
                    POSIX path of filePath
                end tell
            `;
            try {
                const { stdout } = await execFileAsync('osascript', ['-e', script]);
                selectedPath = stdout.trim();
            } catch (e) {
                // User cancelled or error
                console.log('User cancelled or error', e);
            }

        } else {
            // Linux: zenity (best effort)
            try {
                const { stdout } = await execFileAsync('zenity', [
                    '--file-selection',
                    '--title=Select Pretrained Model',
                    '--file-filter=Model Files | *.safetensors *.ckpt'
                ]);
                selectedPath = stdout.trim();
            } catch (e) {
                // Try kdialog
                try {
                    const { stdout: kstdout } = await execFileAsync('kdialog', [
                        '--getopenfilename',
                        '.',
                        '*.safetensors *.ckpt | Model Files'
                    ]);
                    selectedPath = kstdout.trim();
                } catch (kerr) {
                    return NextResponse.json({ ok: false, error: 'Native file picker not available (zenity/kdialog missing)' });
                }
            }
        }

        if (selectedPath) {
            return NextResponse.json({ ok: true, path: selectedPath });
        } else {
            return NextResponse.json({ ok: false, canceled: true });
        }

    } catch (error: any) {
        console.error('File dialog error:', error);
        return NextResponse.json({ ok: false, error: error.message || 'Unknown error' });
    }
}
