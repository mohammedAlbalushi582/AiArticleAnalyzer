from django.conf import settings
from django.db import models

from apps.articles.models import Article


class ContradictionReport(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="comparisons",
        null=True,
        blank=True,
    )
    session_key = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    title = models.CharField(max_length=500)
    articles = models.ManyToManyField(Article, related_name="comparisons")
    # Structured detection output: {contradictions: [...], article_count, candidate_count, confirmed_count}
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title
