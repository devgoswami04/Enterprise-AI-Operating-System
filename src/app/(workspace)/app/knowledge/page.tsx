import { DocumentUploader } from "@/components/knowledge/document-uploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth";
import { listDocuments } from "@/lib/data/store";

export default async function KnowledgePage() {
  const session = await requireSession();
  const documents = listDocuments(session.organizationId);

  return (
    <div className="grid gap-6">
      <section>
        <h1 className="text-3xl font-semibold tracking-normal text-white">Knowledge Layer</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
          Upload source material, index it into chunks, search semantically, and keep generated answers grounded with citations.
        </p>
      </section>
      <DocumentUploader initialDocuments={documents} />
      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-base">Indexed Sources</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {documents.map((document) => (
            <div key={document.id} className="rounded-md border border-white/10 bg-zinc-950/60 p-4">
              <p className="text-sm font-medium text-white">{document.title}</p>
              <p className="mt-2 text-xs leading-5 text-zinc-500">{document.summary}</p>
              <p className="mt-3 text-xs text-cyan-100">{document.chunkCount} chunks - {document.sourceType}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
