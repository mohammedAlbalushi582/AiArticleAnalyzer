from django.test import TestCase

from .services import _apply_verdicts, ground_quotes

ARTICLES = [
    {"id": 1, "title": "A", "text": "Coffee is good for your heart and lowers risk."},
    {"id": 2, "title": "B", "text": "Studies show coffee harms the heart over time."},
]


class GroundQuotesTests(TestCase):
    def test_keeps_contradiction_with_real_quotes(self):
        candidates = [
            {
                "topic": "coffee and heart health",
                "explanation": "opposite claims",
                "severity": "high",
                "positions": [
                    {"article_id": 1, "stance": "good", "quote": "Coffee is good for your heart"},
                    {"article_id": 2, "stance": "bad", "quote": "coffee harms the heart"},
                ],
            }
        ]
        grounded = ground_quotes(candidates, ARTICLES)
        self.assertEqual(len(grounded), 1)
        self.assertEqual(len(grounded[0]["positions"]), 2)
        self.assertEqual(grounded[0]["positions"][0]["article_title"], "A")

    def test_drops_hallucinated_quote(self):
        candidates = [
            {
                "topic": "fabricated",
                "positions": [
                    {"article_id": 1, "quote": "Coffee is good for your heart"},
                    {"article_id": 2, "quote": "this sentence was never in any article"},
                ],
            }
        ]
        # Only one position grounds, so the whole candidate is dropped.
        self.assertEqual(ground_quotes(candidates, ARTICLES), [])

    def test_whitespace_and_case_tolerant(self):
        candidates = [
            {
                "topic": "t",
                "positions": [
                    {"article_id": 1, "quote": "COFFEE   is good"},
                    {"article_id": 2, "quote": "Coffee  HARMS the heart"},
                ],
            }
        ]
        self.assertEqual(len(ground_quotes(candidates, ARTICLES)), 1)


class ApplyVerdictsTests(TestCase):
    def test_filters_rejected_and_sorts_by_score(self):
        grounded = [
            {"topic": "weak", "severity": "low", "positions": []},
            {"topic": "strong", "severity": "high", "positions": []},
        ]
        verdicts = [
            {"index": 0, "is_contradiction": False, "reason": "just framing"},
            {"index": 1, "is_contradiction": True, "severity": "high", "severity_score": 5, "reason": "real"},
        ]
        confirmed = _apply_verdicts(grounded, verdicts)
        self.assertEqual(len(confirmed), 1)
        self.assertEqual(confirmed[0]["topic"], "strong")
        self.assertEqual(confirmed[0]["severity_score"], 5)

    def test_missing_verdict_is_dropped(self):
        grounded = [{"topic": "x", "severity": "high", "positions": []}]
        self.assertEqual(_apply_verdicts(grounded, []), [])
