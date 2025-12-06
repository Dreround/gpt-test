import pytest

from gpt_test.greeter import greet


def test_default_greeting():
    assert greet() == "Hello, world!"


def test_custom_name():
    assert greet("Alice") == "Hello, Alice!"


def test_strips_whitespace_and_defaults():
    assert greet("   ") == "Hello, world!"
    assert greet("  Bob  ") == "Hello, Bob!"
