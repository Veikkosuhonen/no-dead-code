import { traverse, CallExpression, Identifier, StringLiteral, Expression, V8IntrinsicIdentifier } from "@babel/types";
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

const getRequire = (path: Expression|V8IntrinsicIdentifier): RequireCall|undefined => {
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
                            const requireCall = decl.init ? getRequire(decl.init) : undefined;
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
                    if (path.expression.type === "AssignmentExpression") {
                        const requireCall = getRequire(path.expression.right);
                        if (!requireCall) return;
                        const from = requireCall.arguments[0].value;
                        // Default import
                        imports.push({ as: "default", from, type: "cjs" });
                    } else if (path.expression.type === "MemberExpression") {
                        const requireCall = getRequire(path.expression.object);
                        if (!requireCall) return;
                        const from = requireCall.arguments[0].value;
                        // Default import
                        imports.push({ as: "default", from, type: "cjs" });
                    }
                    break;
                
                // CommonJS require or ES module dynamic import
                // require("./bar")(), f(require("./bar"))
                // import("wtf")
                case "CallExpression":
                    if (path.callee.type === "Import") { // ES module import()
                        const fromArg = path.arguments[0]
                        if (fromArg.type === "StringLiteral") {
                            imports.push({
                                as: "*", // Special case, too hard to determine what is imported so just assume everything
                                from: fromArg.value,
                                type: "esm"
                            })
                        }
                    } else { // CommonJS
                        // Is it being called?
                        let requireCall2 = getRequire(path.callee)
                        if (!requireCall2) {
                            // Or is it being passed as an argument?
                            for (const arg of path.arguments) {
                                requireCall2 = arg.type === "CallExpression" ? getRequire(arg) : undefined;
                                if (requireCall2) break;
                            }
                        }
                        if (!requireCall2) return;

                        const from2 = requireCall2.arguments[0].value;
                        // Default import
                        imports.push({ as: "default", from: from2, type: "cjs" });
                    }
            }
        },
    })

    return imports.map(importInfo => {
        // Remove file extension
        const path = importInfo.from.replace(/\.[^/.]+$/, "");
        return { ...importInfo, from: path };
    })
}

const splitPath = (path: string) => path.split('/').filter(Boolean)

const resolvePathAlias = (paths: { [alias: string]: string[] }, pathSegments: string[]): string[][] => {
    let resolveds: { segments: string[], specifity: number }[] = []

    Object.keys(paths).forEach(alias => {
        const aliasSegments = splitPath(alias)
        const tempPathSegments = [...pathSegments]
        let wildCard: string|undefined // Only one wildcard allowed (tsdocs)
        let specifity = 0;

        while (tempPathSegments.length > 0) {
            if (tempPathSegments[0] === aliasSegments[0]) {
                aliasSegments.shift()
                tempPathSegments.shift()
                specifity++;
            } else if (aliasSegments[0] === '*') {
                aliasSegments.shift()
                wildCard = tempPathSegments.shift()
            } else {
                break;
            }
        }

        // Is it a match?
        if (aliasSegments.length === 0) {
            // Remove lower specifity paths
            resolveds = resolveds.filter(r => r.specifity >= specifity)

            const resolvedPaths = paths[alias]
            if (resolvedPaths) {
                resolveds.push(
                    ...resolvedPaths.map(resolvedPaths => ({
                        segments: splitPath(resolvedPaths).map(segment => wildCard && segment === '*' ? wildCard : segment),
                        specifity,
                    }))
                )
            }
        }
    })

    return resolveds.map(r => r.segments)
}

export const analyse = (root: ParsedDirectory, standardLib: string[], allowDevDeps = false) => {
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
            // If this is a ES * import, consider all exports used
            if (importInfo.type === "esm" && importInfo.as === "*") {
                file.moduleInfo.unusedExports = [];
                return;
            }

            file.moduleInfo.unusedExports = file.moduleInfo.unusedExports.filter(exportName => exportName !== importInfo.as)
        }
    }

    const findAndMarkImport = (file: ParsedFile|ParsedDirectory, relativePathSegments: string[], importInfo: ImportInfo): boolean => {
        const [segment, ...rest] = relativePathSegments;

        if (segment === undefined) {
            if (file.type === "file") {
                markImport(file, importInfo);
                return true
            } else {
                const indexFile = file.children.find(child => child.name.startsWith("index."));
                if (indexFile?.type === "file") {
                    markImport(indexFile, importInfo);
                    return true
                } else {
                    console.log(`Could not find index file for ${file.name}`);
                    return false
                }
            }
        
        } else if (segment === ".") {
            return findAndMarkImport(file, rest, importInfo);
        
        } else if (segment === "..") {
            if (file.parent) {
                return findAndMarkImport(file.parent, rest, importInfo);
            } else {
                console.log(`Could not find parent for ${file.name}`);
                return false
            }

        } else {
            if (file.type === "file") {
                console.log(`Could not find child ${segment} for ${file.name} (is not a directory)`);
                return false;
            }
    
            const matchingChildren = file.children.filter(child => child.name.match(new RegExp(`^${segment}\\.?`)));
            
            // If this is the last segment, go to the file. Else go to the directory
            const childFile = matchingChildren.find(f => f.type === "file")
            const childDir = matchingChildren.find(f => f.type === "directory")

            if (rest.length === 0 && childFile) {
                // console.log(childFile.name)
                return findAndMarkImport(childFile, rest, importInfo);
            } else if (childDir) {
                // console.log(childDir.name)
                return findAndMarkImport(childDir, rest, importInfo);
            } else {
                // n import from node_modules
                console.log(`Could not find child ${segment} for ${file.name} (${importInfo.from})`);
                return false
            }
        }
    }

    const findAndMarkNonRelativeImport = (file: ParsedDirectory, pathSegments: string[], importInfo: ImportInfo) => {

        const baseUrl = splitPath( file.configs.find(c => Boolean(c.config.compilerOptions?.baseUrl))?.config?.compilerOptions?.baseUrl ?? '' )
        const aliases = file.configs.find(c => Boolean(c.config.compilerOptions?.paths))?.config?.compilerOptions?.paths ?? {}
        const packageJsonAliases = file.configs.find(c => Boolean(c.config._moduleAliases))?.config?._moduleAliases ?? {}
        const packageJsonDeps = file.configs.find(c => Boolean(c.config.dependencies))?.config?.dependencies ?? {}
        if (allowDevDeps) {
            Object.assign(packageJsonDeps, file.configs.find(c => Boolean(c.config.devDependencies))?.config?.devDependencies ?? {})
        }

        const resolvedPaths = resolvePathAlias(aliases, pathSegments)

        if (Object.keys(packageJsonDeps).some(dep => splitPath(dep)[0] === splitPath(importInfo.from)[0])) {
            // console.log(Object.keys(packageJsonDeps))
            // Ok, dep found
        } else if (standardLib.includes(splitPath(importInfo.from)[0]) || importInfo.from.startsWith('node:')) {
            // Ok, standard lib dep found
        } else if (packageJsonAliases[pathSegments[0]]) {
            // package.json alias found
            const aliasedSegments = splitPath(packageJsonAliases[pathSegments[0]])
            findAndMarkImport(file, ['.', ...aliasedSegments, ...pathSegments.slice(1)], importInfo)
        } else if (resolvedPaths.length > 0) {
            // jsconfig aliases found. Try each and stop when first found.
            for (const resolved of resolvedPaths) {
                const segments = [...baseUrl, ...resolved]
                if (findAndMarkImport(file, segments, importInfo)) {
                    break;
                }
            }

        } else if (baseUrl.length > 0) {
            // Add ./{baseUrl} to the segments and start relative search
            findAndMarkImport(file, ['.', ...baseUrl, ...pathSegments], importInfo)
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
                const pathSegments = splitPath(importInfo.from);

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
