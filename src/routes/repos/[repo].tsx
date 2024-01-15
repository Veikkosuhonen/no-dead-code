import { useParams } from "@solidjs/router";

export default function Repo() {
  const params = useParams()

  return (
    <div>
      <h1>{params.repo}</h1>
    </div>
  );
}
