import { Directory, ProjectFile, SourceFile, readDir } from "./fileStore.js";
import { parse, ParseResult } from "@babel/parser";
import { File } from "@babel/types";

export type ConfigObject = {
  type: "config",
  config: any
}

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
  configs: ConfigObject[]
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

  const transform = (file: ProjectFile): ParsedFile|ParsedDirectory|ConfigObject => {
    if (file.type === "file") {
      return toParsedFile(file)
    } else if (file.type === "config") {
      return {
        type: "config",
        config: file.config
      }
    } else {
      const allChildren = file.children.map(transform)
      const configs = allChildren.filter(f => f.type === "config") as ConfigObject[]
      const children = allChildren.filter(f => f.type !== "config") as (ParsedFile|ParsedFile)[]

      // console.log(configs)

      const parsedDirectory = {
        ...file,
        children,
        configs,
      }
    
      parsedDirectory.children.forEach(child => child.parent = parsedDirectory)
      return parsedDirectory
    }
  }

  return transform(root) as ParsedDirectory
}
