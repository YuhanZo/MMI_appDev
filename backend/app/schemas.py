"""Request/response models -- see ref/prototype-data-format-v0.1.md."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

InterviewMode = Literal["behavioral", "technical"]
InterviewAnswerType = Literal["text", "code"]

WorkArrangement = Literal["any", "remote", "onsite", "hybrid"]
ExperienceLevel = Literal["any", "entry", "mid", "senior"]
EmploymentType = Literal["any", "full_time", "part_time", "contract", "internship"]

class JobSearchRequest(BaseModel):
    role: str
    location: str
    work_arrangement: WorkArrangement = "any"
    experience_level: ExperienceLevel = "any"
    employment_type: EmploymentType = "any"
    salary_min: int | None = Field(default=None, ge=0)  # yearly, USD
    salary_max: int | None = Field(default=None, ge=0)  # yearly, USD
    industry: str = ""

    @model_validator(mode="after")
    def check_salary_range(self):
        if self.salary_min is not None and self.salary_max is not None and self.salary_min > self.salary_max:
            raise ValueError("salary_min can't be greater than salary_max")
        return self


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
