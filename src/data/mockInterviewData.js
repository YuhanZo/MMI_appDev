export const interviewModes = {
  behavioral: {
    label: "Behavioral Interview",
    questions: [
      {
        id: "behavioral-1",
        prompt:
          "Tell me about a time you worked through conflict with a teammate.",
        feedback: {
          aiFeedback:
            "Your answer shows collaboration and maturity. Add more detail about the specific action you took and the measurable outcome.",
          strengths: [
            "Clear team context",
            "Professional tone",
            "Good ownership of the situation"
          ],
          areasToImprove: [
            "Make the conflict more specific",
            "Quantify the result if possible",
            "Explain what you learned"
          ],
          starStructure:
            "Situation and Task are clear. Action needs more detail, and Result should be stronger.",
          improvedAnswer:
            "In a software engineering course project, two teammates disagreed about whether to prioritize speed or usability. I scheduled a short meeting, asked each person to explain their concern, and proposed a small prototype test. After comparing both options, we chose the usability-focused design and reduced rework later in the sprint."
        }
      },
      {
        id: "behavioral-2",
        prompt: "Describe a project where you had to learn something quickly.",
        feedback: {
          aiFeedback:
            "The response communicates adaptability. It would be stronger with a clearer timeline and evidence that the learning helped the project.",
          strengths: [
            "Shows initiative",
            "Relevant academic project example",
            "Demonstrates ability to learn independently"
          ],
          areasToImprove: [
            "Mention the resources used",
            "Connect learning to project impact",
            "Include a concise result"
          ],
          starStructure:
            "Good Situation and Action. Add a sharper Task statement and a measurable Result.",
          improvedAnswer:
            "During a capstone sprint, our team needed a dashboard prototype and I had limited experience with Next.js. I spent two evenings reviewing the official documentation, built a small proof of concept, and shared reusable components with the team. This helped us finish the dashboard demo before the milestone review."
        }
      },
      {
        id: "behavioral-3",
        prompt: "Tell me about a time you received difficult feedback.",
        feedback: {
          aiFeedback:
            "Your answer reflects openness to feedback. Add the before-and-after change to make growth more visible.",
          strengths: [
            "Positive attitude",
            "Shows coachability",
            "Appropriate professional framing"
          ],
          areasToImprove: [
            "Avoid vague phrases",
            "Describe the concrete change made",
            "End with the improved result"
          ],
          starStructure:
            "Action and learning are present. Result needs a clearer outcome.",
          improvedAnswer:
            "After a presentation rehearsal, my advisor said our demo story was hard to follow. I revised the slides around the user journey, removed extra technical details, and practiced transitions with the team. In the final review, the panel understood the problem and asked deeper questions about implementation."
        }
      },
      {
        id: "behavioral-4",
        prompt: "Give an example of how you handled a tight deadline.",
        feedback: {
          aiFeedback:
            "The answer demonstrates prioritization. Include how you communicated trade-offs and protected quality.",
          strengths: [
            "Shows time management",
            "Explains prioritization",
            "Relevant to project delivery"
          ],
          areasToImprove: [
            "Mention communication with stakeholders",
            "Identify what was deferred",
            "Add the final result"
          ],
          starStructure:
            "Strong Task and Action. Result should include impact or delivery status.",
          improvedAnswer:
            "One week before a milestone, our prototype still needed interview setup and summary screens. I helped the team split must-have and nice-to-have features, focused on the core flow, and posted daily progress updates. We delivered a stable demo on time and documented the postponed features for the next sprint."
        }
      },
      {
        id: "behavioral-5",
        prompt: "Describe a time you took leadership without being assigned as the leader.",
        feedback: {
          aiFeedback:
            "The answer has a strong leadership theme. Make sure it does not sound like you took over; emphasize support and alignment.",
          strengths: [
            "Demonstrates initiative",
            "Shows team awareness",
            "Highlights communication"
          ],
          areasToImprove: [
            "Clarify why leadership was needed",
            "Show how others were included",
            "Explain the final team outcome"
          ],
          starStructure:
            "Situation and Action are effective. Add a more explicit Result and reflection.",
          improvedAnswer:
            "When our team was unsure how to divide frontend tasks, I created a simple task board and proposed ownership areas based on each member's strengths. I checked that everyone agreed before we started. This made our work easier to track and helped us complete the prototype flow with fewer duplicated changes."
        }
      }
    ]
  },
  technical: {
    label: "Technical Interview",
    questions: [
      {
        id: "technical-1",
        prompt:
          "Explain how you would determine whether a string has balanced parentheses.",
        feedback: {
          assessment: "Likely Correct",
          explanation:
            "A stack-based approach is appropriate. Push opening brackets and match them when closing brackets appear.",
          missingPoints: [
            "Mention handling empty input",
            "Return false when a closing bracket appears without a matching opener",
            "Check that the stack is empty at the end"
          ],
          timeComplexity: "O(n), where n is the length of the string.",
          spaceComplexity: "O(n) in the worst case for the stack.",
          suggestedSolution:
            "Iterate through the string, push opening brackets onto a stack, and pop only when the current closing bracket matches the top. The string is balanced if no mismatch occurs and the stack is empty after the loop."
        }
      },
      {
        id: "technical-2",
        prompt:
          "How would you find the first non-repeating character in a string?",
        feedback: {
          assessment: "Partially Correct",
          explanation:
            "Counting character frequency is the right direction. The answer should preserve original order when selecting the first unique character.",
          missingPoints: [
            "Use a second pass through the string",
            "Define behavior when no unique character exists",
            "Discuss case sensitivity if requirements are unclear"
          ],
          timeComplexity: "O(n), using two linear passes.",
          spaceComplexity:
            "O(k), where k is the number of distinct characters stored.",
          suggestedSolution:
            "Build a frequency map, then scan the original string and return the first character with frequency one. If none exists, return a clear sentinel value such as null or -1."
        }
      },
      {
        id: "technical-3",
        prompt:
          "Describe the difference between debouncing and throttling in frontend development.",
        feedback: {
          assessment: "Correct",
          explanation:
            "Debouncing waits until activity stops before running a function. Throttling runs at most once during a defined interval.",
          missingPoints: [
            "Give a concrete example for each",
            "Mention search input for debounce",
            "Mention scroll or resize events for throttle"
          ],
          timeComplexity: "Not applicable.",
          spaceComplexity: "Not applicable.",
          suggestedSolution:
            "Use debounce for events where only the final value matters, such as search input after the user stops typing. Use throttle for continuous events where periodic updates are useful, such as scroll position tracking."
        }
      },
      {
        id: "technical-4",
        prompt:
          "Given an array of integers, explain how you would return two numbers that add up to a target value.",
        feedback: {
          assessment: "Likely Correct",
          explanation:
            "A hash map approach is efficient and avoids the O(n squared) brute force solution.",
          missingPoints: [
            "Clarify whether duplicate values are allowed",
            "Return indices or values based on requirements",
            "Handle cases where no valid pair exists"
          ],
          timeComplexity: "O(n), scanning the array once.",
          spaceComplexity: "O(n), storing previously seen numbers.",
          suggestedSolution:
            "For each number, compute target minus current value. If the complement is already in the map, return the pair. Otherwise, store the current value and continue."
        }
      },
      {
        id: "technical-5",
        prompt:
          "How would you design a frontend state flow for a five-question mock interview?",
        feedback: {
          assessment: "Needs Improvement",
          explanation:
            "A complete answer should describe setup state, current question state, stored answers, feedback state, and completion state.",
          missingPoints: [
            "Mention separating mock data from UI state",
            "Describe how answers are stored by question id",
            "Explain how summary data is generated or received"
          ],
          timeComplexity: "Not applicable.",
          spaceComplexity:
            "O(q + a), where q is question data and a is stored answers.",
          suggestedSolution:
            "Keep interview settings in setup state, store the current question index, save answers in an object keyed by question id, and move to a completed state after the fifth question. Later, replace mock feedback with API responses using the same state boundaries."
        }
      }
    ]
  }
};

export const interviewSummary = {
  overallPerformance:
    "Strong prototype session. The answers show good communication and problem-solving habits, with room to add more measurable results and sharper technical details.",
  strongAreas: [
    "Clear communication",
    "Structured thinking",
    "Good awareness of teamwork and trade-offs"
  ],
  areasToImprove: [
    "Add specific metrics or outcomes",
    "State assumptions before technical answers",
    "Use concise examples that map directly to the question"
  ],
  questionResults: [
    {
      question: "Question 1",
      result: "Strong opening answer with good context."
    },
    {
      question: "Question 2",
      result: "Solid approach; include more implementation detail."
    },
    {
      question: "Question 3",
      result: "Clear explanation with useful examples."
    },
    {
      question: "Question 4",
      result: "Good prioritization; add measurable impact."
    },
    {
      question: "Question 5",
      result: "Needs a stronger closing result and next-step reflection."
    }
  ],
  suggestedNextSteps: [
    "Practice answering in the STAR format with a 90-second target.",
    "Prepare two technical examples that include assumptions, approach, and complexity.",
    "Review feedback after each session and rewrite one improved answer."
  ]
};
