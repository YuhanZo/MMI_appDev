from evals import checks


def test_aliases_normalize_common_synonyms():
    assert checks.norm(" JS ") == "javascript"
    assert checks.norm("Postgres") == "postgresql"


def test_prf_scores_a_partial_match():
    assert checks.prf(["Python", "Docker"], ["python", "SQL"]) == {"precision": 0.5, "recall": 0.5, "f1": 0.5}


def test_prf_with_nothing_expected_and_nothing_predicted_is_perfect():
    assert checks.prf([], [])["f1"] == 1.0


def test_overlap_and_grounding():
    assert checks.overlap(["AWS"], ["aws", "Docker"]) == ["aws"]
    profile = {"skills": ["Python"], "experience": "Built CI/CD pipelines", "education": ""}
    assert checks.ungrounded(["Python", "CI/CD", "Rust"], profile) == ["rust"]


def test_differs_ignores_case_and_spacing():
    assert not checks.differs("Hello  World", "hello world")
    assert checks.differs("A better answer", "hello world")
    assert not checks.differs("", "hello world")