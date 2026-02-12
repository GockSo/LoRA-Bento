
import { runGit, isDirty } from '../lib/git';

async function verify() {
    console.log('Verifying Git Safety Safeguards...');

    try {
        console.log('Testing isDirty()...');
        const dirty = await isDirty();
        console.log(`isDirty() returned: ${dirty}`);
    } catch (e) {
        console.error('isDirty() failed:', e);
        process.exit(1);
    }

    try {
        console.log('Testing blocked command: git clean -fdx');
        await runGit(['clean', '-fdx']);
        console.error('FAIL: runGit(["clean", "-fdx"]) should have failed but succeeded!');
        process.exit(1);
    } catch (e: any) {
        if (e.message.includes('BLOCKED')) {
            console.log('PASS: git clean was blocked correctly.');
        } else {
            console.error('FAIL: runGit(["clean"]) failed with unexpected error:', e);
            process.exit(1);
        }
    }

    try {
        console.log('Testing blocked command: git stash');
        await runGit(['stash']);
        console.error('FAIL: runGit(["stash"]) should have failed but succeeded!');
        process.exit(1);
    } catch (e: any) {
        if (e.message.includes('BLOCKED')) {
            console.log('PASS: git stash was blocked correctly.');
        } else {
            console.error('FAIL: runGit(["stash"]) failed with unexpected error:', e);
            process.exit(1);
        }
    }

    try {
        console.log('Testing allowed command: git status');
        await runGit(['status']);
        console.log('PASS: git status executed successfully.');
    } catch (e) {
        console.error('FAIL: runGit(["status"]) failed:', e);
        process.exit(1);
    }

    console.log('All verification tests passed.');
}

verify();
