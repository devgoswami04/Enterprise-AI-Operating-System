"use client";

import { FormEvent, useMemo, useState } from "react";
import { FileUp, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DocumentRecord, SearchResult } from "@/lib/types";

export function DocumentUploader({ initialDocuments }: { initialDocuments: DocumentRecord[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [query, setQuery] = useState("revenue growth risks");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState("");

  const totalChunks = useMemo(
    () => documents.reduce((sum, document) => sum + document.chunkCount, 0),
    [documents],
  );

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setStatus("Indexing document...");
    const response = await fetch("/api/documents", { method: "POST", body: formData });
    const data = await response.json();

    if (!response.ok) {
      setStatus(data.error ?? "Upload failed");
      return;
    }

    setDocuments((current) => [data.document, ...current]);
    setStatus("Document indexed with deterministic embeddings.");
    form.reset();
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Searching indexed knowledge...");
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();
    setResults(data.results ?? []);
    setStatus(`${data.results?.length ?? 0} passages retrieved.`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileUp className="h-4 w-4 text-cyan-200" />
            Upload Knowledge
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <form onSubmit={upload} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="file">PDF, text, markdown, CSV, or JSON</Label>
              <Input id="file" name="file" type="file" className="bg-zinc-950" />
            </div>
            <Button className="justify-self-start gap-2">
              <FileUp className="h-4 w-4" />
              Index document
            </Button>
          </form>
          <div className="rounded-md border border-white/10 bg-zinc-950/60 p-3 text-sm text-zinc-400">
            {status || "Uploads are chunked, embedded, and stored through the pgvector-ready interface."}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-white/10 p-3">
              <p className="text-xs text-zinc-500">Documents</p>
              <p className="mt-1 text-xl font-semibold text-white">{documents.length}</p>
            </div>
            <div className="rounded-md border border-white/10 p-3">
              <p className="text-xs text-zinc-500">Chunks</p>
              <p className="mt-1 text-xl font-semibold text-white">{totalChunks}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-4 w-4 text-cyan-200" />
            Semantic Search
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <form onSubmit={search} className="flex gap-2">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="bg-zinc-950" />
            <Button size="icon" aria-label="Search">
              <Search className="h-4 w-4" />
            </Button>
          </form>
          <ScrollArea className="h-[390px]">
            <div className="grid gap-3 pr-4">
              {(results.length ? results : []).map((result) => (
                <div key={result.chunk.id} className="rounded-md border border-white/10 bg-zinc-950/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-white">{result.document.title}</p>
                    <Badge variant="outline" className="border-cyan-300/30 text-cyan-100">
                      {result.score.toFixed(3)}
                    </Badge>
                  </div>
                  <p className="text-sm leading-6 text-zinc-400">{result.chunk.content}</p>
                </div>
              ))}
              {!results.length ? (
                <div className="rounded-md border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">
                  Run a search to inspect retrieved chunks and scores.
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
