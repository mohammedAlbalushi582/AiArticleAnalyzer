import logging
import re

from core.ai.gemini import GeminiAnalyzer

from .models import ContradictionReport

logger = logging.getLogger(__name__)

_SEVERITY_RANK = {"high": 3, "medium": 2, "low": 1}


def _normalize(text: str) -> str:
    """Collapse whitespace and lowercase for tolerant quote matching."""
    return re.sub(r"\s+", " ", text or "").strip().lower()


def ground_quotes(candidates: list[dict], articles: list[dict]) -> list[dict]:
    """Drop any quote that does not actually appear in its cited article.

    This is the anti-hallucination guard: LLMs invent plausible quotes, so every
    position's quote must be a (whitespace/case-tolerant) substring of the cited
    article. Positions that fail are dropped; candidates left with fewer than two
    grounded positions are discarded entirely.
    """
    norm_text = {a["id"]: _normalize(a["text"]) for a in articles}
    titles = {a["id"]: a["title"] for a in articles}

    grounded = []
    for candidate in candidates:
        positions = []
        for pos in candidate.get("positions", []):
            article_id = pos.get("article_id")
            quote = (pos.get("quote") or "").strip()
            if article_id not in norm_text or not quote:
                continue
            if _normalize(quote) in norm_text[article_id]:
                positions.append(
                    {
                        "article_id": article_id,
                        "article_title": titles[article_id],
                        "stance": pos.get("stance", ""),
                        "quote": quote,
                    }
                )

        # A contradiction needs at least two grounded positions from two articles.
        distinct_articles = {p["article_id"] for p in positions}
        if len(positions) >= 2 and len(distinct_articles) >= 2:
            grounded.append(
                {
                    "topic": candidate.get("topic", "Untitled contradiction"),
                    "explanation": candidate.get("explanation", ""),
                    "severity": candidate.get("severity", "medium"),
                    "positions": positions,
                }
            )
        else:
            logger.info("Dropped ungrounded contradiction candidate: %s", candidate.get("topic"))

    return grounded


def _apply_verdicts(grounded: list[dict], verdicts: list[dict]) -> list[dict]:
    """Keep only candidates the verification pass confirmed, applying its severity."""
    by_index = {v.get("index"): v for v in verdicts if isinstance(v, dict)}
    confirmed = []
    for i, candidate in enumerate(grounded):
        verdict = by_index.get(i)
        # If the verifier omitted a verdict, be conservative and drop the candidate.
        if not verdict or not verdict.get("is_contradiction"):
            continue
        candidate["severity"] = verdict.get("severity", candidate["severity"])
        candidate["severity_score"] = verdict.get("severity_score")
        candidate["verification_reason"] = verdict.get("reason", "")
        confirmed.append(candidate)

    confirmed.sort(
        key=lambda c: (c.get("severity_score") or _SEVERITY_RANK.get(c["severity"], 0)),
        reverse=True,
    )
    return confirmed


def detect_contradictions(report: ContradictionReport) -> ContradictionReport:
    """Run the two-pass contradiction detection and store the result on the report."""
    articles = [
        {"id": a.id, "title": a.title, "text": a.raw_text}
        for a in report.articles.all()
    ]

    analyzer = GeminiAnalyzer()

    # Pass 1: surface candidates.
    candidates = analyzer.find_contradictions(articles)
    # Quote grounding: discard anything we can't trace to the source text.
    grounded = ground_quotes(candidates, articles)
    # Pass 2: adversarial verification of the grounded candidates.
    verdicts = analyzer.verify_contradictions(articles, grounded) if grounded else []
    confirmed = _apply_verdicts(grounded, verdicts)

    report.result = {
        "contradictions": confirmed,
        "article_count": len(articles),
        "candidate_count": len(candidates),
        "confirmed_count": len(confirmed),
    }
    report.save(update_fields=["result"])

    logger.info(
        "Comparison %s: %d candidates -> %d grounded -> %d confirmed",
        report.id,
        len(candidates),
        len(grounded),
        len(confirmed),
    )
    return report
