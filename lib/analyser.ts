import { Expression, Node, traverse } from "@babel/types";
import { ParsedDirectory, ParsedFile } from "./parser.ts";
import { printTree } from "./printer.ts";

const findFile = (files: (ParsedFile|ParsedDirectory)[], segments: string[]): ParsedFile|ParsedDirectory|undefined => {
    const [segment, ...rest] = segments;

    const file = files.find(file => file.name === segment);

    if (!file) {
        return undefined;
    }

    if (rest.length === 0) {
        return file;
    }

    if (file.type === "directory") {
        return findFile(file.children, rest);
    }

    return undefined;
}

const findExportedIdentifiers = (file: ParsedFile) => {
    const exports = [] as string[];

    traverse(file.ast, {
        enter(path) {
            switch (path.type) {
                case "ExportDefaultDeclaration":
                    exports.push("default");
                    break;
                case "ExportNamedDeclaration":
                    if (path.declaration?.type === "VariableDeclaration") {
                        exports.push(
                            ...path.declaration.declarations.map(decl => decl.id.type === "Identifier" ? decl.id.name : undefined).filter(Boolean) as string[]
                        );
                    }
                    if (path.specifiers) {
                        exports.push(
                            ...path.specifiers.map(specifier => specifier.exported.type === "Identifier" ? specifier.exported.name : undefined).filter(Boolean) as string[]
                        );
                    }
                    break;
            }
        },
    })

    return exports
}

export const analyse = (files: (ParsedFile|ParsedDirectory)[], rootFilePath: string) => {
    const rootFile = findFile(files, rootFilePath.split("/"));

    if (!rootFile) {
        throw new Error(`Could not find root file ${rootFilePath}`);
    }

    if (rootFile.type === 'directory') {
        throw new Error(`Root file ${rootFilePath} is a directory`);
    }

    const walkFiles = (file: ParsedFile|ParsedDirectory, path: string[] = []) => {
        if (file.type === "file") {
            const exports = findExportedIdentifiers(file);
            console.log(path.join("/"), exports);
        } else {
            file.children.forEach(child => walkFiles(child, [...path, child.name]));
        }
    }

    const sourceDir = findFile(files, ["src"]);
    if (!sourceDir) {
        throw new Error(`Could not find source directory`);
    }

    walkFiles(sourceDir);
}
