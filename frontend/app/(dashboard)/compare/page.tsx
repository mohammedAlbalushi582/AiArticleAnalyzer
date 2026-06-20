"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, GitCompareArrows, Loader2 } from "lucide-react";

import {
  apiFetch,
  type ArticleListItem,
  type ComparisonListItem,
  type ComparisonReport,
  type PaginatedResponse,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const MAX_SELECT = 10;

export default function ComparePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [running, setRunning] = useState(false);

  const { data: articles, isLoading: loadingArticles } = useQuery({
    queryKey: ["articles", "compare-pick"],
    queryFn: () => apiFetch<PaginatedResponse<ArticleListItem>>("/articles/?page=1"),
  });

  const { data: reports, isLoading: loadingReports } = useQuery({
    queryKey: ["comparisons"],
    queryFn: () => apiFetch<PaginatedResponse<ComparisonListItem>>("/comparisons/"),
  });

  function toggle(id: number) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SELECT) {
        toast.error(`You can compare at most ${MAX_SELECT} articles.`);
        return prev;
      }
      return [...prev, id];
    });
  }

  async function runComparison() {
    if (selected.length < 2) return;
    setRunning(true);
    try {
      const report = await apiFetch<ComparisonReport>("/comparisons/", {
        method: "POST",
        body: JSON.stringify({ article_ids: selected }),
      });
      toast.success("Comparison complete");
      router.push(`/compare/${report.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Comparison failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Contradiction Detector</h1>
        <p className="text-muted-foreground">
          Select 2–{MAX_SELECT} articles on the same topic. The AI finds where the authors directly
          contradict each other, with verified side-by-side quotes.
        </p>
      </div>

      {/* Selection */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Pick articles to compare</h2>
          <Button onClick={runComparison} disabled={selected.length < 2 || running}>
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <GitCompareArrows className="mr-2 h-4 w-4" />
                Compare {selected.length > 0 ? `${selected.length} ` : ""}articles
              </>
            )}
          </Button>
        </div>

        {running && (
          <p className="text-sm text-muted-foreground mb-4">
            Running a two-pass analysis — this can take up to a minute for longer articles.
          </p>
        )}

        {loadingArticles ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : articles && articles.results.length >= 2 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {articles.results.map((article) => {
              const isSelected = selected.includes(article.id);
              return (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => toggle(article.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-4 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input"
                    )}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium line-clamp-1">{article.title}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{article.summary}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <p className="font-medium">You need at least 2 articles</p>
              <p className="text-muted-foreground mb-4">
                Analyze a few articles on the same topic first, then come back to compare them.
              </p>
              <Link href="/new">
                <Button>Analyze an Article</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Past reports */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Past comparisons</h2>
        {loadingReports ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : reports && reports.results.length > 0 ? (
          <div className="space-y-3">
            {reports.results.map((report) => (
              <Link key={report.id} href={`/compare/${report.id}`}>
                <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <CardDescription>
                      {report.article_count} articles · {new Date(report.created_at).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Badge variant={report.contradiction_count > 0 ? "destructive" : "secondary"}>
                      {report.contradiction_count} contradiction
                      {report.contradiction_count === 1 ? "" : "s"}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No comparisons yet.</p>
        )}
      </div>
    </div>
  );
}
