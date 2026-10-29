# Prototype Data Format v0.1

## Purpose

Changes since v0.1: job search filters and `company_logo` (sections 1-2);
interview questions by `mode`, detailed feedback and summary (sections 9-11). The filename keeps `v0.1` so existing links still work.

Shared data formats for frontend and backend development.

Frontend can use mock data with the same format before backend/API integration is finished.

---

## 1. JobSearchRequest

Used for job search input (`POST /api/jobs/search`).

```json
{
  "role": "Software Engineer Intern",
  "location": "Columbus, OH",
  "work_arrangement": "remote",
  "experience_level": "entry",
  "employment_type": "internship",
  "salary_min": 50000,
  "salary_max": null,
  "industry": ""
}
```

**Fields**

| Field | Type |
| --- | --- |
| `role` | string |
| `location` | string |
| `work_arrangement` | `any` \| `remote` \| `onsite` \| `hybrid` (default `any`) |
| `experience_level` | `any` \| `entry` \| `mid` \| `senior` (default `any`) |
| `employment_type` | `any` \| `full_time` \| `part_time` \| `contract` \| `internship` (default `any`) |
| `salary_min` | integer \| null (yearly USD, >= 0) |
| `salary_max` | integer \| null (yearly USD, >= 0; not below `salary_min`) |
| `industry` | string (optional keyword, default `""`) |

Replaces v0.1's `remote: boolean` (now `work_arrangement: "remote"`).

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
  "experience": "Backend and web development project experience."
}
```

**Fields**

| Field | Type |
| --- | --- |
| `skills` | string[] |
| `education` | string |
| `experience` | string |

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

## Development Rule

Frontend mock data and backend responses should follow these formats.

**Development order:**

```
Shared Data Format
  → Frontend with Mock Data + Backend Development
  → Integration
```

Any shared format changes should be discussed before implementation.
