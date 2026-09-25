# Prototype Data Format v0.1

## Purpose

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

## Development Rule

Frontend mock data and backend responses should follow these formats.

**Development order:**

```
Shared Data Format
  → Frontend with Mock Data + Backend Development
  → Integration
```

Any shared format changes should be discussed before implementation.
