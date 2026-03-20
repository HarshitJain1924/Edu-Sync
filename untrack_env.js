const { execSync } = require('child_process');

function run(cmd, cwd) {
  try {
    console.log(`\n--- Running: ${cmd} in ${cwd} ---`);
    const out = execSync(cmd, { cwd, encoding: 'utf8' });
    console.log(out);
  } catch (e) {
    console.log(`Command failed or nothing to commit.`);
  }
}

const dir1 = 'c:\\Users\\harsh\\OneDrive\\Desktop\\edu-sync-future-1';

// We do it in dir1, assuming it's the git root. If dir2 is also a git root, we'd do it there, but usually it's just one git repo.
run('git rm --cached .env', dir1);
run('git rm --cached edu-sync-future-main/.env', dir1);

// Add the changed gitignore if needed, but they are already correct
run('git commit -m "chore: stop tracking .env files"', dir1);

console.log('Finished git operations.');
