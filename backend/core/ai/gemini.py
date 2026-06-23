import json
import logging
import time

from django.conf import settings
from google import genai
from google.genai import errors, types

from core.exceptions import AnalysisFailed

from .base import AnalysisResult, Analyzer

logger = logging.getLogger(__name__)

MODEL = "gemini-3.5-flash"

# Google returns these when the model is transiently overloaded/unavailable.
# They usually clear within a second or two, so retry with backoff instead of
# failing the user's request on the first hiccup.
TRANSIENT_CODES = {429, 500, 502, 503, 504}
MAX_RETRIES = 3

CHAT_SYSTEM_PROMPT = """You are a helpful assistant that answers questions about a specific article. \
The article content is provided below. Answer the user's questions based on the article — explain terms, \
clarify concepts, discuss implications, and provide context. Keep responses concise and relevant. \
If the question is unrelated to the article, politely redirect the user.

---
{article_context}
---"""

CONTRADICTION_FIND_PROMPT = """You are an expert research assistant. You are given several articles on the same topic, each tagged with a numeric id. Your job is to find places where the authors DIRECTLY CONTRADICT each other.

A real contradiction is a DIRECT conflict on the same point: opposing factual claims, incompatible numbers/statistics, or opposing causal claims (e.g. "X causes Y" vs "X does not cause Y"). Do NOT report differences that are merely different emphasis, different scope, different time periods, or two authors discussing unrelated aspects.

For every contradiction you find, cite AT LEAST TWO articles and copy a VERBATIM quote from each — the quote text must appear exactly, word-for-word, in that article. Never paraphrase a quote.

Severity rubric:
- "high": a direct factual or causal opposition (the claims cannot both be true).
- "medium": conflicting interpretation of the same fact or figure.
- "low": a soft tension or differing conclusion that stops short of direct opposition.

Return ONLY a valid JSON object with this exact shape:
{
  "contradictions": [
    {
      "topic": "short phrase naming the disputed point",
      "explanation": "1-2 sentences explaining why these claims conflict",
      "severity": "high|medium|low",
      "positions": [
        {"article_id": 0, "stance": "what this article claims about the point", "quote": "exact verbatim quote from that article"},
        {"article_id": 0, "stance": "...", "quote": "..."}
      ]
    }
  ]
}

If there are no genuine contradictions, return {"contradictions": []}. Do not include any text outside the JSON.

Articles:
"""

CONTRADICTION_VERIFY_PROMPT = """You are a skeptical fact-checking reviewer. Below are several articles (each with a numeric id) followed by a list of CANDIDATE contradictions found by another assistant. Your job is to decide, for each candidate, whether it is a GENUINE direct contradiction between the authors.

Be strict. Reject a candidate (is_contradiction = false) if the two positions are actually about different scopes, different time periods, different subjects, or are just differing emphasis rather than a true conflict. Only accept candidates where the cited claims genuinely cannot both be true.

For accepted candidates, assign a final severity ("high"/"medium"/"low") and an integer severity_score from 1 (mild) to 5 (severe, direct factual opposition).

Return ONLY a valid JSON object with this exact shape:
{
  "verdicts": [
    {"index": 0, "is_contradiction": true, "severity": "high", "severity_score": 5, "reason": "why it is or isn't a real contradiction"}
  ]
}

Include exactly one verdict per candidate, referencing it by its 0-based index. Do not include any text outside the JSON.

Articles:
"""

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


def _parse_json(raw: str | None) -> dict:
    """Parse a JSON object from a model response, tolerating code fences."""
    if not raw:
        raise AnalysisFailed("Empty response from AI.")
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error("Failed to parse AI JSON: %s — raw: %s", e, (raw or "")[:500])
        raise AnalysisFailed("Failed to parse AI response.")


def _render_articles(articles: list[dict], char_limit: int = 8000) -> str:
    """Render articles into the prompt body, capped per-article to bound cost."""
    blocks = []
    for a in articles:
        text = a["text"]
        if len(text) > char_limit:
            text = text[:char_limit]
        blocks.append(f'ARTICLE [id={a["id"]}] "{a["title"]}"\n{text}')
    return "\n\n---\n\n".join(blocks)


class GeminiAnalyzer(Analyzer):
    def __init__(self):
        # Cap each HTTP call so a stalled Gemini request fails fast instead of
        # hanging until gunicorn force-kills the worker (its --timeout is 120s).
        # HttpOptions.timeout is in milliseconds.
        self.client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options=types.HttpOptions(timeout=60_000),
        )

    def _generate(self, **kwargs):
        """Call generate_content, retrying transient (overload) errors."""
        for attempt in range(MAX_RETRIES):
            try:
                return self.client.models.generate_content(**kwargs)
            except errors.APIError as e:
                code = getattr(e, "code", None)
                if code in TRANSIENT_CODES and attempt < MAX_RETRIES - 1:
                    backoff = 2**attempt  # 1s, 2s
                    logger.warning(
                        "Gemini %s (transient), retrying in %ss (attempt %s/%s)",
                        code, backoff, attempt + 1, MAX_RETRIES,
                    )
                    time.sleep(backoff)
                    continue
                raise

    def analyze(self, text: str) -> AnalysisResult:
        # Truncate to reduce API costs
        truncated = text[:15000] if len(text) > 15000 else text

        try:
            message = self._generate(
                model=MODEL,
                contents=ANALYSIS_PROMPT + truncated,
                config=types.GenerateContentConfig(
                    max_output_tokens=2048,
                    response_mime_type="application/json",
                    thinking_config=types.ThinkingConfig(thinking_budget=0),
                ),
            )
        except errors.APIError as e:
            code = getattr(e, "code", None)
            if code == 429:
                logger.warning("Gemini rate limit hit")
                raise AnalysisFailed("Rate limit reached. Please try again shortly.")
            if code in TRANSIENT_CODES:
                logger.warning("Gemini overloaded (%s) after retries", code)
                raise AnalysisFailed("The AI service is busy right now. Please try again in a moment.")
            logger.error("Gemini API error: %s", e)
            raise AnalysisFailed()
        except Exception as e:
            # Network timeouts/stalls aren't APIErrors — without this they'd
            # bubble up as a 500 (or hang the worker). Surface a clean message.
            logger.error("Gemini request failed: %s", e)
            raise AnalysisFailed("AI analysis timed out. Please try again.")

        raw = message.text
        if not raw:
            logger.error("Gemini returned empty response")
            raise AnalysisFailed("Failed to parse analysis results.")

        try:
            # JSON mode returns clean JSON, but strip fences defensively.
            cleaned = raw.strip()
            if cleaned.startswith("```"):
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

        # Gemini uses "model" for the assistant role and a "parts" content shape.
        contents = [
            {
                "role": "model" if msg["role"] == "assistant" else "user",
                "parts": [{"text": msg["content"]}],
            }
            for msg in messages
        ]

        try:
            message = self._generate(
                model=MODEL,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system,
                    max_output_tokens=1024,
                ),
            )
        except errors.APIError as e:
            if getattr(e, "code", None) == 429:
                logger.warning("Gemini rate limit hit during chat")
                raise AnalysisFailed("Rate limit reached. Please try again shortly.")
            logger.error("Gemini API error during chat: %s", e)
            raise AnalysisFailed("Failed to get a response from AI.")

        return message.text or ""

    def _generate_json(self, prompt: str, max_output_tokens: int, thinking_budget: int) -> dict:
        # Thinking is enabled — contradiction detection is reasoning-heavy — but
        # bounded: thinking tokens share the output budget, so we cap thinking and
        # leave generous headroom for the JSON so it never gets truncated.
        try:
            message = self.client.models.generate_content(
                model=MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    max_output_tokens=max_output_tokens,
                    response_mime_type="application/json",
                    thinking_config=types.ThinkingConfig(thinking_budget=thinking_budget),
                ),
            )
        except errors.APIError as e:
            if getattr(e, "code", None) == 429:
                logger.warning("Gemini rate limit hit during comparison")
                raise AnalysisFailed("Rate limit reached. Please try again shortly.")
            logger.error("Gemini API error during comparison: %s", e)
            raise AnalysisFailed("Failed to compare articles.")
        return _parse_json(message.text)

    def find_contradictions(self, articles: list[dict]) -> list[dict]:
        prompt = CONTRADICTION_FIND_PROMPT + _render_articles(articles)
        result = self._generate_json(prompt, max_output_tokens=10000, thinking_budget=2048)
        contradictions = result.get("contradictions", [])
        return contradictions if isinstance(contradictions, list) else []

    def verify_contradictions(self, articles: list[dict], candidates: list[dict]) -> list[dict]:
        if not candidates:
            return []
        candidate_block = json.dumps(
            [
                {
                    "index": i,
                    "topic": c.get("topic", ""),
                    "explanation": c.get("explanation", ""),
                    "positions": [
                        {"article_id": p.get("article_id"), "quote": p.get("quote", "")}
                        for p in c.get("positions", [])
                    ],
                }
                for i, c in enumerate(candidates)
            ],
            ensure_ascii=False,
        )
        prompt = (
            CONTRADICTION_VERIFY_PROMPT
            + _render_articles(articles)
            + "\n\nCandidate contradictions:\n"
            + candidate_block
        )
        result = self._generate_json(prompt, max_output_tokens=6000, thinking_budget=1536)
        verdicts = result.get("verdicts", [])
        return verdicts if isinstance(verdicts, list) else []
