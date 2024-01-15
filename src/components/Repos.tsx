import { A, createAsync } from "@solidjs/router"
import { For } from "solid-js"
import { api } from "../lib/api"

export default function Repos() {
    const clonedRepos = createAsync(async () => {
        const res = await api.repos.list.query()
        return res
      })

    return (
        <section>
        <h1 class="font-bold mt-32 mb-4">Cloned Repos</h1>
        <div class="flex gap-2 flex-wrap">
        <For each={clonedRepos()} fallback={<div>Loading...</div>}>
          {(repo) => (
            <A href={`/repos/${repo.name}`} class="border border-stone-700 bg-stone-900 p-4 rounded-md hover:border-amber-400 transition-colors duration-100 ease-in-out">
              <h2 class="font-bold">{repo.name}</h2>
              <p class="text-stone-400">{repo.url}</p>
            </A>
          )}
        </For>
      </div>
      </section>
    )
}