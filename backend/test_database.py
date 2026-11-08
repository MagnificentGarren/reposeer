import pytest
from fastapi import HTTPException

from app.services.database import (
    _active_analysis_error,
    _database_connection_options,
    _quota_error,
    hash_client_ip,
)


def test_quota_error_has_actionable_http_response():
    error = _quota_error("ai_actions", 10, "day")

    assert error.status_code == 429
    assert error.detail["code"] == "quota_exceeded"
    assert error.detail["message"] == "Ai actions limit reached (10 per day). Please try again later."


def test_active_analysis_conflict_is_distinct_from_quota_exhaustion():
    error = _active_analysis_error()

    assert error.status_code == 409
    assert error.detail["code"] == "active_analysis"


def test_client_ip_hash_is_stable_and_keyed(monkeypatch):
    monkeypatch.setenv("REPOSEER_RATE_LIMIT_HMAC_KEY", "test-key")
    first_hash = hash_client_ip("192.0.2.1")

    assert first_hash == hash_client_ip("192.0.2.1")
    assert first_hash != "192.0.2.1"
    monkeypatch.setenv("REPOSEER_RATE_LIMIT_HMAC_KEY", "rotated-key")
    assert first_hash != hash_client_ip("192.0.2.1")


@pytest.mark.parametrize(
    ("url", "expected_ssl"),
    [
        ("postgresql://user:pass@localhost/db", None),
        ("postgresql://user:pass@db.example/db?sslmode=require", "require"),
        ("postgresql://user:pass@db.example/db?sslmode=verify-full", "verify-full"),
    ],
)
def test_database_url_ssl_options(url, expected_ssl):
    _, ssl = _database_connection_options(url)
    assert ssl == expected_ssl


def test_database_url_normalizes_sqlalchemy_asyncpg_scheme():
    dsn, ssl = _database_connection_options(
        "postgresql+asyncpg://db.example/reposeer?sslmode=require"
    )

    assert dsn == "postgresql://db.example/reposeer"
    assert ssl == "require"


def test_database_url_rejects_unknown_ssl_mode():
    with pytest.raises(ValueError, match="Unsupported DATABASE_URL sslmode"):
        _database_connection_options("postgresql://user:pass@db.example/db?sslmode=invalid")
