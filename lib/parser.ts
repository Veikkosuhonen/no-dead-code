import { Directory, SourceFile, readRepo } from "./fileStore.ts";
import { parse, ParseResult } from "@babel/parser";
import { File } from "@babel/types";

export type ImportInfo = {
    as: string
    from: string
}

export type ModuleInfo = {
    exports: string[]
    unusedExports: string[]
    imports: ImportInfo[]
}

export type ParsedFile = {
  type: "file"
  name: string
  content: string
  parent?: ParsedDirectory
  ast: ParseResult<File>
  moduleInfo?: ModuleInfo
}

export type ParsedDirectory = {
  type: "directory"
  name: string
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
export const parseRepo = async (repoUrl: string, extensions: string[]): Promise<(ParsedFile|ParsedDirectory)[]> => {
  const files = await readRepo(repoUrl, extensions)

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

  return files.map(transform)
}