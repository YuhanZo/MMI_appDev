"use client";

import { useMemo, useState } from "react";
import { interviewModes, interviewSummary } from "@/data/mockInterviewData";
import {
  createModeSessionState,
  createSetupResetState
} from "./interviewSession.mjs";

const TOTAL_QUESTIONS = 5;

const initialAnswers = {};
const initialFeedback = {};

export default function MockInterviewPage() {
  const [interviewMode, setInterviewMode] = useState("behavioral");
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [answerType, setAnswerType] = useState("text");
  const [selectedLanguage, setSelectedLanguage] = useState("Python");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewCompleted, setInterviewCompleted] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const activeMode = interviewModes[interviewMode];
  const questions = activeMode.questions.slice(0, TOTAL_QUESTIONS);
  const question = questions[currentQuestion];
  const questionNumber = currentQuestion + 1;
  const questionKey = question?.id;
  const currentAnswer = answers[questionKey]?.value ?? "";
  const currentFeedback = feedback[questionKey];
  const progress = (questionNumber / TOTAL_QUESTIONS) * 100;

  const sessionTitle = useMemo(() => {
    const safeCompany = company.trim() || "Selected Company";
    const safePosition = position.trim() || "Selected Position";
    return `${safeCompany} · ${safePosition}`;
  }, [company, position]);

  function applySessionState(nextState) {
    setInterviewMode(nextState.interviewMode);
    setCompany(nextState.company);
    setPosition(nextState.position);
    setAnswerType(nextState.answerType);
    setSelectedLanguage(nextState.selectedLanguage);
    setCurrentQuestion(nextState.currentQuestion);
    setAnswers(nextState.answers);
    setFeedback(nextState.feedback);
    setInterviewStarted(nextState.interviewStarted);
    setInterviewCompleted(nextState.interviewCompleted);
    setShowSummary(nextState.showSummary);
  }

  function resetSession(nextMode = interviewMode) {
    setCurrentQuestion(0);
    setAnswers({});
    setFeedback({});
    setInterviewCompleted(false);
    setShowSummary(false);
    setAnswerType("text");
    setSelectedLanguage("Python");
    setInterviewMode(nextMode);
  }

  function handleModeChange(nextMode) {
    if (interviewStarted) {
      resetSession(nextMode);
      setInterviewStarted(false);
      return;
    }

    setInterviewMode(nextMode);
  }

  function handleStartInterview() {
    resetSession(interviewMode);
    setInterviewStarted(true);
  }

  function handleAnswerChange(value) {
    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [questionKey]: {
        value,
        answerType: interviewMode === "technical" ? answerType : "text",
        language:
          interviewMode === "technical" && answerType === "code"
            ? selectedLanguage
            : null
      }
    }));
  }

  function handleSubmitAnswer() {
    setFeedback((previousFeedback) => ({
      ...previousFeedback,
      [questionKey]: question.feedback
    }));
  }

  function handlePrevious() {
    setCurrentQuestion((previousQuestion) => Math.max(previousQuestion - 1, 0));
  }

  function handleNext() {
    if (currentQuestion === TOTAL_QUESTIONS - 1) {
      setInterviewCompleted(true);
      return;
    }

    setCurrentQuestion((previousQuestion) => previousQuestion + 1);
  }

  function handleGenerateMore() {
    resetSession(interviewMode);
    setInterviewStarted(true);
  }

  function handleBackToSetup() {
    applySessionState(createSetupResetState());
  }

  function handleTryOtherMode() {
    const nextMode = interviewMode === "behavioral" ? "technical" : "behavioral";

    applySessionState(
      createModeSessionState(
        {
          company,
          position
        },
        nextMode
      )
    );
  }

  return (
    <main className="mock-page">
      <div className="mock-shell">
        <header className="page-header">
          <div>
            <p className="eyebrow">Aivana MMI Frontend Prototype</p>
            <h1>Mock Interview</h1>
            <p>
              Practice interview questions with mock AI-style feedback. This
              prototype uses local sample data only and does not call a backend
              service.
            </p>
          </div>
          <div className="header-meta">
            {interviewStarted && (
              <button
                type="button"
                className="ghost-button setup-return-button"
                onClick={handleBackToSetup}
              >
                Back to Interview Setup
              </button>
            )}
            <aside className="status-card" aria-label="Session status">
              <span>Current Mode</span>
              <strong>{activeMode.label}</strong>
            </aside>
          </div>
        </header>

        {!interviewStarted && (
          <section className="panel setup-panel" aria-labelledby="setup-title">
            <h2 id="setup-title" className="section-title">
              Interview Setup
            </h2>
            <div className="setup-grid">
              <div className="field">
                <label htmlFor="company">Company</label>
                <input
                  id="company"
                  type="text"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder="Example: Microsoft"
                />
              </div>
              <div className="field">
                <label htmlFor="position">Position / Job Title</label>
                <input
                  id="position"
                  type="text"
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                  placeholder="Example: Software Engineer Intern"
                />
              </div>
              <div className="field">
                <span className="control-label">Interview Mode</span>
                <div className="mode-group" role="group" aria-label="Interview mode">
                  <button
                    type="button"
                    className={`mode-button ${
                      interviewMode === "behavioral" ? "active" : ""
                    }`}
                    onClick={() => handleModeChange("behavioral")}
                  >
                    Behavioral Interview
                  </button>
                  <button
                    type="button"
                    className={`mode-button ${
                      interviewMode === "technical" ? "active" : ""
                    }`}
                    onClick={() => handleModeChange("technical")}
                  >
                    Technical Interview
                  </button>
                </div>
              </div>
            </div>
            <div className="setup-actions">
              <button
                type="button"
                className="primary-button"
                onClick={handleStartInterview}
              >
                Start Interview
              </button>
            </div>
          </section>
        )}

        {interviewStarted && !interviewCompleted && (
          <section className="interview-layout" aria-label="Interview session">
            <div className="panel interview-main">
              <div className="context-row">
                <span className="pill">{sessionTitle}</span>
                <span className="pill">{activeMode.label}</span>
              </div>

              <div className="question-topline">
                <p className="question-count">
                  Question {questionNumber} of {TOTAL_QUESTIONS}
                </p>
                <div
                  className="progress-track"
                  aria-label={`Interview progress ${Math.round(progress)} percent`}
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <h2 className="question-text">{question.prompt}</h2>

              <div className="answer-controls">
                {interviewMode === "technical" && (
                  <>
                    <div className="field">
                      <span className="control-label">Answer Type</span>
                      <div
                        className="answer-type-group"
                        role="group"
                        aria-label="Answer type"
                      >
                        <button
                          type="button"
                          className={`answer-type-button ${
                            answerType === "text" ? "active" : ""
                          }`}
                          onClick={() => setAnswerType("text")}
                        >
                          Text / Explanation
                        </button>
                        <button
                          type="button"
                          className={`answer-type-button ${
                            answerType === "code" ? "active" : ""
                          }`}
                          onClick={() => setAnswerType("code")}
                        >
                          Code
                        </button>
                      </div>
                    </div>

                    {answerType === "code" && (
                      <div className="technical-toolbar">
                        <p className="assessment-note">
                          AI Assessment Only — Code has not been executed
                          against real test cases.
                        </p>
                        <div className="field">
                          <label htmlFor="language">Programming Language</label>
                          <select
                            id="language"
                            value={selectedLanguage}
                            onChange={(event) =>
                              setSelectedLanguage(event.target.value)
                            }
                          >
                            <option>Python</option>
                            <option>Java</option>
                            <option>C++</option>
                            <option>JavaScript</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="field">
                  <label htmlFor="answer">
                    {answerType === "code" && interviewMode === "technical"
                      ? "Code Answer"
                      : "Your Answer"}
                  </label>
                  {answerType === "code" && interviewMode === "technical" ? (
                    <textarea
                      id="answer"
                      className="code-editor"
                      value={currentAnswer}
                      onChange={(event) => handleAnswerChange(event.target.value)}
                      spellCheck="false"
                      placeholder="Write your solution or pseudocode here."
                    />
                  ) : (
                    <textarea
                      id="answer"
                      value={currentAnswer}
                      onChange={(event) => handleAnswerChange(event.target.value)}
                      placeholder="Type your response here."
                    />
                  )}
                </div>
              </div>

              <div className="interview-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleSubmitAnswer}
                >
                  Submit Answer
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handlePrevious}
                  disabled={currentQuestion === 0}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleNext}
                >
                  {currentQuestion === TOTAL_QUESTIONS - 1
                    ? "Finish Interview"
                    : "Next Question"}
                </button>
              </div>
            </div>

            <aside className="panel feedback-panel" aria-label="Interview feedback">
              {currentFeedback ? (
                interviewMode === "behavioral" ? (
                  <BehavioralFeedback feedback={currentFeedback} />
                ) : (
                  <TechnicalFeedback feedback={currentFeedback} />
                )
              ) : (
                <div className="feedback-empty">
                  <h2 className="section-title">Feedback Preview</h2>
                  <p>
                    Submit an answer to display mock AI-style feedback for this
                    question.
                  </p>
                </div>
              )}
            </aside>
          </section>
        )}

        {interviewStarted && interviewCompleted && !showSummary && (
          <section className="panel completion-panel" aria-label="Interview complete">
            <h2>Interview Complete</h2>
            <p>
              You completed five mock questions for {sessionTitle}. Continue
              practicing with another set or review the sample summary.
            </p>
            <div className="completion-actions">
              <button
                type="button"
                className="primary-button"
                onClick={handleGenerateMore}
              >
                Generate 5 More Questions
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setShowSummary(true)}
              >
                View Interview Summary
              </button>
            </div>
          </section>
        )}

        {interviewStarted && interviewCompleted && showSummary && (
          <InterviewSummary
            summary={interviewSummary}
            interviewMode={interviewMode}
            onTryOtherMode={handleTryOtherMode}
          />
        )}
      </div>
    </main>
  );
}

function BehavioralFeedback({ feedback }) {
  return (
    <>
      <h2 className="section-title">AI Feedback</h2>
      <FeedbackBlock title="AI Feedback">
        <p>{feedback.aiFeedback}</p>
      </FeedbackBlock>
      <FeedbackBlock title="Strengths">
        <BulletList items={feedback.strengths} />
      </FeedbackBlock>
      <FeedbackBlock title="Areas to Improve">
        <BulletList items={feedback.areasToImprove} />
      </FeedbackBlock>
      <FeedbackBlock title="STAR Structure Feedback">
        <p>{feedback.starStructure}</p>
      </FeedbackBlock>
      <FeedbackBlock title="Example Improved Answer">
        <p>{feedback.improvedAnswer}</p>
      </FeedbackBlock>
    </>
  );
}

function TechnicalFeedback({ feedback }) {
  return (
    <>
      <h2 className="section-title">Technical Feedback</h2>
      <FeedbackBlock title="Assessment">
        <span className="assessment-badge">{feedback.assessment}</span>
      </FeedbackBlock>
      <FeedbackBlock title="Explanation">
        <p>{feedback.explanation}</p>
      </FeedbackBlock>
      <FeedbackBlock title="Missing Points">
        <BulletList items={feedback.missingPoints} />
      </FeedbackBlock>
      <FeedbackBlock title="Time Complexity">
        <p>{feedback.timeComplexity}</p>
      </FeedbackBlock>
      <FeedbackBlock title="Space Complexity">
        <p>{feedback.spaceComplexity}</p>
      </FeedbackBlock>
      <FeedbackBlock title="Suggested Solution">
        <p>{feedback.suggestedSolution}</p>
      </FeedbackBlock>
    </>
  );
}

function FeedbackBlock({ title, children }) {
  return (
    <section className="feedback-block">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function BulletList({ items }) {
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function InterviewSummary({ summary, interviewMode, onTryOtherMode }) {
  const otherModeLabel =
    interviewMode === "behavioral" ? "Technical" : "Behavioral";

  return (
    <section className="panel summary-panel" aria-label="Interview summary">
      <h2>Interview Summary</h2>
      <p>{summary.overallPerformance}</p>

      <div className="summary-grid">
        <section className="summary-section">
          <h3>Strong Areas</h3>
          <ul className="summary-list">
            {summary.strongAreas.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="summary-section">
          <h3>Areas to Improve</h3>
          <ul className="summary-list">
            {summary.areasToImprove.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="summary-section full">
          <h3>Question-by-Question Results</h3>
          <ul className="result-list">
            {summary.questionResults.map((item) => (
              <li key={item.question}>
                <strong>{item.question}</strong>
                <span>{item.result}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="summary-section full">
          <h3>Suggested Next Steps</h3>
          <ul className="summary-list">
            {summary.suggestedNextSteps.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <div className="summary-actions">
        <button
          type="button"
          className="primary-button"
          onClick={onTryOtherMode}
        >
          Try {otherModeLabel} Interview
        </button>
      </div>
    </section>
  );
}
