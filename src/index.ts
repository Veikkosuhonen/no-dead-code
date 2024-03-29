#!/usr/bin/env node

import { program } from "commander"
import { analyse } from "./lib/analyser.js";
import { parseDirectory } from "./lib/parser.js";
import { printUnusedExports } from "./lib/printer.js";

program
    .name('no-dead-code')
    .description('Search unused exports in your code')
    .argument('[path]', 'the path to begin search from', '.')
    .option('--no-default-ignore', 'specify to allow node_modules, .git, dist, build and migrations to be included')
    .option('--no-node-stdlib', 'specify to not resolve to node std APIs')
    .option('--no-dev', 'specify to not resolve dev dependecies')
    .option('-i, --ignore <ignorePaths...>', 'specify paths to ignore')
    .option('-e, --extensions <extensions...>', 'specify the extensions to include', ['mjs', 'cjs', 'js', 'ts', 'tsx', 'jsx'])
    .parse()


const path = program.processedArgs[0]
const opts = program.opts()

;(async () => {
    const extensions = opts.extensions ?? []
    const ignore = opts.ignore ?? []
    if (opts.defaultIgnore) ignore.push('node_modules', '.git', 'dist', 'build', 'migrations')

    const result = await parseDirectory({
        path, 
        extensions,
        ignore,
    });

    const standardLib: string[] = [];
    if (opts.nodeStdlib) standardLib.push('fs', 'os', 'path', 'crypto', 'events', 'util', 'net', 'http', 'https', 'dns', 'url', 'child_process', 'cluster', 'process', 'stream')
    const sourceFiles = analyse(result, standardLib, Boolean(opts.dev));

    if (sourceFiles.length === 0) {
        console.log("No source files found");
        return;
    }

    printUnusedExports(sourceFiles);
})()
