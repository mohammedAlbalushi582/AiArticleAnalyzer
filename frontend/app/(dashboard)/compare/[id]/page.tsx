"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, CheckCircle2, Trash2 } from "lucide-react";

import {
  apiFetch,
  type ComparisonReport,
  type Contradiction,
  type Severity,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const SEVERITY_VARIANT: Record<Severity, "destructive" | "default" | "secondary"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

function ContradictionCard({ c }: { c: Contradiction }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-muted-foreground shrink-0" />
            {c.topic}
          </CardTitle>
          <Badge variant={SEVERITY_VARIANT[c.severity]} className="shrink-0 capitalize">
            {c.severity}
            {c.severity_score ? ` · ${c.severity_score}/5` : ""}
          </Badge>
        </div>
        {c.explanation && (
          <p className="text-sm text-muted-foreground pt-1">{c.explanation}</p>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {c.positions.map((p, i) => (
            <div key={i} className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {p.article_title}
              </p>
              {p.stance && <p className="mt-1 text-sm font-medium">{p.stance}</p>}
              <blockquote className="mt-2 border-l-2 border-primary/50 pl-3 text-sm italic text-foreground/80">
                “{p.quote}”
              </blockquote>
            </div>
          ))}
        </div>
        {c.verification_reason && (
          <p className="mt-3 text-xs text-muted-foreground">
            <span className="font-medium">Verification:</span> {c.verification_reason}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ComparisonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: report, isLoading } = useQuery({
    queryKey: ["comparison", id],
    queryFn: () => apiFetch<ComparisonReport>(`/comparisons/${id}/`),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/comparisons/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Comparison deleted");
      router.push("/compare");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Delete failed"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-16">
        <p className="text-lg font-medium">Comparison not found</p>
        <Link href="/compare">
          <Button variant="outline" className="mt-4">
            Back to comparisons
          </Button>
        </Link>
      </div>
    );
  }

  const contradictions = report.result?.contradictions ?? [];

  return (
    <div>
      <Link href="/compare" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to comparisons
      </Link>

      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-3xl font-bold">{report.title}</h1>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => deleteMutation.mutate()}
          disabled={deleteMutation.isPending}
          title="Delete comparison"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {report.articles.map((a) => (
          <Badge key={a.id} variant="outline">
            {a.title}
          </Badge>
        ))}
      </div>

      {contradictions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No direct contradictions found</p>
            <p className="text-muted-foreground">
              The AI did not find any verifiable, direct contradictions between these articles.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Found <span className="font-semibold text-foreground">{contradictions.length}</span> verified
            contradiction{contradictions.length === 1 ? "" : "s"} across {report.result.article_count} articles.
          </p>
          <div className="space-y-5">
            {contradictions.map((c, i) => (
              <ContradictionCard key={i} c={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
