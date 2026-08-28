import { Suspense } from "react";
import { AndonBoard } from "../../andon-board";

function LineBoard({ uuid }: { uuid: string }) {
  return <AndonBoard lineUuid={uuid} showGantt />;
}

export default async function LinePage({ params }: PageProps<"/lines/[uuid]">) {
  const { uuid } = await params;
  return (
    <Suspense>
      <LineBoard uuid={uuid} />
    </Suspense>
  );
}
