export function createSetupResetState() {
  return {
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
  };
}

export function createModeSessionState(currentSession, nextMode) {
  return {
    interviewMode: nextMode,
    company: currentSession.company,
    position: currentSession.position,
    answerType: "text",
    selectedLanguage: "Python",
    currentQuestion: 0,
    answers: {},
    feedback: {},
    interviewStarted: true,
    interviewCompleted: false,
    showSummary: false
  };
}
