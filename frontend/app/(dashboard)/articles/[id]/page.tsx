"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Globe, Highlighter, Lock, MessageSquare, Trash2 } from "lucide-react";
import Link from "next/link";

import { apiFetch, type Article } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  HighlightableText,
  HighlightsSidebar,
} from "@/components/features/highlightable-text";
import { ArticleChat } from "@/components/features/article-chat";

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: article, isLoading } = useQuery({
    queryKey: ["article", id],
    queryFn: async () => {
      try {
        return await apiFetch<Article>(`/articles/${id}/`);
      } catch {
        // Fallback to public endpoint
        return await apiFetch<Article>(`/articles/public/${id}/`);
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/articles/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      toast.success("Article deleted");
      router.push("/articles");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    },
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: () =>
      apiFetch<Article>(`/articles/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ is_public: !article?.is_public }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["article", id], data);
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      queryClient.invalidateQueries({ queryKey: ["public-articles"] });
      toast.success(data.is_public ? "Article is now public" : "Article is now private");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update visibility");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!article) {
    return <p className="text-muted-foreground">Article not found.</p>;
  }

  const isOwner = article.is_owner;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link
          href={isOwner ? "/articles" : "/explore"}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {isOwner ? "Back to articles" : "Back to explore"}
        </Link>

        <div className="flex items-center gap-2">
          {isOwner && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleVisibilityMutation.mutate()}
                disabled={toggleVisibilityMutation.isPending}
              >
                {article.is_public ? (
                  <>
                    <Globe className="h-4 w-4 mr-2" />
                    Public
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Private
                  </>
                )}
              </Button>

              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Delete article?</DialogTitle>
                    <DialogDescription>
                      This will permanently delete this article and its highlights. This
                      action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                      variant="destructive"
                      onClick={() => deleteMutation.mutate()}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? "Deleting..." : "Delete"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 break-words">{article.title}</h1>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {!isOwner && <span>by {article.author_name}</span>}
          <span>{new Date(article.created_at).toLocaleDateString()}</span>
          {article.source_url && (
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Source
            </a>
          )}
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {article.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
        <Highlighter className="h-4 w-4" />
        <span>Select any text below and click a color to highlight it.</span>
      </div>

      <Tabs defaultValue="summary" className="space-y-6">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="key-points">Key Points</TabsTrigger>
          <TabsTrigger value="original">Original Text</TabsTrigger>
          <TabsTrigger value="highlights">Highlights</TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Ask AI
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <HighlightableText
                articleId={article.id}
                text={article.summary}
                source="summary"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="key-points">
          <Card>
            <CardHeader>
              <CardTitle>Key Points</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {article.key_points.map((point, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <HighlightableText
                        articleId={article.id}
                        text={point}
                        source="key_points"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="original">
          <Card>
            <CardHeader>
              <CardTitle>Original Text</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <HighlightableText
                articleId={article.id}
                text={article.raw_text}
                source="original"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="highlights">
          <Card>
            <CardHeader>
              <CardTitle>All Highlights</CardTitle>
              <CardDescription>
                {isOwner
                  ? "Your saved highlights across all sections of this article."
                  : "Highlights on this article."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <HighlightsSidebar articleId={article.id} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card>
            <CardHeader>
              <CardTitle>Ask AI</CardTitle>
              <CardDescription>
                Ask questions about this article and get AI-powered answers.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ArticleChat articleId={article.id} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
