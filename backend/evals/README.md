# Eval harness

Scores the AI features against fixed test cases, so you can tell whether a prompt
or model change made things better or worse.

## Run it

From `backend/` with the venv active:

    python -m evals.run --suite all        # or: fit, interview

It uses `AIVANA_MODE` from `backend/.env`. Set it to `live` to score the real
Aivana output. In `mock` mode the answers are canned, so the scores only show
that the harness itself works. A live fit run makes up to 3 Aivana calls per case.

Full results are saved to `evals/results/` (ignored by git).

## What it checks

Fit analysis (`cases/fit_cases.json`):

- `status_ok`, `schema_valid`: the endpoint answered in the shared format
- `no_overlap`: no skill is both matched and missing
- `matched_grounded`: every matched skill appears somewhere in the profile
- `list_lengths_ok`: strengths, gaps and recommendations have 2-4 items, as the prompt asks
- matched / missing F1 against the expected skills (synonyms like JS and JavaScript count as the same)

Interview feedback (`cases/interview_cases.json`):

- `status_ok`, `schema_valid`, `fields_filled`
- `weakness_flagged`: the known weakness in the answer shows up in the feedback
- `rewrite_differs`: the improved answer or suggested solution is not just the original
- answer sensitivity: different answers to the same question get different feedback

## Adding cases

Add an object to the JSON file. Interview cases pick a question by `mode` and
`question_index`, so they keep working if question IDs change.