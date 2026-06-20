"""Search query preprocessing — port of frontend synonym/typo logic."""

from __future__ import annotations

import re

SYNONYMS: dict[str, str] = {
    "doctor": "healthtech",
    "medical": "healthtech",
    "hospital": "healthtech",
    "health": "healthtech",
    "farm": "agritech",
    "agriculture": "agritech",
    "crop": "agritech",
    "plant": "agritech",
    "agri": "agritech",
    "money": "fintech",
    "bank": "fintech",
    "finance": "fintech",
    "payment": "fintech",
    "school": "edtech",
    "student": "edtech",
    "learn": "edtech",
    "education": "edtech",
    "shop": "e-commerce",
    "store": "e-commerce",
    "buy": "e-commerce",
    "retail": "e-commerce",
    "crypto": "web3",
    "blockchain": "web3",
    "nft": "web3",
    "token": "web3",
    "machine": "machine learning",
    "learning": "machine learning",
    "llm": "artificial intelligence",
    "bot": "artificial intelligence",
    "intelligence": "artificial intelligence",
    "phone": "mobile",
    "ios": "mobile",
    "android": "mobile",
    "app": "mobile",
    "green": "greentech",
    "energy": "greentech",
    "solar": "greentech",
    "climate": "climatetech",
    "pharma": "pharmatech",
}

COMMON_TYPOS: dict[str, str] = {
    "helth": "healthtech",
    "finacial": "fintech",
    "artifical": "artificial intelligence",
    "tehc": "tech",
    "comerce": "e-commerce",
    "blokchain": "web3",
}


def preprocess_query(query: str) -> tuple[list[str], str | None, str | None]:
    """
    Returns (search_terms, suggested_query_if_spell_corrected, display_query).
    Search logic lives server-side; frontend may duplicate for instant UX.
    """
    words = [w for w in query.lower().split() if len(w) > 1]
    mapped_terms: list[str] = []
    suggested_words: list[str] = []
    spell_corrected = False

    for word in words:
        if word in COMMON_TYPOS:
            spell_corrected = True
            corrected = COMMON_TYPOS[word]
            suggested_words.append(corrected)
            mapped_terms.append(corrected)
        else:
            suggested_words.append(word)
            mapped_terms.append(word)
            if word in SYNONYMS:
                mapped_terms.append(SYNONYMS[word])

    suggested_query = " ".join(suggested_words) if spell_corrected else None
    return mapped_terms, suggested_query, query


def listing_matches_terms(listing, terms: list[str]) -> bool:
    searchable = " ".join(
        [
            listing.title,
            listing.short_description,
            listing.category,
            listing.expert_analysis,
            " ".join(listing.tech_stack or []),
        ]
    ).lower()

    for term in terms:
        if re.search(rf"\b{re.escape(term)}", searchable, re.IGNORECASE):
            return True
    return False
