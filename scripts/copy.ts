import * as shell from 'shelljs';
import * as path from 'path';

// copy index.html to dist
shell.cp(
    path.join(__dirname, '..', 'src', 'index.html'),
    path.join(__dirname, '..', 'dist')
);