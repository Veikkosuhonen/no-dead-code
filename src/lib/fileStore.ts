import fs from 'node:fs';
import path from "node:path"

export type SourceFile = {
  type: "file"
  name: string
  path: string
  content: string
}

export type Directory = {
  type: "directory"
  name: string
  path: string
  children: (SourceFile|Directory)[]
}

export const readDir = async (dir: string, extensions: string[], ignore: string[]): Promise<Directory> => {
  const cwd = process.cwd()
  const rootPath = path.join(cwd, dir)
  const files = await fs.promises.readdir(rootPath)

  const results = await Promise.all(files.filter(
    file => !ignore.includes(file)
  ).map(async (file: string): Promise<Directory|SourceFile|null> => {
    const filePath = path.join(dir, file)
    const stats = await fs.promises.stat(filePath)

    if (stats.isDirectory()) {
      return {
        type: "directory",
        name: file,
        path: filePath,
        children: (await readDir(filePath, extensions, ignore)).children
      }

    } else if (file.match(new RegExp(`\\.(${extensions.join("|")})$`))) {
      return {
        type: "file",
        name: file,
        path: filePath,
        content: await fs.promises.readFile(filePath, "utf-8")
      }

    } else {
      return null
    }
  }))

  const rootDirectory: Directory = {
    type: "directory",
    name: dir,
    path: rootPath,
    children: results.filter(Boolean)
  }

  console.log(rootDirectory.children.map(child => child.path))

  return rootDirectory
}
