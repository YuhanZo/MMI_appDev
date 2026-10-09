# Prototype Data Format v0.1

## Purpose

Changes since v0.1: interview questions by `mode`, detailed feedback and
summary (sections 9-11). The filename keeps `v0.1` so existing links still work.

Shared data formats for frontend and backend development.

Frontend can use mock data with the same format before backend/API integration is finished.

---

## 1. JobSearchRequest

Used for job search input.

```json
{
  "role": "Software Engineer Intern",
  "location": "Columbus, OH",
  "remote": true
}
```

**Fields**

| Field | Type |
| --- | --- |
| `role` | string |
| `location` | string |
| `remote` | boolean |

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
  "url": "https://example.com/job/001"
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
| `url` | string |

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

Response of `GET /api/interview/summary?mode=behavioral|technical`.

```json
{
  "overall_performance": "Solid communication; results need more detail.",
  "strong_areas": ["Clear structure"],
  "areas_to_improve": ["Quantify outcomes"],
  "question_results": [
    { "question": "Tell me about a time you worked through conflict...", "result": "Good" }
  ],
  "suggested_next_steps": ["Practice two more STAR answers"]
}
```

**Fields**

| Field | Type |
| --- | --- |
| `overall_performance` | string |
| `strong_areas` | string[] |
| `areas_to_improve` | string[] |
| `question_results` | `{ question: string, result: string }[]` |
| `suggested_next_steps` | string[] |

Note: the summary is currently prepared per mode and does not depend on the
user's answers. Generating it with Aivana will need the session's questions
and answers in the request.

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
