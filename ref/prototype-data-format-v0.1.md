# Prototype Data Format v0.1

## Purpose

Changes since v0.1: job search filters and `company_logo` (sections 1-2);
interview questions by `mode`, detailed feedback and summary (sections 9-11); benchmark results (section 12). The filename keeps `v0.1` so existing links still work.

Shared data formats for frontend and backend development.

Frontend can use mock data with the same format before backend/API integration is finished.

---

## 1. JobSearchRequest

Used for job search input (`POST /api/jobs/search`).

```json
{
  "location": "Columbus, OH",
  "job_functions": ["Software Engineer Intern", "Backend Engineer"],
  "experience_levels": ["intern", "entry"],
  "job_types": ["internship"],
  "work_models": ["onsite", "hybrid"]
}
```

**Fields**

An empty list means "any" for that filter.

| Field | Type |
| --- | --- |
| `location` | string |
| `job_functions` | string[] (1-5 non-blank roles; each is searched separately and the results merged) |
| `experience_levels` | (`intern` \| `entry` \| `mid` \| `senior` \| `lead` \| `director`)[] (default `[]`) |
| `job_types` | (`full_time` \| `part_time` \| `contract` \| `internship`)[] (default `[]`) |
| `work_models` | (`onsite` \| `hybrid` \| `remote`)[] (default `[]`) |

Replaces v0.1's `role` and `remote: boolean`, and the single-value `work_arrangement`,
`experience_level`, `employment_type`, `salary_min`/`salary_max` and `industry` filters.

---

## 2. Job

Normalized job data returned to the frontend.

```json
{
  "id": "job_001",
  "title": "Software Engineer Intern",
  "company": "Example Company",
  "location": "Columbus, OH",
  "description": "Build backend services using Python and AWS.",
  "url": "https://example.com/job/001",
  "company_logo": "https://example.com/logo.png"
}
```

**Fields**

| Field | Type |
| --- | --- |
| `id` | string |
| `title` | string |
| `company` | string |
| `location` | string |
| `description` | string |
| `url` | string (apply link) |
| `company_logo` | string (image URL, `""` if none) |

---

## 3. UserProfile

Used for fit analysis and mock interview.

```json
{
  "skills": ["Python", "Java", "React"],
  "education": "BS Computer Science",
  "experience": "Backend and web development project experience.",
  "target_role": "Software Engineer",
  "preferred_location": "Columbus, OH",
  "work_arrangement": "Hybrid",
  "salary_range": "$70,000 – $90,000",
  "priorities": ["Career Growth", "Salary"],
  "resume_text": ""
}
```

**Fields**

| Field | Type |
| --- | --- |
| `skills` | string[] |
| `education` | string |
| `experience` | string |
| `target_role`, `preferred_location`, `work_arrangement`, `salary_range` | string (optional, default `""`) |
| `priorities` | string[] (optional, default `[]`) |
| `resume_text` | string (optional, default `""`; at most 15,000 characters; text from `POST /api/profile/resume`) |

**ResumeUploadResult** (`POST /api/profile/resume`, multipart `file`): `filename`
(string), `text` (string, the resume's plain text, at most 15,000 characters),
`truncated` (boolean, the file had more text than was kept).

---

## 4. FitAnalysisRequest

```json
{
  "job": { "...Job object..." },
  "user_profile": { "...UserProfile object..." }
}
```

**Fields**

| Field | Type |
| --- | --- |
| `job` | [Job](#2-job) |
| `user_profile` | [UserProfile](#3-userprofile) |

---

## 5. FitAnalysisResult

```json
{
  "summary": "Overall fit summary.",
  "strengths": [
    "Strong Python experience"
  ],
  "gaps": [
    "Limited AWS experience"
  ],
  "recommendations": [
    "Review basic AWS services"
  ]
}
```

**Fields**

| Field | Type |
| --- | --- |
| `summary` | string |
| `strengths` | string[] |
| `gaps` | string[] |
| `recommendations` | string[] |

---

## 6. InterviewQuestion

```json
{
  "id": "q1",
  "question": "Tell me about a challenging software project.",
  "type": "behavioral"
}
```

**Fields**

| Field | Type |
| --- | --- |
| `id` | string |
| `question` | string |
| `type` | `behavioral` \| `technical` \| `general` |

`GET /api/interview/questions?mode=behavioral|technical` returns five questions
for that mode (ids like `behavioral-1`); without `mode` it returns the default set.

`POST /api/interview/sessions` creates a backend-authoritative session. Request:

```json
{
  "company": "Aivana",
  "position": "Software Engineer",
  "mode": "technical"
}
```

Response (`201 Created`):

```json
{
  "session_id": "uuid",
  "company": "Aivana",
  "position": "Software Engineer",
  "mode": "technical",
  "status": "active",
  "current_question_index": 0,
  "questions": [
    { "id": "technical-1", "question": "...", "type": "technical" }
  ]
}
```

The response always contains five distinct questions. The session and its five
ordered turns are saved before the response is returned.

`POST /api/interview/sessions/{session_id}/answers` evaluates only the current
question. Request:

```json
{
  "question_index": 0,
  "answer": "I aligned the team around shared goals.",
  "answer_type": "text",
  "language": null
}
```

Response:

```json
{
  "session_id": "uuid",
  "question_index": 0,
  "question_id": "behavioral-1",
  "current_question_index": 1,
  "next_question": { "id": "behavioral-2", "question": "...", "type": "behavioral" },
  "score": 8,
  "feedback": "Clear and relevant answer.",
  "strengths": ["Specific example"],
  "areas_to_improve": ["Add a measurable result"],
  "improved_answer": "I aligned the team and improved delivery time by 20%."
}
```

`score` is an integer from 0 through 10. A successful response saves the answer,
feedback, and score and advances the session. A failed Aivana call does neither.

---

## 7. InterviewAnswer

```json
{
  "question_id": "q1",
  "answer": "In one of my projects..."
}
```

**Fields**

| Field | Type |
| --- | --- |
| `question_id` | string |
| `answer` | string |

---

## 8. InterviewFeedback

```json
{
  "summary": "Overall feedback.",
  "strengths": [
    "Clear explanation"
  ],
  "improvements": [
    "Add measurable results"
  ]
}
```

**Fields**

| Field | Type |
| --- | --- |
| `summary` | string |
| `strengths` | string[] |
| `improvements` | string[] |

---

## 9. DetailedFeedbackRequest

Body of `POST /api/interview/detailed-feedback`.

```json
{
  "question_id": "behavioral-1",
  "answer": "In a course project, two teammates disagreed...",
  "answer_type": "text",
  "language": null,
  "company": "Example Company",
  "position": "Software Engineer Intern"
}
```

**Fields**

| Field | Type |
| --- | --- |
| `question_id` | string |
| `answer` | string (non-empty) |
| `answer_type` | `text` \| `code` (default `text`) |
| `language` | string \| null (for `code` answers, e.g. `Python`) |
| `company` | string |
| `position` | string |

---

## 10. DetailedInterviewFeedback

Response of `POST /api/interview/detailed-feedback`. One of two shapes,
told apart by `mode`.

**Behavioral**

```json
{
  "mode": "behavioral",
  "ai_feedback": "Your answer shows collaboration...",
  "strengths": ["Clear team context"],
  "areas_to_improve": ["Quantify the result"],
  "star_structure": "Situation and Task are clear; Result should be stronger.",
  "improved_answer": "In a software engineering course project..."
}
```

| Field | Type |
| --- | --- |
| `mode` | `behavioral` |
| `ai_feedback` | string |
| `strengths` | string[] |
| `areas_to_improve` | string[] |
| `star_structure` | string |
| `improved_answer` | string |

**Technical**

```json
{
  "mode": "technical",
  "assessment": "Correct approach with a small gap.",
  "explanation": "...",
  "missing_points": ["Handle empty input"],
  "time_complexity": "O(n)",
  "space_complexity": "O(n)",
  "suggested_solution": "..."
}
```

| Field | Type |
| --- | --- |
| `mode` | `technical` |
| `assessment` | string |
| `explanation` | string |
| `missing_points` | string[] |
| `time_complexity` | string |
| `space_complexity` | string |
| `suggested_solution` | string |

---

## 11. InterviewSummary

Response of `POST /api/interview/sessions/{session_id}/summary` after all five
answers have been evaluated.

```json
{
  "session_id": "0f5f73b7-7bad-4aac-95d0-8ef9d19c8182",
  "overall_evaluation": "Solid communication; results need more detail.",
  "strong_areas": ["Clear structure"],
  "areas_to_improve": ["Quantify outcomes"],
  "total_score": 40,
  "average_score": 8.0,
  "question_results": [
    {
      "question": "Tell me about a time you worked through conflict...",
      "answer": "I aligned the team around shared goals...",
      "score": 8,
      "feedback": "Clear and relevant answer."
    }
  ],
  "suggested_next_steps": ["Practice two more STAR answers"]
}
```

**Fields**

| Field | Type |
| --- | --- |
| `session_id` | string |
| `overall_evaluation` | string |
| `strong_areas` | string[] |
| `areas_to_improve` | string[] |
| `total_score` | integer (0–50) |
| `average_score` | number (0–10) |
| `question_results` | `{ question, answer, score, feedback }[]` (exactly 5) |
| `suggested_next_steps` | string[] |

The overall evaluation and recommendation lists come from Aivana. Total and
average scores are calculated by the backend; question results come directly
from the saved SQLite turns. A successful response is cached in the session.

---

## 12. BenchmarkResult

Returned by `POST /api/benchmark/chat` (request: `{"prompt": "Correct grammar: I are happy."}`,
1-4000 characters). One `ModelReply` per model: Aivana first, then the baseline. The
page shows them in random order as Model A and Model B.

```json
{
  "replies": [
    {
      "system": "aivana",
      "model": "aivana-mmi",
      "mock": false,
      "text": "The correct grammar would be \"I am happy.\"",
      "latency_ms": 12200,
      "cost": 0.00121,
      "cost_unit": "credits",
      "input_tokens": 12,
      "output_tokens": 9,
      "error": null,
      "request_id": "req_d749408b0aedcd00e9bc3cef"
    }
  ]
}
```

**ModelReply fields**

| Field | Type |
| --- | --- |
| `system` | `aivana` \| `baseline` |
| `model` | string (as reported; Aivana says `aivana-mmi`) |
| `mock` | boolean (canned reply; the numbers are placeholders) |
| `text` | string \| null (null if the call failed) |
| `latency_ms` | integer |
| `cost` | number \| null (in `cost_unit`; null if unknown) |
| `cost_unit` | `credits` \| `usd` |
| `input_tokens`, `output_tokens` | integer \| null |
| `error` | string \| null |
| `request_id` | string \| null (Aivana only) |

---

## 13. Scenario Test

`GET /api/scenarios` returns the eight `Scenario`s. `POST /api/scenarios/{id}/answer`
returns Aivana's answer to one of them as a `ModelReply` (section 12).
`POST /api/scenarios/judge` takes `{"answers": [ScenarioAnswer, ...]}` (1-8, no repeats)
and returns a `ScenarioJudgement`.

```json
{
  "id": "calculation",
  "number": 2,
  "type": "Calculation",
  "title": "Compare two internship offers",
  "question": "Two summer internships, ...",
  "key_points": ["Offer A leaves $12,660 ...", "Offer B leaves $15,900 ...", "Concludes B leaves $3,240 more"]
}
```

**ScenarioAnswer fields:** `scenario_id` (string), `text` (string, Aivana's answer,
not empty), `latency_ms` (integer).

```json
{
  "model": "gemini-3.5-flash",
  "mock": false,
  "latency_ms": 4100,
  "summary": "Solid answers, one arithmetic slip.",
  "overall_score": 86,
  "passed": 1,
  "results": [
    {
      "scenario_id": "calculation",
      "correctness": 3,
      "helpfulness": 4,
      "honesty": 5,
      "speed": 3,
      "score": 72,
      "key_points_met": [true, true, false],
      "verdict": "partial",
      "comment": "Got the difference wrong."
    }
  ]
}
```

**ScenarioVerdict fields**

| Field | Type |
| --- | --- |
| `scenario_id` | string |
| `correctness`, `helpfulness`, `honesty` | integer 1-5 (from the judge) |
| `speed` | integer 1-5 (from `latency_ms`: up to 10 s = 5, 20 s = 4, 30 s = 3, 45 s = 2, slower = 1) |
| `score` | integer 0-100: 35% correctness, 30% helpfulness, 25% honesty, 10% speed, each as a fraction of 5 |
| `key_points_met` | boolean[] (one per key point, in order) |
| `verdict` | `pass` \| `partial` \| `fail` |
| `comment` | string (one sentence) |

`overall_score` is the mean of the scenario scores; `results` follow the order of the request.

---

## Development Rule

Frontend mock data and backend responses should follow these formats.

**Development order:**

```
Shared Data Format
  → Frontend with Mock Data + Backend Development
  → Integration
```

Any shared format changes should be discussed before implementation.
