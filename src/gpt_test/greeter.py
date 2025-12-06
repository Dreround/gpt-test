"""Greeting utilities for the gpt-test project."""

from __future__ import annotations


def greet(name: str = "world") -> str:
    """Return a friendly greeting string.

    Args:
        name: The name to greet. Defaults to "world".

    Returns:
        A formatted greeting string.
    """

    normalized = name.strip() or "world"
    return f"Hello, {normalized}!"
