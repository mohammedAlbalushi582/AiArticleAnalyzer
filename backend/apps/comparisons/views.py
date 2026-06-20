from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from apps.articles.models import Article
from apps.articles.views import get_owner_filter, get_session_key
from core.exceptions import ApplicationError

from .models import ContradictionReport
from .serializers import (
    ComparisonCreateSerializer,
    ComparisonListSerializer,
    ComparisonSerializer,
)
from .services import detect_contradictions


class ComparisonViewSet(ModelViewSet):
    permission_classes = (AllowAny,)
    serializer_class = ComparisonSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        return (
            ContradictionReport.objects.filter(**get_owner_filter(self.request))
            .prefetch_related("articles")
        )

    def get_serializer_class(self):
        if self.action == "list":
            return ComparisonListSerializer
        return ComparisonSerializer

    def create(self, request, *args, **kwargs):
        serializer = ComparisonCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        article_ids = serializer.validated_data["article_ids"]

        # Only let users compare articles they own (or their anonymous session's).
        articles = list(
            Article.objects.filter(id__in=article_ids, **get_owner_filter(request))
        )
        if len(articles) != len(article_ids):
            raise ApplicationError(
                "ERR_ARTICLE_NOT_FOUND",
                "One or more selected articles were not found.",
                404,
            )

        user = request.user if request.user.is_authenticated else None
        session_key = get_session_key(request) if not user else None

        title = serializer.validated_data.get("title", "").strip()
        if not title:
            title = f"Comparison of {len(articles)} articles"

        report = ContradictionReport.objects.create(
            user=user,
            session_key=session_key,
            title=title,
        )
        report.articles.set(articles)

        detect_contradictions(report)

        return Response(
            ComparisonSerializer(report).data,
            status=status.HTTP_201_CREATED,
        )
