import logging

from apps.articles.models import Article
from core.ai.gemini import GeminiAnalyzer

from .models import ChatMessage

logger = logging.getLogger(__name__)


def build_article_context(article: Article) -> str:
    key_points = "\n".join(f"- {kp}" for kp in article.key_points)
    raw_text = article.raw_text[:10000] if len(article.raw_text) > 10000 else article.raw_text

    return (
        f"Title: {article.title}\n\n"
        f"Summary:\n{article.summary}\n\n"
        f"Key Points:\n{key_points}\n\n"
        f"Full Article Text:\n{raw_text}"
    )


def send_chat_message(
    article: Article,
    user_message: str,
    user=None,
    session_key=None,
) -> ChatMessage:
    ownership = {}
    if user and user.is_authenticated:
        ownership["user"] = user
    elif session_key:
        ownership["session_key"] = session_key

    # Save user message
    ChatMessage.objects.create(
        article=article,
        role="user",
        content=user_message,
        **ownership,
    )

    # Build conversation history
    history = ChatMessage.objects.filter(article=article, **ownership)
    messages = [{"role": msg.role, "content": msg.content} for msg in history]

    # Build article context and call AI
    system_prompt = build_article_context(article)
    analyzer = GeminiAnalyzer()
    assistant_content = analyzer.chat(system_prompt=system_prompt, messages=messages)

    # Save and return assistant message
    assistant_msg = ChatMessage.objects.create(
        article=article,
        role="assistant",
        content=assistant_content,
        **ownership,
    )
    return assistant_msg
