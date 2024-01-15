import { reposRouter } from "./routers/repos";
import { exampleRouter } from "./routers/example";
import { createTRPCRouter } from "./utils";

export const appRouter = createTRPCRouter({
  example: exampleRouter,
  repos: reposRouter,
});

export type AppRouter = typeof appRouter;
