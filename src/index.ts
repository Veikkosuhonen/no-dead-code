#!/usr/bin/env node

import { analyse } from "./lib/analyser.js";
import { parseDirectory } from "./lib/parser.js";
import { isDeno } from "./lib/config.js";

const getArgs = () => {
    /* @ts-ignore */
    const args = isDeno() ? Deno.args : process.argv as any as string[];

    return args;
}

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

    analyse(result);
}

main(getArgs()).catch(err => {
  console.error(err)
  process.exit(1)
})
