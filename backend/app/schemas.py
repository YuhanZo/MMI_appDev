"""Request/response models -- see ref/prototype-data-format-v0.1.md."""

from typing import Annotated, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, StringConstraints, model_validator

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


class InterviewSessionCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    company: str = Field(min_length=1, max_length=255)
    position: str = Field(min_length=1, max_length=255)
    mode: InterviewMode


class InterviewSessionCreated(BaseModel):
    session_id: str
    company: str
    position: str
    mode: InterviewMode
    status: Literal["active"]
    current_question_index: int
    questions: list[InterviewQuestion]


class InterviewFeedbackDetail(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    score: int = Field(strict=True, ge=0, le=10)
    feedback: str = Field(min_length=1)
    strengths: list[str] = Field(min_length=1)
    areas_to_improve: list[str] = Field(
        min_length=1,
        validation_alias=AliasChoices("areas_to_improve", "areastoimprove"),
    )
    improved_answer: str = Field(
        min_length=1,
        validation_alias=AliasChoices("improved_answer", "improvedanswer"),
    )


class InterviewTurnAnswer(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    question_index: int = Field(ge=0, le=4)
    answer: str = Field(min_length=1)
    answer_type: InterviewAnswerType = "text"
    language: str | None = Field(default=None, max_length=100)

    @model_validator(mode="after")
    def code_requires_language(self):
        if self.answer_type == "code" and not self.language:
            raise ValueError("language is required for a code answer")
        return self


class InterviewTurnEvaluated(InterviewFeedbackDetail):
    session_id: str
    question_index: int
    question_id: str
    current_question_index: int
    next_question: InterviewQuestion | None


SummaryItem = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]


class GeneratedInterviewSummary(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    overall_evaluation: str = Field(
        min_length=1,
        max_length=600,
        validation_alias=AliasChoices("overall_evaluation", "overallevaluation"),
    )
    strong_areas: list[SummaryItem] = Field(
        min_length=1,
        max_length=3,
        validation_alias=AliasChoices("strong_areas", "strongareas"),
    )
    areas_to_improve: list[SummaryItem] = Field(
        min_length=1,
        max_length=3,
        validation_alias=AliasChoices("areas_to_improve", "areastoimprove"),
    )
    suggested_next_steps: list[SummaryItem] = Field(
        min_length=1,
        max_length=3,
        validation_alias=AliasChoices("suggested_next_steps", "suggestednextsteps"),
    )


class SessionInterviewQuestionResult(BaseModel):
    question: str
    answer: str
    score: int = Field(strict=True, ge=0, le=10)
    feedback: str


class SessionInterviewSummary(GeneratedInterviewSummary):
    session_id: str
    total_score: int = Field(ge=0, le=50)
    average_score: float = Field(ge=0, le=10)
    question_results: list[SessionInterviewQuestionResult] = Field(min_length=5, max_length=5)


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
