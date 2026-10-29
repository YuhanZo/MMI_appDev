import type { InterviewFeedbackDetail } from '../../types'
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

export default function InterviewFeedback({ feedback }: { feedback: InterviewFeedbackDetail }) {
  return (
    <>
      <h2 className="interview-section-title">Score: {feedback.score}/10</h2>
      <FeedbackBlock title="Feedback">
        <p>{feedback.feedback}</p>
      </FeedbackBlock>
      <FeedbackBlock title="Strengths">
        <BulletList items={feedback.strengths} />
      </FeedbackBlock>
      <FeedbackBlock title="Areas to Improve">
        <BulletList items={feedback.areas_to_improve} />
      </FeedbackBlock>
      <FeedbackBlock title="Improved Answer">
        <p>{feedback.improved_answer}</p>
      </FeedbackBlock>
    </>
  )
}
