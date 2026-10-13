import type { DetailedInterviewFeedback } from '../../types'
import type { ReactNode } from 'react'

function FeedbackBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="interview-feedback-block">
      <h3>{title}</h3>
      {children}
    </section>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

export default function InterviewFeedback({ feedback }: { feedback: DetailedInterviewFeedback }) {
  if (feedback.mode === 'behavioral') {
    return (
      <>
        <h2 className="interview-section-title">AI-style Feedback</h2>
        <FeedbackBlock title="Feedback">
          <p>{feedback.ai_feedback}</p>
        </FeedbackBlock>
        <FeedbackBlock title="Strengths">
          <BulletList items={feedback.strengths} />
        </FeedbackBlock>
        <FeedbackBlock title="Areas to Improve">
          <BulletList items={feedback.areas_to_improve} />
        </FeedbackBlock>
        <FeedbackBlock title="STAR Structure Feedback">
          <p>{feedback.star_structure}</p>
        </FeedbackBlock>
        <FeedbackBlock title="Example Improved Answer">
          <p>{feedback.improved_answer}</p>
        </FeedbackBlock>
      </>
    )
  }

  return (
    <>
      <h2 className="interview-section-title">Technical Feedback</h2>
      <FeedbackBlock title="Assessment">
        <span className="interview-assessment-badge">{feedback.assessment}</span>
      </FeedbackBlock>
      <FeedbackBlock title="Explanation">
        <p>{feedback.explanation}</p>
      </FeedbackBlock>
      <FeedbackBlock title="Missing Points">
        <BulletList items={feedback.missing_points} />
      </FeedbackBlock>
      <FeedbackBlock title="Time Complexity">
        <p>{feedback.time_complexity}</p>
      </FeedbackBlock>
      <FeedbackBlock title="Space Complexity">
        <p>{feedback.space_complexity}</p>
      </FeedbackBlock>
      <FeedbackBlock title="Suggested Solution">
        <p>{feedback.suggested_solution}</p>
      </FeedbackBlock>
    </>
  )
}
