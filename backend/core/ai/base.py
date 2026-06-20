from abc import ABC, abstractmethod
from typing import TypedDict


class AnalysisResult(TypedDict):
    title: str
    summary: str
    key_points: list[str]
    tags: list[str]


class Analyzer(ABC):
    @abstractmethod
    def analyze(self, text: str) -> AnalysisResult:
        """Analyze article text and return structured results."""
        ...

    @abstractmethod
    def chat(self, system_prompt: str, messages: list[dict]) -> str:
        """Send a chat message with article context and return the assistant reply."""
        ...

    @abstractmethod
    def find_contradictions(self, articles: list[dict]) -> list[dict]:
        """Pass 1: surface candidate contradictions across articles.

        ``articles`` is a list of ``{"id", "title", "text"}`` dicts. Returns a
        list of candidate contradiction dicts (topic, explanation, severity,
        positions[]). Quotes are unverified at this stage.
        """
        ...

    @abstractmethod
    def verify_contradictions(self, articles: list[dict], candidates: list[dict]) -> list[dict]:
        """Pass 2: adversarially review candidates and return per-candidate verdicts.

        Returns a list of ``{"index", "is_contradiction", "severity",
        "severity_score", "reason"}`` dicts referencing ``candidates`` by index.
        """
        ...
