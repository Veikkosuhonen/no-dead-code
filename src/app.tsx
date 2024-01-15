// @refresh reload
import { MetaProvider, Title } from "@solidjs/meta";
import { A, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start";
import { Suspense } from "solid-js";
import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <MetaProvider>
          <Title>JS Project Analyser</Title>
          <nav class="border-b border-stone-800 p-4">
            <ul>
              <li>
                <A class="font-bold hover:text-amber-300" href="/">JS Project Analyser</A>
              </li>
            </ul>
          </nav>
          <main class="py-16">
            <Suspense>{props.children}</Suspense>
          </main>
        </MetaProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
