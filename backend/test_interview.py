from app.api.interview import clean_generated_question


def test_clean_generated_question_removes_internal_preamble():
    generated = (
        "You are Reposeer Technical Interviewer, an elite lead engineer conducting architectural code-review interviews.\n"
        "Your task is to generate a realistic technical interview scenario based on real flaws identified in the repository.\n"
        "#notice this text. it should not be present for users.\n\n"
        "In `app/main.py`, how would you reduce coupling?"
    )

    assert clean_generated_question(generated) == "In `app/main.py`, how would you reduce coupling?"