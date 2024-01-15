import fs from 'node:fs';
import git from "isomorphic-git"
import http from "isomorphic-git/http/node"
import path from "node:path"

const getCwd = () => {
  /* @ts-ignore */
  return Deno.cwd() as string;
}

/**
 * Clones a git repository into a temporary directory
 * @param url 
 * @returns 
 */
export const clone = async (url: string) => {
  const dir = path.join(getCwd(), "tmp", "clones", url.replace(/\//g, "_"))
  await fs.promises.mkdir(dir, { recursive: true })
  await git.clone({
    fs,
    http,
    dir,
    url,
    singleBranch: true,
    depth: 1,
  })
  return dir
}

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

export const getRepoPath = (repoUrl: string) => {
  return path.join(getCwd(), "tmp", "clones", repoUrl.replace(/\//g, "_"))
}

/**
 * Read files from a repository
 */
export const readRepo = async (repoUrl: string, extensions: string[]): Promise<(SourceFile|Directory)[]> => {
  const dir = getRepoPath(repoUrl)
  return await readDir(dir, extensions)
}

const readDir = async (dir: string, extensions: string[]): Promise<(SourceFile|Directory)[]> => {
  const files = await fs.promises.readdir(dir)

  const results = await Promise.all(files.map(async file => {
    const filePath = path.join(dir, file)
    const stats = await fs.promises.stat(filePath)

    if (stats.isDirectory()) {
      return {
        type: "directory",
        name: file,
        children: await readDir(filePath, extensions)
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

/**
 * Checks if a git repository exists at a given path
 */
export const exists = async (path: string) => {
  try {
    await git.resolveRef({ fs, dir: path, ref: "HEAD" })
    return true
  } catch (e) {
    return false
  }
}

/**
 * Get the names of all cloned repositories
 */
export const getClones = async () => {
  const dir = path.join(getCwd(), "tmp", "clones")
  const files = await fs.promises.readdir(dir)
  const results = await Promise.all(files.map(async file => {
    const filePath = path.join(dir, file)
    const stats = await fs.promises.stat(filePath)
    if (stats.isDirectory()) {
      return file.replace(/_/g, "/")
    }
    return null
  }))
  return results.filter(Boolean) as string[]
}
