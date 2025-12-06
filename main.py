"""Command line entrypoint for the gpt-test greeter."""

from __future__ import annotations

import argparse
from typing import Sequence

from gpt_test import greet


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Print a friendly greeting")
    parser.add_argument("name", nargs="?", default="world", help="Name to greet")
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    print(greet(args.name))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
