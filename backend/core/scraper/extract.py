import logging

import requests
from lxml.html.clean import Cleaner
from readability import Document

from core.exceptions import ArticleFetchFailed

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}


def extract_article(url: str) -> tuple[str, str]:
    """Fetch a URL and extract the main article content.

    Returns (title, plain_text).
    """
    try:
        # (connect, read): fail fast on unreachable hosts, but give slow/heavy
        # pages time to send the body before giving up.
        response = requests.get(url, headers=HEADERS, timeout=(10, 30))
        response.raise_for_status()
    except requests.RequestException as e:
        logger.error("Failed to fetch %s: %s", url, e)
        raise ArticleFetchFailed(f"Could not fetch the URL: {e}")

    doc = Document(response.text)
    title = doc.title()

    # Get readable HTML and strip remaining tags for plain text
    html_content = doc.summary()
    cleaner = Cleaner(
        scripts=True,
        javascript=True,
        comments=True,
        style=True,
        links=False,
        page_structure=False,
        processing_instructions=True,
        remove_unknown_tags=True,
        safe_attrs_only=True,
    )
    from lxml.html import fromstring

    cleaned = cleaner.clean_html(fromstring(html_content))
    text = cleaned.text_content().strip()

    if not text:
        raise ArticleFetchFailed("Could not extract article content from the URL.")

    return title, text
