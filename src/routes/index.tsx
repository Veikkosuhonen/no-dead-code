import { RouteSectionProps, createAsync } from "@solidjs/router";
import { createSignal } from "solid-js";
import New from "../components/New";
import Repos from "../components/Repos";
import { api } from "../lib/api";

export default function Home(props: RouteSectionProps) {

  return (
    <main class="container mx-auto my-16">
      <New />
      <Repos />
    </main>
  );
}
