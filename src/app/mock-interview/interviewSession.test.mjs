import assert from "node:assert/strict";
import test from "node:test";

import {
  createModeSessionState,
  createSetupResetState
} from "./interviewSession.mjs";

const activeSession = {
  interviewMode: "behavioral",
  company: "Aivana",
  position: "Software Engineer Intern",
  answerType: "code",
  selectedLanguage: "JavaScript",
  currentQuestion: 4,
  answers: { "behavioral-1": { value: "An answer" } },
  feedback: { "behavioral-1": { aiFeedback: "Mock feedback" } },
  interviewStarted: true,
  interviewCompleted: true,
  showSummary: true
};

test("returning to setup clears all inputs and session progress", () => {
  assert.deepEqual(createSetupResetState(), {
    interviewMode: "behavioral",
    company: "",
    position: "",
    answerType: "text",
    selectedLanguage: "Python",
    currentQuestion: 0,
    answers: {},
    feedback: {},
    interviewStarted: false,
    interviewCompleted: false,
    showSummary: false
  });
});

test("trying the other mode preserves role details and starts a fresh session", () => {
  assert.deepEqual(createModeSessionState(activeSession, "technical"), {
    interviewMode: "technical",
    company: "Aivana",
    position: "Software Engineer Intern",
    answerType: "text",
    selectedLanguage: "Python",
    currentQuestion: 0,
    answers: {},
    feedback: {},
    interviewStarted: true,
    interviewCompleted: false,
    showSummary: false
  });
});
