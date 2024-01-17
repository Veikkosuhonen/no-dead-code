import { Expression, Node, traverse } from "@babel/types";
import { ImportInfo, ParsedDirectory, ParsedFile } from "./parser.js";

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

const findImportedIdentifiers = (file: ParsedFile) => {
    const imports: ImportInfo[] = [];

    traverse(file.ast, {
        enter(path) {
            switch (path.type) {
                case "ImportDeclaration":
                    imports.push(
                        ...path.specifiers.map(specifier => {
                            if (specifier.type === "ImportSpecifier") {
                                return { as: specifier.local.name, from: path.source.value } 
                            } else if (specifier.type === "ImportDefaultSpecifier") {
                                return { as: "default", from: path.source.value } 
                            }
                        }).filter(spec => spec && spec.from.startsWith(".")) as ImportInfo[]
                    );
                    break;
            }
        },
    })

    return imports
}

export const analyse = (files: (ParsedFile|ParsedDirectory)[]) => {

    const sourceDir = findFile(files, ["src"]);
    if (!sourceDir) {
        throw new Error(`Could not find source directory`);
    }

    const allSourceFiles: ParsedFile[] = []

    const walkFiles = (file: ParsedFile|ParsedDirectory, path: string[] = []) => {
        if (file.type === "file") {
            const exports = findExportedIdentifiers(file);
            const imports = findImportedIdentifiers(file);
            file.moduleInfo = { exports, unusedExports: [...exports], imports };
            allSourceFiles.push(file);
        } else {
            file.children.forEach(child => walkFiles(child, [...path, child.name]));
        }
    }

    walkFiles(sourceDir);

    const markImport = (file: ParsedFile, importInfo: ImportInfo) => {
        if (file.moduleInfo?.unusedExports) {
            file.moduleInfo.unusedExports = file.moduleInfo.unusedExports.filter(exportName => exportName !== importInfo.as)
        }
    }

    const findAndMarkImport = (file: ParsedFile|ParsedDirectory, relativePathSegments: string[], importInfo: ImportInfo) => {
        const [segment, ...rest] = relativePathSegments;

        if (segment === undefined) {
            if (file.type === "file") {
                markImport(file, importInfo);
            } else {
                const indexFile = file.children.find(child => child.name.startsWith("index."));
                if (indexFile?.type === "file") {
                    markImport(indexFile, importInfo);
                } else {
                    console.log(`Could not find index file for ${file.name}`);
                }
            }
        
        } else if (segment === ".") {
            findAndMarkImport(file, rest, importInfo);
        
        } else if (segment === "..") {
            if (file.parent) {
                findAndMarkImport(file.parent, rest, importInfo);
            } else {
                console.log(`Could not find parent for ${file.name}`);
            }

        } else {
            if (file.type === "file") {
                console.log(`Could not find child ${segment} for ${file.name} (is not a directory)`);
                return;
            }
    
            const child = file.children.find(child => child.name.match(new RegExp(`^${segment}\\.?`)));
            if (child) {
                findAndMarkImport(child, rest, importInfo);
            } else {
                console.log(`Could not find child ${segment} for ${file.name}`);
            }
        }
    }

    const walkImports = (file: ParsedFile|ParsedDirectory, path: string[] = []) => {
        if (file.type === "file") {
            file.moduleInfo?.imports.forEach(importInfo => {
                const relativePathSegments = importInfo.from.split("/");

                // console.log(`Searching import ${importInfo.from} starting from ${path.join("/")} by ${relativePathSegments.join("/")}`);

                if (!file.parent) {
                    console.log(`Could not find parent for ${file.name}. Outside scan range.`);
                    return;
                }

                findAndMarkImport(file.parent, relativePathSegments, importInfo);
            })
        } else {
            file.children.forEach(child => walkImports(child, [...path, child.name]));
        }
    }

    walkImports(sourceDir);

    // Report unused exports
    allSourceFiles.forEach(file => {
        if (file.moduleInfo?.unusedExports.length) {
            console.log(`${file.name}: Unused exports: ${file.moduleInfo.unusedExports.join(", ")}`);
        }
    })
}
