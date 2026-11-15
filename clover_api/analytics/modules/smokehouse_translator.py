"""
Smokehouse Plain-English Translator & Jargon Quarantine.
Converts model outputs into actionable pitmaster guidance in whole physical cuts.
"""
import re
from typing import Dict

BANNED_JARGON = [
    "heteroskedasticity",
    "eigenvalues",
    "matrix profile",
    "mintrace",
    "wls",
    "p90",
    "p50",
    "p10",
    "variance",
    "regression",
    "velocity",
    "z-score",
    "sigma",
]


def contains_banned_jargon(text: str) -> bool:
    """Return True if any banned statistical jargon appears in text."""
    low = text.lower()
    return any(re.search(rf"\b{re.escape(term)}\b", low) for term in BANNED_JARGON)


def format_quantile_prep_summary(quantile_result: Dict[str, object]) -> str:
    """
    Translate P50/P90 quantile result into plain-English pitmaster guidance.
    Example: 'Expected Cook: 11 Briskets. Extra Weekend Prep: +1 Brisket for evening rush.'
    """
    meat = str(quantile_result.get("meat", "brisket"))
    p50 = int(quantile_result.get("p50_cuts", 0))
    extra = int(quantile_result.get("extra_weekend_prep", 0))

    labels = {
        "brisket": ("Brisket", "Briskets"),
        "pork_butt": ("Pork Butt", "Pork Butts"),
        "ribs": ("Rack of Ribs", "Racks of Ribs"),
        "turkey": ("Turkey Breast", "Turkey Breasts"),
        "sausage": ("Sausage Link", "Sausage Links"),
    }
    sing, plur = labels.get(meat, ("Unit", "Units"))
    p50_word = sing if p50 == 1 else plur
    if extra > 0:
        extra_word = sing if extra == 1 else plur
        return f"Expected Cook: {p50} {p50_word}. Extra Weekend Prep: +{extra} {extra_word} for evening rush."
    return f"Expected Cook: {p50} {p50_word}."
