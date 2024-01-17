import fs from 'node:fs';
import path from "node:path"

export type SourceFile = {
  type: "file"
  name: string
  content: string
}

export type Directory = {
  type: "directory"
  name: string
  children: (SourceFile|Directory)[]
}

export const readDir = async (dir: string, extensions: string[], ignore: string[]): Promise<(SourceFile|Directory)[]> => {
  const cwd = process.cwd()
  const rootPath = path.join(cwd, dir)
  const files = await fs.promises.readdir(rootPath)

  const results = await Promise.all(files.filter(
    file => !ignore.includes(file)
  ).map(async file => {
    const filePath = path.join(dir, file)
    const stats = await fs.promises.stat(filePath)

    if (stats.isDirectory()) {
      return {
        type: "directory",
        name: file,
        children: await readDir(filePath, extensions, ignore)
      } as Directory

    } else if (file.match(new RegExp(`\\.(${extensions.join("|")})$`))) {
      return {
        type: "file",
        name: file,
        content: await fs.promises.readFile(filePath, "utf-8")
      } as SourceFile

    } else {
      return null
    }
  }))

  return results.filter(Boolean) as (SourceFile|Directory)[]
}
