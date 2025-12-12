import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { UploadCloud, Download, Loader2, AudioLines, ChevronDown } from "lucide-react";
import { AudioSpectrum } from "@/components/AudioSpectrum";
import { PrismLogo } from "@/components/PrismLogo";

type Stem = {
  id: string;
  name: string;
  audioUrl: string;
  downloadUrl?: string;
  originalUrl?: string;
  visualizerReady: boolean;
};

type StemDescriptor = {
  url: string;
  name?: string | null;
};

type StemSummary = {
  name: string;
  url: string;
};

type HistoryEntry = {
  inputName: string;
  createdAt: string;
  cacheId?: string;
  outputUrls: string[];
  stems?: StemSummary[];
};

type HomePageProps = {
  apiRoot?: string;
  token: string;
  user: { username?: string; email?: string };
  onLogout: () => void;
};

export default function HomePage({ apiRoot = "", token, user, onLogout }: HomePageProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [stems, setStems] = useState<Stem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const normalizedRoot = useMemo(() => apiRoot.replace(/\/$/, ""), [apiRoot]);
  const inferBase = useMemo(() => (normalizedRoot ? `${normalizedRoot}/api/infer` : "/api/infer"), [normalizedRoot]);
  const allocatedBlobUrls = useRef<string[]>([]);

  const clearStemBlobs = useCallback(() => {
    allocatedBlobUrls.current.forEach((url) => URL.revokeObjectURL(url));
    allocatedBlobUrls.current = [];
  }, []);

  useEffect(() => clearStemBlobs, [clearStemBlobs]);

  const toAbsoluteUrl = useCallback(
    (url: string) => {
      if (!url) return "";
      if (/^https?:\/\//i.test(url) || url.startsWith("blob:")) return url;
      if (!normalizedRoot) return url.startsWith("/") ? url : `/${url}`;
      const prefix = normalizedRoot;
      return `${prefix}${url.startsWith("/") ? url : `/${url}`}`;
    },
    [normalizedRoot]
  );

  const handleUnauthorized = useCallback(() => {
    toast.error("Session expired, please log in again");
    onLogout();
  }, [onLogout]);

  const deriveStemName = useCallback((url: string, idx: number) => {
    const last = url.split("/").pop() || `Stem ${idx + 1}`;
    const withoutQuery = last.split("?")[0];
    const withoutExt = withoutQuery.replace(/\.[^/.]+$/, "");
    const readable = withoutExt
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim();
    return readable || `Stem ${idx + 1}`;
  }, []);

  const hydrateStem = useCallback(
    async ({ url, name }: StemDescriptor, idx: number): Promise<Stem> => {
      const absolute = toAbsoluteUrl(url);
      const resolvedName = name?.toString().trim() || deriveStemName(url, idx);
      try {
        const response = await fetch(absolute, { mode: "cors" });
        if (!response.ok) throw new Error(`Failed to fetch stem (${response.status})`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        allocatedBlobUrls.current.push(blobUrl);
        return {
          id: `${Date.now()}-${idx}`,
          name: resolvedName,
          audioUrl: blobUrl,
          downloadUrl: absolute,
          originalUrl: absolute,
          visualizerReady: true,
        };
      } catch (err) {
        console.error("Unable to cache stem locally", err);
        return {
          id: `${Date.now()}-${idx}`,
          name: resolvedName,
          audioUrl: absolute,
          downloadUrl: absolute,
          originalUrl: absolute,
          visualizerReady: false,
        };
      }
    },
    [deriveStemName, toAbsoluteUrl]
  );

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${inferBase}/results`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!res.ok) {
        throw new Error(`Unable to load history (${res.status})`);
      }

      const data: { results?: HistoryEntry[] } = await res.json();
      setHistory(data?.results ?? []);
    } catch (err: any) {
      toast.error(err?.message || "Could not fetch previous runs");
    } finally {
      setHistoryLoading(false);
    }
  }, [handleUnauthorized, inferBase, token]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    setFileUrl(URL.createObjectURL(f));
    setStems([]);
    clearStemBlobs();
  }

  async function handleProcess() {
    if (!file) {
      toast.error("Select an audio file first");
      return;
    }

    try {
      setUploading(true);
      toast("Uploading audio…");

      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch(`${inferBase}/segment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      if (!res.ok) {
        const msg = data?.message || text || `HTTP ${res.status}`;
        throw new Error(msg);
      }

      clearStemBlobs();

      const normalizeStemEntries = (entries: unknown[]): StemDescriptor[] => {
        return entries
          .map((entry) => {
            if (!entry) return null;
            if (typeof entry === "string") {
              return { url: entry };
            }
            if (typeof entry !== "object") return null;
            const source = entry as Record<string, unknown>;
            const urlCandidate =
              (source.url as string | undefined) ||
              (source.audioUrl as string | undefined) ||
              (source.downloadUrl as string | undefined) ||
              (source.href as string | undefined) ||
              (source.path as string | undefined) ||
              "";
            if (!urlCandidate) return null;
            const explicitName =
              (source.name as string | undefined) ||
              (source.label as string | undefined) ||
              (source.kind as string | undefined) ||
              (source.type as string | undefined) ||
              (source.title as string | undefined) ||
              (source.track as string | undefined) ||
              (source.part as string | undefined) ||
              null;
            return { url: urlCandidate, name: explicitName };
          })
          .filter((entry): entry is StemDescriptor => Boolean(entry?.url));
      };

      const outputsRaw = Array.isArray(data?.outputs)
        ? data.outputs
        : Array.isArray(data?.files)
          ? data.files
          : [];
      const outputs = outputsRaw.filter((url: string): url is string => typeof url === "string" && Boolean(url));

      const nameList = [data?.stemNames, data?.stem_names, data?.labels, data?.stem_labels].find(
        (value): value is string[] => Array.isArray(value)
      );

      let stemDescriptors: StemDescriptor[] = [];

      if (Array.isArray(data?.stems)) {
        stemDescriptors = normalizeStemEntries(data.stems as unknown[]);
      }

      if (!stemDescriptors.length && outputs.length) {
        stemDescriptors = outputs.map((url: string, idx: number) => ({
          url,
          name: nameList?.[idx],
        }));
      }

      if (!stemDescriptors.length) {
        toast("No stems returned by the server.");
        setStems([]);
      } else {
        const mapped: Stem[] = await Promise.all(
          stemDescriptors.map((descriptor, idx) => hydrateStem(descriptor, idx))
        );
        setStems(mapped);
      }

      fetchHistory();

      toast.success("Processing complete");
    } catch (err: any) {
      toast.error(err?.message || "Failed to process audio");
    } finally {
      setUploading(false);
    }
  }

  const displayName = user?.username || user?.email || "user";

  return (
    <div className="min-h-screen px-4 py-10 text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        {/* Top header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-1 flex-wrap items-start gap-4">
            <PrismLogo size="sm" showWordmark={false} className="hidden sm:flex" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.5em] text-sky-200">
                AudioPrism
              </p>
              <h1 className="mt-2 text-3xl font-semibold">
                Split audio into stems using <span className="text-sky-200">AudioPrism - A UNet based audio stem segmentation model</span>
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                Upload any mix (mp3, wav, m4a), download isolated stems ready for remixing, recombination or analysis.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <p>
              Signed in as <span className="font-medium text-slate-100">{displayName}</span>
            </p>
            <Button variant="outline" size="sm" className="border-white/20 bg-white/5 text-xs text-slate-100" onClick={onLogout}>
              Log out
            </Button>
          </div>
        </header>

        <div className="grid gap-8 md:grid-cols-[1.1fr_minmax(0,1.1fr)]">
          {/* Left: Upload + original spectrum */}
          <Card className="border-white/10 bg-slate-900/80 text-white">
            <CardHeader>
              <CardTitle>1. Upload your audio</CardTitle>
              <CardDescription className="text-slate-300">
                Supports mp3 / wav / m4a.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-3">
                <Label className="text-slate-200">Audio file</Label>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-white/20 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-300 hover:bg-slate-900">
                  <UploadCloud className="h-6 w-6 text-indigo-300" />
                  <div>
                    <span className="font-medium text-slate-100">
                      Click to choose a file
                    </span>{" "}
                    <span className="text-slate-400">or drag and drop</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    MP3, WAV, M4A formats supported
                  </span>
                  <Input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </label>
                {file && (
                  <p className="text-xs text-slate-400">
                    Selected: <span className="font-medium">{file.name}</span>{" "}
                    ({Math.round(file.size / 1024)} KB)
                  </p>
                )}
              </div>

              <Button
                className="w-full"
                type="button"
                disabled={!file || uploading}
                onClick={handleProcess}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  <>
                    <AudioLines className="mr-2 h-4 w-4" />
                    Run segmentation
                  </>
                )}
              </Button>

              {fileUrl && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-slate-200">
                    Original mix spectrum
                  </h3>
                  <AudioSpectrum src={fileUrl} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Stacked stems visual */}
          <Card className="border-white/10 bg-slate-900/80 text-white">
            <CardHeader>
              <CardTitle>2. Stems output</CardTitle>
              <CardDescription className="text-slate-300">
                Each stem shows its own spectrum with playback and download.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {stems.length === 0 && (
                <p className="text-sm text-slate-400">
                  No stems yet. Upload an audio file and run segmentation to see results here.
                </p>
              )}

              <div className="space-y-4">
                {stems.map((stem) => (
                  <div
                    key={stem.id}
                    className="rounded-lg border border-white/15 bg-slate-950/60 p-4"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-slate-100">
                          {stem.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          Isolated stem · downloadable
                        </p>
                      </div>
                      {stem.downloadUrl && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="border-white/30 bg-white/5 text-xs text-slate-100"
                        >
                          <a href={stem.downloadUrl} download>
                            <Download className="mr-1 h-4 w-4" />
                            Download
                          </a>
                        </Button>
                      )}
                    </div>

                    <AudioSpectrum src={stem.audioUrl} height={70} disabled={!stem.visualizerReady} />
                    {!stem.visualizerReady && (
                      <p className="mt-2 text-xs text-amber-300">Visualizer fallback in use due to fetch error.</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="text-xs text-slate-400">
              Tip: cache processed stems on your backend and reuse IDs to avoid recomputing.
            </CardFooter>
          </Card>
        </div>

        <Card className="border-white/10 bg-slate-900/80 text-white">
          <CardHeader className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>3. Previous segmentations</CardTitle>
              <CardDescription className="text-slate-300">
                Saved outputs pulled from your MongoDB document.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" className="border-white/20 bg-white/5 text-xs text-slate-100" onClick={fetchHistory} disabled={historyLoading}>
              {historyLoading ? "Refreshing…" : "Refresh"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {historyLoading && history.length === 0 && (
              <p className="text-sm text-slate-400">Loading your recent runs…</p>
            )}

            {history.length === 0 && !historyLoading && (
              <p className="text-sm text-slate-400">No stored results yet. Process an audio file to see it here.</p>
            )}

            {history.map((entry, idx) => {
              const entryStems: StemSummary[] = (entry.stems && entry.stems.length)
                ? entry.stems
                : (entry.outputUrls || []).map((url, urlIdx) => ({
                    name: deriveStemName(url, urlIdx),
                    url,
                  }));
              const entryKey = entry.cacheId || `${entry.inputName}-${idx}`;

              return (
                <div key={entryKey} className="rounded-lg border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-100">{entry.inputName || `Upload #${idx + 1}`}</p>
                      <p className="text-xs text-slate-400">{entry.createdAt}</p>
                      {entry.cacheId && (
                        <p className="text-[11px] text-slate-500">Cache ID · {entry.cacheId.slice(0, 12)}…</p>
                      )}
                    </div>
                    <span className="text-xs text-indigo-200">{entryStems.length} stems</span>
                  </div>
                  {entryStems.length ? (
                    <details className="group mt-3 overflow-hidden rounded-lg border border-white/10 bg-slate-900/40">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-100">
                        <span>Select a stem to download</span>
                        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-200 group-open:rotate-180" />
                      </summary>
                      <div className="divide-y divide-white/5">
                        {entryStems.map((stem, stemIdx) => {
                          const downloadHref = toAbsoluteUrl(stem.url);
                          return (
                            <a
                              key={`${stem.url}-${stemIdx}`}
                              href={downloadHref}
                              download
                              className="flex items-center justify-between gap-3 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-900/80"
                            >
                              <div>
                                <p className="font-semibold text-slate-100">{stem.name}</p>
                                <p className="text-xs text-slate-400">Isolated track · tap to download</p>
                              </div>
                              <Download className="h-4 w-4 text-indigo-200" />
                            </a>
                          );
                        })}
                      </div>
                    </details>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">No files stored for this run.</p>
                  )}
                </div>
              );
            })}
          </CardContent>
          <CardFooter className="text-xs text-slate-400">
            The latest items come directly from <code className="rounded bg-slate-800 px-1">/api/infer/results</code>.
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
