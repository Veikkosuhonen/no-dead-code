import { createSignal } from "solid-js"
import { api } from "../lib/api"
import { Directory, SourceFile } from "../../lib/fileStore"

export default function New() {
  
    const [url, setUrl] = createSignal("")
    const [result, setResult] = createSignal<(SourceFile|Directory)[]>()
  
    const handleSubmit = async (e: Event) => {
      e.preventDefault()
      const res = await api.repos.parse.query(url())
      setResult(res)
    }

    return (
        <div>
        <form 
        onSubmit={handleSubmit}
        class="flex flex-col gap-2 items-center"
      >
        <input 
          type="text" 
          placeholder="Enter a repo url" 
          value={url()} 
          onChange={(e) => setUrl(e.target.value)} 
          class="border border-stone-600 rounded-md p-2 bg-stone-800 text-stone-100 w-96"
        />
        <button 
          class="hover:text-amber-300 text-amber-500 hover:text-amber-50 font-bold py-2 px-4 rounded transition-colors duration-100 ease-in-out hover:bg-stone-800"
        >
          Let's go!
        </button>
      </form>
      <pre class="my-8">
        <code>{JSON.stringify(result(), null, 2)}</code>
      </pre>
    </div>
    )
}
