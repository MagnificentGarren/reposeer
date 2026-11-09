import app.api.chat as chat
import app.api.interview as interview
from app.api.interview import clean_generated_question


def test_clean_generated_question_removes_internal_preamble():
    generated = (
        "You are Reposeer Technical Interviewer, an elite lead engineer conducting architectural code-review interviews.\n"
        "Your task is to generate a realistic technical interview scenario based on real flaws identified in the repository.\n"
        "#notice this text. it should not be present for users.\n\n"
        "In `app/main.py`, how would you reduce coupling?"
    )

    assert clean_generated_question(generated) == "In `app/main.py`, how would you reduce coupling?"


def test_gemini_clients_use_v1beta_for_developer_instructions(monkeypatch):
    client_options = []

    def fake_client(**kwargs):
        client_options.append(kwargs["http_options"])
        return object()

    monkeypatch.setenv("GEMINI_API_KEY", "test-api-key")
    monkeypatch.setattr(chat.genai, "Client", fake_client)

    chat.get_gemini_client()
    interview.get_gemini_client()

    assert [options.api_version for options in client_options] == ["v1beta", "v1beta"]