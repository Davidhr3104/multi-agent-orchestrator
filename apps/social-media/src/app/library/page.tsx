import { LibraryDesk } from "@/components/library-desk";
import { listAssets } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const assets = await listAssets();
  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold text-foreground">Library</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Files and prompts for this workspace. Mark an asset approved by the brand before it can be attached from a post. Other workspaces do not see this library.
        </p>
      </header>
      <LibraryDesk assets={assets} />
    </>
  );
}
