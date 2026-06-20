import logging

from core.ai.gemini import GeminiAnalyzer
from core.scraper.extract import extract_article

from .models import Article

logger = logging.getLogger(__name__)


def analyze_article(user=None, session_key=None, url: str = "", text: str = "") -> Article:
    if url:
        title, raw_text = extract_article(url)
    else:
        raw_text = text
        title = text[:80].split("\n")[0] or "Untitled"

    analyzer = GeminiAnalyzer()
    result = analyzer.analyze(raw_text)

    article = Article.objects.create(
        user=user,
        session_key=session_key,
        source_url=url or None,
        title=result.get("title", title),
        raw_text=raw_text,
        summary=result["summary"],
        key_points=result["key_points"],
        tags=result["tags"],
    )

    owner = f"user {user.id}" if user else f"session {session_key}"
    logger.info("Article %s analyzed for %s", article.id, owner)
    return article
