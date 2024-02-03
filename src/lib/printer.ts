import chalk from "chalk"
import { ParsedFile } from "./parser.js";

export const printUnusedExports = (sourceFiles: ParsedFile[]) => {

    let totalCount = 0
    const filesWithUnusedExports = sourceFiles.filter(f => {
        const unusedCount = f.moduleInfo?.unusedExports.length || 0
        totalCount += unusedCount
        return unusedCount
    })
    
    if (filesWithUnusedExports.length > 0) {
        console.log(chalk`{bgRedBright
{black {bold >> DEAD CODE DETECTED <<}}
{black >> in {bold ${filesWithUnusedExports.length}} files,}
{black >> {bold ${totalCount}} unused exports (suspected)}}
    `)
    }

    filesWithUnusedExports.forEach(file => {
        const path = file.path.split('/').map(segm => segm).join(chalk.gray('/'))
        console.log(chalk`{underline ${path}}:\n {gray Unused exports:}\n ${file.moduleInfo!.unusedExports.map(e => e === "default" ? chalk.bold.yellowBright(e) : chalk.yellowBright(e)).join(", ")}`);
    })
}
