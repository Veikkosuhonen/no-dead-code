import { analyse } from "../lib/analyser.ts";
import { clone, exists, getRepoPath } from "../lib/fileStore.ts";
import { parseRepo } from "../lib/parser.ts";


const getArgs = () => {
    /* @ts-ignore */
    const args = Deno.args as any as string[];

    return args;
}

const main = async (args: string[]) => {
    const repoUrl = args[0];
    const rootFile = args[1];
    if (!repoUrl) {
        throw new Error('Missing repoUrl argument');
    }
    if (!rootFile) {
        throw new Error('Missing rootFile argument');
    }

    const dir = getRepoPath(repoUrl);

    if (!(await exists(dir))) {
        await clone(repoUrl);
    }

    const result = await parseRepo(repoUrl, ['js', 'ts', 'tsx', 'jsx']);

    analyse(result, rootFile);
}

main(getArgs()).catch(err => {
  console.error(err)
  process.exit(1)
})
