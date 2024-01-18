#!/usr/bin/env node

import { analyse } from "./lib/analyser.js";
import { parseDirectory } from "./lib/parser.js";
import { printUnusedExports } from "./lib/printer.js";

const main = async (args: string[]) => {
    let path = args[2];
    if (!path) {
        path = '.';
    }

    const result = await parseDirectory({
        path, 
        extensions: ['js', 'ts', 'tsx', 'jsx'],
        ignore: ['node_modules', '.git']
    });

    const sourceFiles = analyse(result);

    if (sourceFiles.length === 0) {
        console.log("No source files found");
        return;
    }

    printUnusedExports(sourceFiles);
}

main(process.argv).catch(err => {
  console.error(err)
  process.exit(1)
})
