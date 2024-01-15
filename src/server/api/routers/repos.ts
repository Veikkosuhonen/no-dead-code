import { wrap } from "@decs/typeschema";
import { string } from "valibot";
import { createTRPCRouter, publicProcedure } from "../utils";
import { clone, exists, getClones, readRepo } from "../../../../lib/fileStore";
import { parseRepo } from "../../../../lib/parser";

export const reposRouter = createTRPCRouter({
  list: publicProcedure.query(async () => {
    const repos = await getClones();

    return repos.map(repo => ({
      url: repo,
      name: repo.split("/").pop() || "",
    }))
  }),
  clone: publicProcedure.input(wrap(string())).query(async ({ input }) => {
    const url = input;

    await clone(url);

    const result = await readRepo(url, ['js', 'ts', 'tsx', 'jsx']);

    return result
  }),
  parse: publicProcedure.input(wrap(string())).query(async ({ input }) => {
    const url = input;

    // If the repo doesn't exist, wait for it to be cloned
    if (!await exists(url)) {
      await clone(url);
    }
  
    const result = await parseRepo(url, ['js', 'ts', 'tsx', 'jsx']);

    return result
  }),
});
