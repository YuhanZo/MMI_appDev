"""Evaluation harness for fit analysis and interview feedback.

Run from backend/:
    python -m evals.run --suite fit | interview | all

Uses AIVANA_MODE from backend/.env. In mock mode the answers are canned, so the
scores only show that the harness works, not how good the AI is.
"""

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.schemas import BehavioralDetailedFeedback, FitAnalysisResult, TechnicalDetailedFeedback
from evals import checks

HERE = Path(__file__).resolve().parent
CASES = HERE / "cases"
RESULTS = HERE / "results"


def load(name):
    return json.loads((CASES / name).read_text(encoding="utf-8"))


def timed_post(client, url, payload):
    start = time.perf_counter()
    res = client.post(url, json=payload)
    return res, round((time.perf_counter() - start) * 1000)


def run_fit(client):
    rows = []
    for case in load("fit_cases.json"):
        res, ms = timed_post(client, "/api/jobs/fit-analysis", {"job": case["job"], "user_profile": case["profile"]})
        row = {"id": case["id"], "ms": ms, "status": res.status_code, "checks": {}, "scores": {}}
        rows.append(row)
        c = row["checks"]
        c["status_ok"] = res.status_code == 200
        if not c["status_ok"]:
            row["error"] = res.text[:300]
            continue

        body = res.json()
        row["output"] = body
        try:
            FitAnalysisResult.model_validate(body)
            c["schema_valid"] = True
        except Exception:
            c["schema_valid"] = False
        c["no_overlap"] = not checks.overlap(body.get("matched_skills"), body.get("missing_skills"))
        bad = checks.ungrounded(body.get("matched_skills"), case["profile"])
        c["matched_grounded"] = not bad
        if bad:
            row["ungrounded"] = bad
        c["list_lengths_ok"] = all(checks.length_ok(body.get(k)) for k in ("strengths", "gaps", "recommendations"))
        row["scores"]["matched"] = checks.prf(body.get("matched_skills"), case["expected_matched"])
        row["scores"]["missing"] = checks.prf(body.get("missing_skills"), case["expected_missing"])
    return rows


def run_interview(client):
    questions = {
        mode: client.get("/api/interview/questions", params={"mode": mode}).json()
        for mode in ("behavioral", "technical")
    }
    rows, outputs_by_question = [], {}
    for case in load("interview_cases.json"):
        row = {"id": case["id"], "checks": {}}
        rows.append(row)
        c = row["checks"]
        qs = questions[case["mode"]]
        if case["question_index"] >= len(qs):
            c["question_found"] = False
            row["error"] = f"only {len(qs)} {case['mode']} questions exist"
            continue

        q = qs[case["question_index"]]
        payload = {
            "question_id": q["id"],
            "answer": case["answer"],
            "answer_type": case.get("answer_type", "text"),
            "language": case.get("language"),
            "company": case.get("company", "Example Company"),
            "position": case.get("position", "Software Engineer Intern"),
        }
        res, ms = timed_post(client, "/api/interview/detailed-feedback", payload)
        row.update(ms=ms, status=res.status_code, question=q["question"])
        c["status_ok"] = res.status_code == 200
        if not c["status_ok"]:
            row["error"] = res.text[:300]
            continue

        body = res.json()
        row["output"] = body
        behavioral = case["mode"] == "behavioral"
        model = BehavioralDetailedFeedback if behavioral else TechnicalDetailedFeedback
        try:
            model.model_validate(body)
            c["schema_valid"] = body.get("mode") == case["mode"]
        except Exception:
            c["schema_valid"] = False

        if behavioral:
            c["fields_filled"] = all(body.get(k) for k in ("ai_feedback", "star_structure", "improved_answer"))
            flag_texts = body.get("areas_to_improve", []) + [body.get("star_structure", "")]
            rewrite = body.get("improved_answer")
        else:
            c["fields_filled"] = all(body.get(k) for k in ("assessment", "explanation", "suggested_solution"))
            flag_texts = body.get("missing_points", []) + [body.get("explanation", "")]
            rewrite = body.get("suggested_solution")
        if case.get("expect_flags"):
            c["weakness_flagged"] = checks.mentions_any(flag_texts, case["expect_flags"])
        c["rewrite_differs"] = checks.differs(rewrite, case["answer"])
        outputs_by_question.setdefault(q["id"], []).append((case["answer"], json.dumps(body, sort_keys=True)))

    # Different answers to the same question should get different feedback.
    sensitivity = {
        qid: len({out for _, out in pairs}) > 1
        for qid, pairs in outputs_by_question.items()
        if len({answer for answer, _ in pairs}) > 1
    }
    return rows, sensitivity


def pass_rates(rows):
    totals = {}
    for r in rows:
        for name, ok in r["checks"].items():
            t = totals.setdefault(name, [0, 0])
            t[0] += bool(ok)
            t[1] += 1
    return {name: f"{p}/{n}" for name, (p, n) in totals.items()}


def mean_f1(rows):
    vals = [r["scores"][k]["f1"] for r in rows if r.get("scores") for k in ("matched", "missing")]
    return round(sum(vals) / len(vals), 2) if vals else None


def print_rows(title, rows, rates):
    print(f"\n=== {title} ({len(rows)} cases) ===")
    for r in rows:
        failed = [name for name, ok in r["checks"].items() if not ok]
        status = "PASS" if not failed else "FAIL: " + ", ".join(failed)
        scores = ""
        if r.get("scores"):
            scores = f"  matched F1 {r['scores']['matched']['f1']}, missing F1 {r['scores']['missing']['f1']}"
        print(f"  {r['id']:<26} {status}{scores}  ({r.get('ms', '-')} ms)")
    print("  Pass rates: " + ", ".join(f"{name} {rate}" for name, rate in rates.items()))


def main():
    parser = argparse.ArgumentParser(description="Evaluate the AI features against fixed test cases.")
    parser.add_argument("--suite", choices=["fit", "interview", "all"], default="all")
    args = parser.parse_args()

    print(f"AIVANA_MODE={settings.aivana_mode}")
    if settings.aivana_mode == "mock":
        print("Note: mock mode returns canned answers, so scores reflect the mock data, not the AI.")

    client = TestClient(app, raise_server_exceptions=False)
    report = {"mode": settings.aivana_mode, "started": datetime.now().isoformat(timespec="seconds")}

    if args.suite in ("fit", "all"):
        rows = run_fit(client)
        report["fit"] = {"rows": rows, "pass_rates": pass_rates(rows), "mean_f1": mean_f1(rows)}
        print_rows("Fit analysis", rows, report["fit"]["pass_rates"])
        print(f"  Mean skill F1: {report['fit']['mean_f1']}")

    if args.suite in ("interview", "all"):
        rows, sensitivity = run_interview(client)
        report["interview"] = {"rows": rows, "pass_rates": pass_rates(rows), "answer_sensitivity": sensitivity}
        print_rows("Interview feedback", rows, report["interview"]["pass_rates"])
        for qid, ok in sensitivity.items():
            verdict = "feedback changes with the answer" if ok else "FAIL: same feedback for different answers"
            print(f"  Answer sensitivity, {qid}: {verdict}")

    RESULTS.mkdir(exist_ok=True)
    ignore = RESULTS / ".gitignore"
    if not ignore.exists():
        ignore.write_text("*\n", encoding="utf-8")
    out = RESULTS / f"{args.suite}-{datetime.now():%Y%m%d-%H%M%S}.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nFull results saved to {out}")


if __name__ == "__main__":
    main()