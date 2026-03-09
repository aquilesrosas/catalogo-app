const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            replaceInDir(p);
        } else if (p.endsWith('.js') || p.endsWith('.mjs') || p.endsWith('.cjs')) {
            let c = fs.readFileSync(p, 'utf8');
            const original = c;
            c = c.replace(/import\.meta\.env\s*\?\s*import\.meta\.env\.MODE\s*:\s*void 0/g, '("production")');
            if (original !== c) {
                fs.writeFileSync(p, c);
                console.log("Patched:", p);
            }
        }
    }
}

replaceInDir('node_modules/zustand');
