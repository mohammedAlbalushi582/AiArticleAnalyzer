from rest_framework import serializers

from .models import ContradictionReport


class ComparisonArticleSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    title = serializers.CharField()


class ComparisonSerializer(serializers.ModelSerializer):
    articles = ComparisonArticleSerializer(many=True, read_only=True)

    class Meta:
        model = ContradictionReport
        fields = ("id", "title", "articles", "result", "created_at")
        read_only_fields = fields


class ComparisonListSerializer(serializers.ModelSerializer):
    article_count = serializers.SerializerMethodField()
    contradiction_count = serializers.SerializerMethodField()

    class Meta:
        model = ContradictionReport
        fields = ("id", "title", "article_count", "contradiction_count", "created_at")
        read_only_fields = fields

    def get_article_count(self, obj):
        return obj.articles.count()

    def get_contradiction_count(self, obj):
        return len(obj.result.get("contradictions", [])) if obj.result else 0


class ComparisonCreateSerializer(serializers.Serializer):
    article_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
    )
    title = serializers.CharField(required=False, allow_blank=True, max_length=500)

    def validate_article_ids(self, value):
        unique = list(dict.fromkeys(value))  # de-dupe, preserve order
        if len(unique) < 2:
            raise serializers.ValidationError("Select at least 2 articles to compare.")
        if len(unique) > 10:
            raise serializers.ValidationError("Compare at most 10 articles at a time.")
        return unique
