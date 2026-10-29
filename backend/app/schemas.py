"""Request/response models -- see ref/prototype-data-format-v0.1.md."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

InterviewMode = Literal["behavioral", "technical"]
InterviewAnswerType = Literal["text", "code"]

WorkModel = Literal["onsite", "hybrid", "remote"]
ExperienceLevel = Literal["intern", "entry", "mid", "senior", "lead", "director"]
JobType = Literal["full_time", "part_time", "contract", "internship"]

MAX_JOB_FUNCTIONS = 5  # each one is a separate JSearch request


class JobSearchRequest(BaseModel):
    """An empty list means "any" for that filter."""

    location: str
    job_functions: list[str] = Field(min_length=1, max_length=MAX_JOB_FUNCTIONS)
    experience_levels: list[ExperienceLevel] = []
    job_types: list[JobType] = []
    work_models: list[WorkModel] = []

    @field_validator("job_functions")
    @classmethod
    def clean_job_functions(cls, value: list[str]) -> list[str]:
        cleaned = list(dict.fromkeys(f.strip() for f in value if f.strip()))
        if not cleaned:
            raise ValueError("at least one job function is required")
        return cleaned


class Job(BaseModel):
    id: str
    title: str
    company: str
    location: str
    description: str
    url: str
    company_logo: str = ""  # image URL


class UserProfile(BaseModel):
    skills: list[str]
    education: str
    experience: str


class FitAnalysisRequest(BaseModel):
    job: Job
    user_profile: UserProfile


class FitAnalysisResult(BaseModel):
    summary: str
    strengths: list[str]
    gaps: list[str]
    recommendations: list[str]


class InterviewQuestion(BaseModel):
    id: str
    question: str
    type: Literal["behavioral", "technical", "general"]


class InterviewAnswer(BaseModel):
    question_id: str
    answer: str


class InterviewFeedback(BaseModel):
    summary: str
    strengths: list[str]
    improvements: list[str]


class DetailedFeedbackRequest(BaseModel):
    question_id: str
    answer: str = Field(min_length=1)
    answer_type: InterviewAnswerType = "text"
    language: str | None = None
    company: str
    position: str


class BehavioralDetailedFeedback(BaseModel):
    mode: Literal["behavioral"] = "behavioral"
    ai_feedback: str
    strengths: list[str]
    areas_to_improve: list[str]
    star_structure: str
    improved_answer: str


class TechnicalDetailedFeedback(BaseModel):
    mode: Literal["technical"] = "technical"
    assessment: str
    explanation: str
    missing_points: list[str]
    time_complexity: str
    space_complexity: str
    suggested_solution: str


class InterviewQuestionResult(BaseModel):
    question: str
    result: str


class InterviewSummary(BaseModel):
    overall_performance: str
    strong_areas: list[str]
    areas_to_improve: list[str]
    question_results: list[InterviewQuestionResult]
    suggested_next_steps: list[str]
