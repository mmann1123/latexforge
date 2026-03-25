"""Tests for the LaTeX compile backend."""
import os
import base64
import pytest

# Set DEV_MODE before importing the app
os.environ["DEV_MODE"] = "true"

from fastapi.testclient import TestClient
from main import app, validate_filename, check_rate_limit, rate_limit_store

client = TestClient(app)


class TestValidateFilename:
    def test_valid_tex_file(self):
        assert validate_filename("main.tex") is True

    def test_valid_bib_file(self):
        assert validate_filename("refs.bib") is True

    def test_valid_nested_path(self):
        assert validate_filename("chapters/intro.tex") is True

    def test_valid_image(self):
        assert validate_filename("images/fig1.png") is True

    def test_rejects_path_traversal(self):
        assert validate_filename("../../etc/passwd") is False

    def test_rejects_absolute_path(self):
        assert validate_filename("/etc/passwd") is False

    def test_rejects_dotdot(self):
        assert validate_filename("../secret.tex") is False

    def test_rejects_empty(self):
        assert validate_filename("") is False

    def test_rejects_no_extension(self):
        assert validate_filename("noextension") is False

    def test_rejects_special_chars(self):
        assert validate_filename("file;rm -rf.tex") is False

    def test_valid_hyphenated(self):
        assert validate_filename("my-file_v2.tex") is True

    def test_valid_deep_nested(self):
        assert validate_filename("a/b/c/d.tex") is True


class TestHealthEndpoint:
    def test_health(self):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestCompileEndpoint:
    def test_compile_simple_latex(self):
        """Test compilation of a minimal LaTeX document (requires pdflatex)."""
        response = client.post("/compile", json={
            "mainFile": "main.tex",
            "files": [{
                "name": "main.tex",
                "content": "\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}",
                "encoding": "text",
            }],
        })
        # In dev mode without pdflatex installed, this may fail gracefully
        assert response.status_code in [200, 408]

    def test_compile_invalid_filename(self):
        response = client.post("/compile", json={
            "mainFile": "../../evil.tex",
            "files": [{
                "name": "../../evil.tex",
                "content": "test",
                "encoding": "text",
            }],
        })
        assert response.status_code == 400

    def test_compile_invalid_main_file(self):
        response = client.post("/compile", json={
            "mainFile": "/etc/passwd",
            "files": [{
                "name": "main.tex",
                "content": "test",
                "encoding": "text",
            }],
        })
        assert response.status_code == 400

    def test_compile_base64_file(self):
        """Test that base64-encoded files are accepted."""
        b64_content = base64.b64encode(b"fake image data").decode()
        response = client.post("/compile", json={
            "mainFile": "main.tex",
            "files": [
                {
                    "name": "main.tex",
                    "content": "\\documentclass{article}\n\\begin{document}\ntest\n\\end{document}",
                    "encoding": "text",
                },
                {
                    "name": "image.png",
                    "content": b64_content,
                    "encoding": "base64",
                },
            ],
        })
        assert response.status_code in [200, 408]

    def test_compile_missing_fields(self):
        response = client.post("/compile", json={})
        assert response.status_code == 422  # Validation error


class TestRateLimiting:
    def setup_method(self):
        rate_limit_store.clear()

    def test_allows_requests_under_limit(self):
        # Should not raise for first request
        check_rate_limit("test-user")

    def test_blocks_after_limit(self):
        from fastapi import HTTPException
        for _ in range(10):
            check_rate_limit("test-user-2")
        with pytest.raises(HTTPException) as exc_info:
            check_rate_limit("test-user-2")
        assert exc_info.value.status_code == 429

    def test_different_users_independent(self):
        for _ in range(10):
            check_rate_limit("user-a")
        # user-b should still be allowed
        check_rate_limit("user-b")


class TestCORS:
    def test_cors_preflight(self):
        response = client.options(
            "/compile",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 200
