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
        posted_at="2 days ago",
        employment_type="Internship",
        work_model="onsite",
        salary="$25–$32 an hour",
        benefits=["Paid time off", "Mentorship program"],
        employer_website="https://example.com",
        publisher="Example Jobs",
    ),
    Job(
        id="job_002",
        title="Frontend Developer Intern",
        company="Buckeye Labs",
        location="Columbus, OH",
        description="Build React interfaces and work with REST APIs.",
        url="https://example.com/job/002",
        posted_at="1 week ago",
        employment_type="Internship",
        work_model="hybrid",
        publisher="Example Jobs",
    ),
    Job(
        id="job_003",
        title="Data Analyst Intern",
        company="Scarlet Analytics",
        location="Remote",
        description="Analyze product metrics with SQL and Python.",
        url="https://example.com/job/003",
        posted_at="3 days ago",
        employment_type="Internship",
        work_model="remote",
        salary="$22 an hour",
        publisher="Example Jobs",
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
