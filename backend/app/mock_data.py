"""Placeholder data. Swap for the third-party job API + Aivana MMI later."""

from app.schemas import FitAnalysisResult, InterviewFeedback, InterviewQuestion, Job

JOBS = [
    Job(
        id="job_001",
        title="Software Engineer Intern",
        company="Example Company",
        location="Columbus, OH",
        description="Build backend services using Python and AWS.",
        url="https://example.com/job/001",
    ),
    Job(
        id="job_002",
        title="Frontend Developer Intern",
        company="Buckeye Labs",
        location="Columbus, OH",
        description="Build React interfaces and work with REST APIs.",
        url="https://example.com/job/002",
    ),
    Job(
        id="job_003",
        title="Data Analyst Intern",
        company="Scarlet Analytics",
        location="Remote",
        description="Analyze product metrics with SQL and Python.",
        url="https://example.com/job/003",
    ),
]

FIT_ANALYSIS = FitAnalysisResult(
    summary="Overall fit summary.",
    strengths=["Strong Python experience"],
    gaps=["Limited AWS experience"],
    recommendations=["Review basic AWS services"],
)

QUESTIONS = [
    InterviewQuestion(
        id="q1",
        question="Tell me about a challenging software project.",
        type="behavioral",
    ),
    InterviewQuestion(
        id="q2",
        question="How would you design a REST API for job search?",
        type="technical",
    ),
]

FEEDBACK = InterviewFeedback(
    summary="Overall feedback.",
    strengths=["Clear explanation"],
    improvements=["Add measurable results"],
)
