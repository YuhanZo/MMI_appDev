import type { InterviewFeedbackDetail, InterviewQuestion } from '../../types'

interface InterviewProgressProps {
  questions: InterviewQuestion[]
  questionIndex: number
  feedback: Record<string, InterviewFeedbackDetail>
}

export default function InterviewProgress({
  questions,
  questionIndex,
  feedback,
}: InterviewProgressProps) {
  const completedCount = questions.filter((question) => feedback[question.id]).length
  const totalScore = questions.reduce(
    (total, question) => total + (feedback[question.id]?.score ?? 0),
    0,
  )
  const maximumScore = questions.length * 10
  const progress = questions.length === 0 ? 0 : (completedCount / questions.length) * 100
  const currentQuestion = Math.min(questionIndex + 1, questions.length)

  return (
    <aside
      className="interview-panel interview-progress-panel"
      aria-label="Interview progress"
    >
      <h2>Interview Progress</h2>
      <p className="interview-question-count">
        Question {currentQuestion} of {questions.length}
      </p>

      <div
        className="interview-progress-track"
        role="progressbar"
        aria-label={`${completedCount} of ${questions.length} questions completed`}
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={completedCount}
      >
        <div className="interview-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <ul className="interview-score-list">
        {questions.map((question, index) => {
          const result = feedback[question.id]
          return (
            <li key={question.id}>
              <span>Question {index + 1}</span>
              <strong>{result ? `${result.score}/10` : 'Pending'}</strong>
            </li>
          )
        })}
      </ul>

      <div className="interview-total-score">
        <span>Total Score</span>
        <strong>{totalScore}/{maximumScore}</strong>
      </div>
    </aside>
  )
}

