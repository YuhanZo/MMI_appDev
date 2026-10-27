"""Prepared interview content used until the real Aivana MMI call is wired up."""

from app.schemas import (
    BehavioralDetailedFeedback,
    InterviewMode,
    InterviewQuestion,
    InterviewQuestionResult,
    InterviewSummary,
    TechnicalDetailedFeedback,
)

QUESTIONS_BY_MODE: dict[InterviewMode, list[InterviewQuestion]] = {
    "behavioral": [
        InterviewQuestion(
            id="behavioral-1",
            question="Tell me about a time you worked through conflict with a teammate.",
            type="behavioral",
        ),
        InterviewQuestion(
            id="behavioral-2",
            question="Describe a project where you had to learn something quickly.",
            type="behavioral",
        ),
        InterviewQuestion(
            id="behavioral-3",
            question="Tell me about a time you received difficult feedback.",
            type="behavioral",
        ),
        InterviewQuestion(
            id="behavioral-4",
            question="Give an example of how you handled a tight deadline.",
            type="behavioral",
        ),
        InterviewQuestion(
            id="behavioral-5",
            question="Describe a time you took leadership without being assigned as the leader.",
            type="behavioral",
        ),
    ],
    "technical": [
        InterviewQuestion(
            id="technical-1",
            question="Explain how you would determine whether a string has balanced parentheses.",
            type="technical",
        ),
        InterviewQuestion(
            id="technical-2",
            question="How would you find the first non-repeating character in a string?",
            type="technical",
        ),
        InterviewQuestion(
            id="technical-3",
            question="Describe the difference between debouncing and throttling in frontend development.",
            type="technical",
        ),
        InterviewQuestion(
            id="technical-4",
            question="Given an array of integers, explain how you would return two numbers that add up to a target value.",
            type="technical",
        ),
        InterviewQuestion(
            id="technical-5",
            question="How would you design a frontend state flow for a five-question mock interview?",
            type="technical",
        ),
    ],
}

DETAILED_FEEDBACK_BY_QUESTION_ID: dict[
    str, BehavioralDetailedFeedback | TechnicalDetailedFeedback
] = {
    "behavioral-1": BehavioralDetailedFeedback(
        ai_feedback="Your answer shows collaboration and maturity. Add more detail about the specific action you took and the measurable outcome.",
        strengths=["Clear team context", "Professional tone", "Good ownership of the situation"],
        areas_to_improve=["Make the conflict more specific", "Quantify the result if possible", "Explain what you learned"],
        star_structure="Situation and Task are clear. Action needs more detail, and Result should be stronger.",
        improved_answer="In a software engineering course project, two teammates disagreed about whether to prioritize speed or usability. I scheduled a short meeting, asked each person to explain their concern, and proposed a small prototype test. After comparing both options, we chose the usability-focused design and reduced rework later in the sprint.",
    ),
    "behavioral-2": BehavioralDetailedFeedback(
        ai_feedback="The response communicates adaptability. It would be stronger with a clearer timeline and evidence that the learning helped the project.",
        strengths=["Shows initiative", "Relevant academic project example", "Demonstrates ability to learn independently"],
        areas_to_improve=["Mention the resources used", "Connect learning to project impact", "Include a concise result"],
        star_structure="Good Situation and Action. Add a sharper Task statement and a measurable Result.",
        improved_answer="During a capstone sprint, our team needed a dashboard prototype and I had limited experience with React. I spent two evenings reviewing the official documentation, built a small proof of concept, and shared reusable components with the team. This helped us finish the dashboard demo before the milestone review.",
    ),
    "behavioral-3": BehavioralDetailedFeedback(
        ai_feedback="Your answer reflects openness to feedback. Add the before-and-after change to make growth more visible.",
        strengths=["Positive attitude", "Shows coachability", "Appropriate professional framing"],
        areas_to_improve=["Avoid vague phrases", "Describe the concrete change made", "End with the improved result"],
        star_structure="Action and learning are present. Result needs a clearer outcome.",
        improved_answer="After a presentation rehearsal, my advisor said our demo story was hard to follow. I revised the slides around the user journey, removed extra technical details, and practiced transitions with the team. In the final review, the panel understood the problem and asked deeper questions about implementation.",
    ),
    "behavioral-4": BehavioralDetailedFeedback(
        ai_feedback="The answer demonstrates prioritization. Include how you communicated trade-offs and protected quality.",
        strengths=["Shows time management", "Explains prioritization", "Relevant to project delivery"],
        areas_to_improve=["Mention communication with stakeholders", "Identify what was deferred", "Add the final result"],
        star_structure="Strong Task and Action. Result should include impact or delivery status.",
        improved_answer="One week before a milestone, our prototype still needed interview setup and summary screens. I helped the team split must-have and nice-to-have features, focused on the core flow, and posted daily progress updates. We delivered a stable demo on time and documented the postponed features for the next sprint.",
    ),
    "behavioral-5": BehavioralDetailedFeedback(
        ai_feedback="The answer has a strong leadership theme. Make sure it does not sound like you took over; emphasize support and alignment.",
        strengths=["Demonstrates initiative", "Shows team awareness", "Highlights communication"],
        areas_to_improve=["Clarify why leadership was needed", "Show how others were included", "Explain the final team outcome"],
        star_structure="Situation and Action are effective. Add a more explicit Result and reflection.",
        improved_answer="When our team was unsure how to divide frontend tasks, I created a simple task board and proposed ownership areas based on each member's strengths. I checked that everyone agreed before we started. This made our work easier to track and helped us complete the prototype flow with fewer duplicated changes.",
    ),
    "technical-1": TechnicalDetailedFeedback(
        assessment="Likely Correct",
        explanation="A stack-based approach is appropriate. Push opening brackets and match them when closing brackets appear.",
        missing_points=["Mention handling empty input", "Return false when a closing bracket appears without a matching opener", "Check that the stack is empty at the end"],
        time_complexity="O(n), where n is the length of the string.",
        space_complexity="O(n) in the worst case for the stack.",
        suggested_solution="Iterate through the string, push opening brackets onto a stack, and pop only when the current closing bracket matches the top. The string is balanced if no mismatch occurs and the stack is empty after the loop.",
    ),
    "technical-2": TechnicalDetailedFeedback(
        assessment="Partially Correct",
        explanation="Counting character frequency is the right direction. The answer should preserve original order when selecting the first unique character.",
        missing_points=["Use a second pass through the string", "Define behavior when no unique character exists", "Discuss case sensitivity if requirements are unclear"],
        time_complexity="O(n), using two linear passes.",
        space_complexity="O(k), where k is the number of distinct characters stored.",
        suggested_solution="Build a frequency map, then scan the original string and return the first character with frequency one. If none exists, return a clear sentinel value such as null or -1.",
    ),
    "technical-3": TechnicalDetailedFeedback(
        assessment="Correct",
        explanation="Debouncing waits until activity stops before running a function. Throttling runs at most once during a defined interval.",
        missing_points=["Give a concrete example for each", "Mention search input for debounce", "Mention scroll or resize events for throttle"],
        time_complexity="Not applicable.",
        space_complexity="Not applicable.",
        suggested_solution="Use debounce for events where only the final value matters, such as search input after the user stops typing. Use throttle for continuous events where periodic updates are useful, such as scroll position tracking.",
    ),
    "technical-4": TechnicalDetailedFeedback(
        assessment="Likely Correct",
        explanation="A hash map approach is efficient and avoids the O(n squared) brute force solution.",
        missing_points=["Clarify whether duplicate values are allowed", "Return indices or values based on requirements", "Handle cases where no valid pair exists"],
        time_complexity="O(n), scanning the array once.",
        space_complexity="O(n), storing previously seen numbers.",
        suggested_solution="For each number, compute target minus current value. If the complement is already in the map, return the pair. Otherwise, store the current value and continue.",
    ),
    "technical-5": TechnicalDetailedFeedback(
        assessment="Needs Improvement",
        explanation="A complete answer should describe setup state, current question state, stored answers, feedback state, and completion state.",
        missing_points=["Mention separating mock data from UI state", "Describe how answers are stored by question id", "Explain how summary data is generated or received"],
        time_complexity="Not applicable.",
        space_complexity="O(q + a), where q is question data and a is stored answers.",
        suggested_solution="Keep interview settings in setup state, store the current question index, save answers in an object keyed by question id, and move to a completed state after the fifth question. Later, replace mock feedback with API responses using the same state boundaries.",
    ),
}

_COMMON_STRONG_AREAS = [
    "Clear communication",
    "Structured thinking",
    "Good awareness of teamwork and trade-offs",
]
_COMMON_AREAS_TO_IMPROVE = [
    "Add specific metrics or outcomes",
    "State assumptions before technical answers",
    "Use concise examples that map directly to the question",
]
_COMMON_NEXT_STEPS = [
    "Practice answering in the STAR format with a 90-second target.",
    "Prepare two technical examples that include assumptions, approach, and complexity.",
    "Review feedback after each session and rewrite one improved answer.",
]


def _question_results(mode: InterviewMode) -> list[InterviewQuestionResult]:
    results = [
        "Strong opening answer with good context.",
        "Solid approach; include more implementation detail.",
        "Clear explanation with useful examples.",
        "Good prioritization; add measurable impact.",
        "Needs a stronger closing result and next-step reflection.",
    ]
    return [
        InterviewQuestionResult(question=f"Question {index}", result=result)
        for index, result in enumerate(results, start=1)
    ]


SUMMARIES_BY_MODE: dict[InterviewMode, InterviewSummary] = {
    mode: InterviewSummary(
        overall_performance="Strong prototype session. The answers show good communication and problem-solving habits, with room to add more measurable results and sharper technical details.",
        strong_areas=_COMMON_STRONG_AREAS,
        areas_to_improve=_COMMON_AREAS_TO_IMPROVE,
        question_results=_question_results(mode),
        suggested_next_steps=_COMMON_NEXT_STEPS,
    )
    for mode in ("behavioral", "technical")
}
