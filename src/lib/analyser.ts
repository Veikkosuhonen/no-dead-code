import { traverse, ObjectProperty, Node, CallExpression, Identifier, StringLiteral, Expression, V8IntrinsicIdentifier } from "@babel/types";
import { ConfigObject, ImportInfo, ParsedDirectory, ParsedFile } from "./parser.js";

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
    const exports: string[] = [];

    traverse(file.ast, {
        enter(path) {
            switch (path.type) {

                // ES module exports
                // export default foo
                case "ExportDefaultDeclaration":
                    exports.push("default");
                    break;

                // export { foo, bar }
                case "ExportNamedDeclaration":
                    if (path.declaration?.type === "VariableDeclaration") {
                        exports.push(
                            ...path.declaration.declarations.map(decl => decl.id.type === "Identifier" ? decl.id.name : undefined).filter(Boolean)
                        );
                    }
                    if (path.specifiers) {
                        exports.push(
                            ...path.specifiers.map(specifier => specifier.exported.type === "Identifier" ? specifier.exported.name : undefined).filter(Boolean)
                        );
                    }
                    break;
                
                // CommonJS module.exports
                // module.exports = { foo, bar }
                // module.exports = foo
                case "ExpressionStatement":
                    if (path.expression.type !== "AssignmentExpression") return
                    if (path.expression.left.type !== "MemberExpression") return
                    if (path.expression.left.object.type !== "Identifier" || path.expression.left.object.name !== "module") return
                    if (path.expression.right.type === "Identifier") {
                        // Default export
                        exports.push("default");
                    } else if (path.expression.right.type === "ObjectExpression") {
                        // Named exports
                        path.expression.right.properties.forEach(prop => {
                            if (prop.type === "ObjectProperty") {
                                if (prop.key.type === "Identifier") {
                                    exports.push(prop.key.name);
                                } else if (prop.key.type === "StringLiteral") {
                                    exports.push(prop.key.value);
                                }
                            }
                        })
                    }
                    break;
            }
        },
    })

    return exports
}

interface RequireIdentifier extends Identifier {
    name: "require"
}

interface RequireCall extends CallExpression {
    callee: RequireIdentifier
    arguments: [StringLiteral]
}

const getRequireCall = (path: Expression|V8IntrinsicIdentifier): RequireCall|undefined => {
    if (path.type !== "CallExpression") return
    if (path.callee.type !== "Identifier") return;
    if (path.callee.name !== "require") return;
    if (path.arguments.length !== 1) return;
    if (path.arguments[0].type !== "StringLiteral") return;
    const arg = path.arguments[0];

    return {
        ...path,
        type: "CallExpression",
        callee: { ...path.callee, name: "require" },
        arguments: [arg],
    }
}

const findImportedIdentifiers = (file: ParsedFile) => {
    const imports: ImportInfo[] = [];

    traverse(file.ast, {
        enter(path) {
            switch (path.type) {

                // ES module imports
                // import { foo } from "./bar"
                // import foo from "./bar"
                case "ImportDeclaration":
                    imports.push(
                        ...path.specifiers.map(specifier => {
                            if (specifier.type === "ImportSpecifier") {
                                const as = specifier.imported.type === "Identifier"
                                    ? specifier.imported.name
                                    : specifier.imported.value

                                return { as, from: path.source.value } 
                            } else if (specifier.type === "ImportDefaultSpecifier") {
                                return { as: "default", from: path.source.value } 
                            }
                        }).filter(Boolean)
                    );
                    break;

                // export { foo } from "./bar"
                case "ExportNamedDeclaration":
                    if (path.source) {
                        if (path.source.type === "StringLiteral") {
                            imports.push(...path.specifiers.map(specifier => {
                                if (specifier.type === "ExportSpecifier") {
                                    return {
                                        as: specifier.local.name,
                                        from: path.source!.value,
                                    }
                                } else {
                                    return {
                                        as: "default",
                                        from: path.source!.value,
                                    }
                                }
                            }))
                        }
                    }
                    break;
                
                // CommonJS require
                // const foo = require("./bar")
                // const { foo } = require("./bar")
                case "VariableDeclaration":
                    const type = "cjs"
                    path.declarations.forEach(decl => {
                        if (decl.type === "VariableDeclarator") {
                            const requireCall = decl.init ? getRequireCall(decl.init) : undefined;
                            if (!requireCall) return;
                            const from = requireCall.arguments[0].value;
                            // Only allow relative imports

                            // Default import
                            if (decl.id.type === "Identifier") {
                                imports.push({ as: "default", from, type });
                            } else if (decl.id.type === "ObjectPattern") {
                                // Named import (destructuring)
                                decl.id.properties.forEach(prop => {
                                    if (prop.type === "ObjectProperty") {
                                        if (prop.key.type === "Identifier") {
                                            imports.push({ as: prop.key.name, from, type });
                                        } else if (prop.key.type === "StringLiteral") {
                                            imports.push({ as: prop.key.value, from, type });
                                        }
                                    }
                                })
                            }
                        }
                    })
                    break;
                
                // CommonJS require
                // module.exports = require("./bar")
                case "ExpressionStatement":
                    if (path.expression.type !== "AssignmentExpression") return
                    const requireCall = getRequireCall(path.expression.right);
                    if (!requireCall) return;
                    const from = requireCall.arguments[0].value;
                    // Default import
                    imports.push({ as: "default", from, type: "cjs" });
                    break;
                
                // CommonJS require
                // require("./bar")()
                case "CallExpression":
                    // Is it being called?
                    let requireCall2 = getRequireCall(path.callee)
                    if (!requireCall2) {
                        // Or is it being passed as an argument?
                        for (const arg of path.arguments) {
                            requireCall2 = arg.type === "CallExpression" ? getRequireCall(arg) : undefined;
                            if (requireCall2) break;
                        }
                    }
                    if (!requireCall2) return;

                    const from2 = requireCall2.arguments[0].value;
                    // Default import
                    imports.push({ as: "default", from: from2, type: "cjs" });
            }
        },
    })

    return imports.map(importInfo => {
        // Remove file extension
        const path = importInfo.from.replace(/\.[^/.]+$/, "");
        return { ...importInfo, from: path };
    })
}

export const analyse = (root: ParsedDirectory) => {
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

    walkFiles(root);

    const markImport = (file: ParsedFile, importInfo: ImportInfo) => {
        if (file.moduleInfo?.unusedExports) {
            // If this is a CJS "default" import, consider all exports used
            if (importInfo.type === "cjs" && importInfo.as === "default") {
                file.moduleInfo.unusedExports = [];
                return;
            }

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
                // n import from node_modules
                console.log(`Could not find child ${segment} for ${file.name} (${importInfo.from})`);
            }
        }
    }

    const findAndMarkNonRelativeImport = (file: ParsedDirectory, pathSegments: string[], importInfo: ImportInfo) => {
        // find the root directory specified in compilerOptions.baseUrl of js/tsconfig
        // Search compilerOptions.baseUrl from configs
        const jsconfig = file.configs.find(c => Boolean(c.config.compilerOptions?.baseUrl))?.config
        const packageJsonDeps = file.configs.find(c => Boolean(c.config.dependencies))?.config?.dependencies ?? {}
        // console.log(packageJsonDeps)

        if (Object.keys(packageJsonDeps).some(dep => dep.split('/')[0] === importInfo.from.split('/')[0])) {
            // console.log(Object.keys(packageJsonDeps))
            // Ok, dep found
        } else if (jsconfig) {
            const { baseUrl } = jsconfig.compilerOptions
            // Add ./{baseUrl} to the segments and start relative search
            findAndMarkImport(file, ['.', baseUrl].concat(pathSegments), importInfo)
        } else if (file.parent) {
            // config not yet found, go look for it from parent dir
            findAndMarkNonRelativeImport(file.parent, pathSegments, importInfo)
        } else {
            // This is an error
            console.error(`Could not find dependency ${importInfo.from} (${pathSegments})`);
        }
    }

    const walkImports = (file: ParsedFile|ParsedDirectory, path: string[] = []) => {
        if (file.type === "file") {
            file.moduleInfo?.imports.forEach(importInfo => {
                const pathSegments = importInfo.from.split("/");

                // console.log(`Searching import ${importInfo.from} starting from ${path.join("/")} by ${relativePathSegments.join("/")}`);

                if (!file.parent) {
                    console.log(`Could not find parent for ${file.name}. Outside scan range.`);
                    return;
                }

                if (pathSegments[0].startsWith('.')) {
                    findAndMarkImport(file.parent, pathSegments, importInfo);
                } else {
                    findAndMarkNonRelativeImport(file.parent, pathSegments, importInfo);
                }
            })
        } else {
            file.children.forEach(child => walkImports(child, [...path, child.name]));
        }
    }

    walkImports(root);

    return allSourceFiles
}
