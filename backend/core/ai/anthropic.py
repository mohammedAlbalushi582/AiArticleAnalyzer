import json
import logging

import anthropic
from django.conf import settings

from core.exceptions import AnalysisFailed

from .base import AnalysisResult, Analyzer

logger = logging.getLogger(__name__)

CHAT_SYSTEM_PROMPT = """You are a helpful assistant that answers questions about a specific article. \
The article content is provided below. Answer the user's questions based on the article — explain terms, \
clarify concepts, discuss implications, and provide context. Keep responses concise and relevant. \
If the question is unrelated to the article, politely redirect the user.

---
{article_context}
---"""

ANALYSIS_PROMPT = """You are an expert article analyzer. Analyze the following article and return ONLY a valid JSON object with this exact shape:
{
  "title": "A concise, descriptive title for the article",
  "summary": "3-5 sentence summary",
  "key_points": ["point 1", "point 2", ...],
  "tags": ["topic1", "topic2", ...]
}

Rules:
- The summary should be 3-5 sentences capturing the main argument.
- Include 5-8 key points as concise bullet strings.
- Include 3-6 relevant topic tags (lowercase).
- Do not include any text outside the JSON.

Article:
"""


class AnthropicAnalyzer(Analyzer):
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    def analyze(self, text: str) -> AnalysisResult:
        # Truncate very long articles to stay within token limits
        truncated = text[:50000] if len(text) > 50000 else text

        try:
            message = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                messages=[
                    {"role": "user", "content": ANALYSIS_PROMPT + truncated},
                ],
            )
        except anthropic.RateLimitError:
            logger.warning("Anthropic rate limit hit")
            raise AnalysisFailed("Rate limit reached. Please try again shortly.")
        except anthropic.APIError as e:
            logger.error("Anthropic API error: %s", e)
            raise AnalysisFailed()

        try:
            raw = message.content[0].text
            # Strip markdown code fences if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                # Remove opening fence (```json or ```)
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            result = json.loads(cleaned)
        except (json.JSONDecodeError, IndexError, KeyError) as e:
            logger.error("Failed to parse AI response: %s — raw: %s", e, raw[:500])
            raise AnalysisFailed("Failed to parse analysis results.")

        # Validate shape
        if not all(k in result for k in ("summary", "key_points", "tags")):
            raise AnalysisFailed("Incomplete analysis results from AI.")

        return AnalysisResult(
            title=result.get("title", "Untitled"),
            summary=result["summary"],
            key_points=result["key_points"],
            tags=result["tags"],
        )

    def chat(self, system_prompt: str, messages: list[dict]) -> str:
        system = CHAT_SYSTEM_PROMPT.format(article_context=system_prompt)

        try:
            message = self.client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                system=system,
                messages=messages,
            )
        except anthropic.RateLimitError:
            logger.warning("Anthropic rate limit hit during chat")
            raise AnalysisFailed("Rate limit reached. Please try again shortly.")
        except anthropic.APIError as e:
            logger.error("Anthropic API error during chat: %s", e)
            raise AnalysisFailed("Failed to get a response from AI.")

        return message.content[0].text
