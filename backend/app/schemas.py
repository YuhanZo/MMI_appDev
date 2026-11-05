"""Request/response models -- see ref/prototype-data-format-v0.1.md."""

from typing import Annotated, Literal

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

InterviewMode = Literal["behavioral", "technical"]
InterviewAnswerType = Literal["text", "code"]

WorkModel = Literal["onsite", "hybrid", "remote"]
ExperienceLevel = Literal["intern", "entry", "mid", "senior", "lead", "director"]
JobType = Literal["full_time", "part_time", "contract", "internship"]

MAX_JOB_FUNCTIONS = 5  # each one is a separate JSearch request
MAX_RESUME_CHARS = 15_000  # resume text kept from an upload; a long resume is ~5,000


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
    # Career preferences and resume. Defaults keep older clients valid.
    target_role: str = ""
    preferred_location: str = ""
    work_arrangement: str = ""
    salary_range: str = ""
    priorities: list[str] = []
    resume_text: str = Field(default="", max_length=MAX_RESUME_CHARS)


class ResumeUploadResult(BaseModel):
    filename: str
    text: str  # plain text, at most MAX_RESUME_CHARS
    truncated: bool  # the file had more text than was kept


class FitAnalysisRequest(BaseModel):
    job: Job
    user_profile: UserProfile


class FitAnalysisResult(BaseModel):
    summary: str
    strengths: list[str]
    gaps: list[str]
    recommendations: list[str]


MAX_BENCHMARK_PROMPT = 4000  # characters; Aivana's own limit is 20,000


class BenchmarkRequest(BaseModel):
    prompt: str = Field(max_length=MAX_BENCHMARK_PROMPT)

    @field_validator("prompt")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("prompt can't be empty")
        return value


class ModelReply(BaseModel):
    """One model's reply to a benchmark prompt, with what it took to get it."""

    system: Literal["aivana", "baseline"]
    model: str
    mock: bool  # canned reply: the numbers are placeholders
    text: str | None  # None if the call failed
    latency_ms: int
    cost: float | None  # in cost_unit; None if unknown
    cost_unit: Literal["credits", "usd"]
    input_tokens: int | None
    output_tokens: int | None
    error: str | None = None
    request_id: str | None = None


class BenchmarkResult(BaseModel):
    replies: list[ModelReply]  # Aivana first, then the baseline


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