"""Request/response models -- see ref/prototype-data-format-v0.1.md."""

from typing import Literal

from pydantic import BaseModel


class JobSearchRequest(BaseModel):
    role: str
    location: str
    remote: bool = False


class Job(BaseModel):
    id: str
    title: str
    company: str
    location: str
    description: str
    url: str


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
