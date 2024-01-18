import { ParsedFile } from "./parser.js";

export const printUnusedExports = (sourceFiles: ParsedFile[]) => {
    // Report unused exports
    sourceFiles.forEach(file => {
        if (file.moduleInfo?.unusedExports.length) {
            console.log(`${file.path}: Unused exports: ${file.moduleInfo.unusedExports.join(", ")}`);
        }
    })
}