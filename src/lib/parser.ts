import { Directory, SourceFile, readDir } from "./fileStore.js";
import { parse, ParseResult } from "@babel/parser";
import { File } from "@babel/types";

export type ImportInfo = {
    as: string
    from: string
    type?: "esm"|"cjs" 
}

export type ModuleInfo = {
    exports: string[]
    unusedExports: string[]
    imports: ImportInfo[]
}

export type ParsedFile = {
  type: "file"
  name: string
  path: string
  content: string
  parent?: ParsedDirectory
  ast: ParseResult<File>
  moduleInfo?: ModuleInfo
}

export type ParsedDirectory = {
  type: "directory"
  name: string
  path: string
  parent?: ParsedDirectory
  children: (ParsedFile|ParsedDirectory)[]
}

const parseFile = (file: SourceFile) => {
  const ast = parse(file.content, {
    sourceType: "module",
    plugins: ["jsx", "typescript", "classProperties", "decorators-legacy", "dynamicImport", "objectRestSpread", "optionalChaining", "nullishCoalescingOperator"]
  });

  return ast;
}

const toParsedFile = (file: SourceFile): ParsedFile => {
  return {
    ...file,
    ast: parseFile(file)
  }
}

/**
 * Parse files from a repository
 */
export const parseDirectory = async ({ 
  path, extensions, ignore
}: {
  path: string
  extensions: string[]
  ignore: string[]
}): Promise<ParsedDirectory> => {
  const root = await readDir(path, extensions, ignore)

  const transform = (file: SourceFile|Directory): ParsedFile|ParsedDirectory => {
    if (file.type === "file") {
      return toParsedFile(file)
    } else {
      const parsedDirectory = {
        ...file,
        children: file.children.map(transform)
      }
      parsedDirectory.children.forEach(child => child.parent = parsedDirectory)
      return parsedDirectory
    }
  }

  return transform(root) as ParsedDirectory
}
