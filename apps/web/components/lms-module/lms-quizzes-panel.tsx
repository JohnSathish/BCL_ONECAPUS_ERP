'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { withApiStartupRetry } from '@/lib/http/wait-for-api';
import {
  addLmsQuizQuestion,
  closeLmsQuiz,
  createLmsQuiz,
  fetchLmsQuizAttempts,
  fetchLmsQuizQuestions,
  fetchLmsQuizzes,
  publishLmsQuiz,
  startLmsQuizAttempt,
  submitLmsQuizAttempt,
  type LmsQuiz,
  type LmsQuizQuestion,
} from '@/services/lms';

type Props = {
  workspaceId: string;
  viewerRole?: 'admin' | 'faculty' | 'student';
};

export function LmsQuizzesPanel({ workspaceId, viewerRole = 'admin' }: Props) {
  const qc = useQueryClient();
  const isStudent = viewerRole === 'student';
  const [title, setTitle] = useState('');
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [prompt, setPrompt] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [activeAttempt, setActiveAttempt] = useState<{
    attemptId: string;
    quizId: string;
    quizTitle: string;
    timeLimitMinutes?: number | null;
    questions: LmsQuizQuestion[];
    startedAt: number;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitMessage, setSubmitMessage] = useState('');

  const quizzes = useQuery({
    queryKey: ['lms', 'quizzes', workspaceId],
    queryFn: () => withApiStartupRetry(() => fetchLmsQuizzes(workspaceId)),
    enabled: Boolean(workspaceId),
  });

  const questions = useQuery({
    queryKey: ['lms', 'quiz-questions', selectedQuizId],
    queryFn: () => withApiStartupRetry(() => fetchLmsQuizQuestions(selectedQuizId)),
    enabled: Boolean(selectedQuizId),
  });

  const attempts = useQuery({
    queryKey: ['lms', 'quiz-attempts', selectedQuizId],
    queryFn: () => withApiStartupRetry(() => fetchLmsQuizAttempts(selectedQuizId)),
    enabled: Boolean(selectedQuizId) && !isStudent,
  });

  const createQuiz = useMutation({
    mutationFn: () =>
      createLmsQuiz(workspaceId, {
        title: title.trim(),
        maxAttempts: 1,
        timeLimitMinutes: 30,
      } as Partial<LmsQuiz>),
    onSuccess: () => {
      setTitle('');
      void qc.invalidateQueries({ queryKey: ['lms', 'quizzes', workspaceId] });
    },
  });

  const addQuestion = useMutation({
    mutationFn: () =>
      addLmsQuizQuestion(selectedQuizId, {
        prompt: prompt.trim(),
        options: [optionA.trim(), optionB.trim()].filter(Boolean),
        correctAnswer: correctAnswer.trim(),
        marks: 1,
      }),
    onSuccess: () => {
      setPrompt('');
      setOptionA('');
      setOptionB('');
      setCorrectAnswer('');
      void qc.invalidateQueries({ queryKey: ['lms', 'quiz-questions', selectedQuizId] });
      void qc.invalidateQueries({ queryKey: ['lms', 'quizzes', workspaceId] });
    },
  });

  const publishQuiz = useMutation({
    mutationFn: (id: string) => publishLmsQuiz(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lms', 'quizzes', workspaceId] }),
  });

  const closeQuiz = useMutation({
    mutationFn: (id: string) => closeLmsQuiz(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['lms', 'quizzes', workspaceId] }),
  });

  const list = quizzes.data ?? [];

  const startAttempt = useMutation({
    mutationFn: (quizId: string) => startLmsQuizAttempt(quizId),
    onSuccess: (result, quizId) => {
      const quiz = list.find((row) => row.id === quizId);
      setActiveAttempt({
        attemptId: result.attempt.id,
        quizId,
        quizTitle: quiz?.title ?? 'Quiz',
        timeLimitMinutes: result.timeLimitMinutes,
        questions: result.questions,
        startedAt: Date.now(),
      });
      setAnswers({});
      setSubmitMessage('');
    },
  });

  const submitAttempt = useMutation({
    mutationFn: () =>
      submitLmsQuizAttempt(
        activeAttempt!.attemptId,
        Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer })),
      ),
    onSuccess: (result) => {
      setSubmitMessage(`Submitted · Score ${result.score ?? 0}/${result.maxScore ?? '—'}`);
      setActiveAttempt(null);
      void qc.invalidateQueries({ queryKey: ['lms', 'quizzes', workspaceId] });
    },
  });

  const selectedQuiz = useMemo(
    () => list.find((quiz) => quiz.id === selectedQuizId),
    [list, selectedQuizId],
  );

  return (
    <div className="space-y-4">
      {!isStudent ? (
        <CompactCard>
          <CompactCardHeader
            title="Create quiz"
            description="Draft quizzes, add MCQ questions, then publish."
          />
          <CompactCardBody className="flex flex-wrap gap-2">
            <Input
              placeholder="Quiz title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="max-w-sm"
            />
            <Button
              type="button"
              disabled={!title.trim() || createQuiz.isPending}
              onClick={() => createQuiz.mutate()}
            >
              Create draft
            </Button>
          </CompactCardBody>
        </CompactCard>
      ) : null}

      <CompactCard>
        <CompactCardHeader title="Quizzes" description={`${list.length} in this workspace`} />
        <CompactCardBody className="space-y-3">
          {list.map((quiz) => (
            <div key={quiz.id} className="rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{quiz.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {quiz.status} · {quiz._count?.questions ?? 0} questions ·{' '}
                    {quiz._count?.attempts ?? 0} attempts
                  </p>
                </div>
                <div className="flex gap-2">
                  {isStudent && quiz.status === 'PUBLISHED' && !quiz.myAttempt ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => startAttempt.mutate(quiz.id)}
                      disabled={startAttempt.isPending}
                    >
                      Start quiz
                    </Button>
                  ) : null}
                  {isStudent && quiz.myAttempt ? (
                    <span className="text-xs text-muted-foreground self-center">
                      {quiz.myAttempt.status} · {quiz.myAttempt.score ?? '—'}/
                      {quiz.myAttempt.maxScore ?? '—'}
                    </span>
                  ) : null}
                  {!isStudent ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedQuizId(quiz.id)}
                    >
                      Manage
                    </Button>
                  ) : null}
                  {!isStudent && quiz.status === 'DRAFT' ? (
                    <Button type="button" size="sm" onClick={() => publishQuiz.mutate(quiz.id)}>
                      Publish
                    </Button>
                  ) : null}
                  {!isStudent && quiz.status === 'PUBLISHED' ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => closeQuiz.mutate(quiz.id)}
                    >
                      Close
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          {!quizzes.isLoading && !list.length ? (
            <p className="text-sm text-muted-foreground">No quizzes in this workspace yet.</p>
          ) : null}
        </CompactCardBody>
      </CompactCard>

      {activeAttempt ? (
        <StudentQuizRunner
          attempt={activeAttempt}
          answers={answers}
          setAnswers={setAnswers}
          onSubmit={() => submitAttempt.mutate()}
          submitting={submitAttempt.isPending}
          message={submitMessage}
        />
      ) : null}

      {selectedQuiz && !isStudent ? (
        <CompactCard>
          <CompactCardHeader title={`Questions · ${selectedQuiz.title}`} />
          <CompactCardBody className="space-y-3">
            <Input
              placeholder="Question prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <div className="grid gap-2 md:grid-cols-2">
              <Input
                placeholder="Option A"
                value={optionA}
                onChange={(e) => setOptionA(e.target.value)}
              />
              <Input
                placeholder="Option B"
                value={optionB}
                onChange={(e) => setOptionB(e.target.value)}
              />
            </div>
            <Input
              placeholder="Correct answer (match option text)"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
            />
            <Button
              type="button"
              disabled={!prompt.trim() || !correctAnswer.trim() || addQuestion.isPending}
              onClick={() => addQuestion.mutate()}
            >
              Add question
            </Button>
            <ul className="space-y-2 text-sm">
              {(questions.data ?? []).map((question, index) => (
                <li key={question.id} className="rounded-md border border-border px-3 py-2">
                  {index + 1}. {question.prompt}
                </li>
              ))}
            </ul>
          </CompactCardBody>
        </CompactCard>
      ) : null}

      {selectedQuiz && !isStudent ? (
        <CompactCard>
          <CompactCardHeader title="Student attempts" />
          <CompactCardBody className="space-y-2 text-sm">
            {(attempts.data ?? []).map((attempt) => (
              <div
                key={attempt.id}
                className="flex justify-between rounded-md border border-border px-3 py-2"
              >
                <span>
                  {attempt.student?.masterProfile?.fullName ??
                    attempt.student?.enrollmentNumber ??
                    'Student'}
                </span>
                <span>
                  {attempt.status} · {attempt.score ?? '—'}/{attempt.maxScore ?? '—'}
                </span>
              </div>
            ))}
          </CompactCardBody>
        </CompactCard>
      ) : null}
    </div>
  );
}

function StudentQuizRunner({
  attempt,
  answers,
  setAnswers,
  onSubmit,
  submitting,
  message,
}: {
  attempt: {
    quizTitle: string;
    timeLimitMinutes?: number | null;
    questions: LmsQuizQuestion[];
    startedAt: number;
  };
  answers: Record<string, string>;
  setAnswers: (value: Record<string, string>) => void;
  onSubmit: () => void;
  submitting: boolean;
  message: string;
}) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(
    attempt.timeLimitMinutes ? attempt.timeLimitMinutes * 60 : null,
  );

  useEffect(() => {
    if (!attempt.timeLimitMinutes) return;
    const tick = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - attempt.startedAt) / 1000);
      const remaining = attempt.timeLimitMinutes! * 60 - elapsed;
      setSecondsLeft(Math.max(0, remaining));
      if (remaining <= 0) onSubmit();
    }, 1000);
    return () => window.clearInterval(tick);
  }, [attempt.startedAt, attempt.timeLimitMinutes, onSubmit]);

  return (
    <CompactCard>
      <CompactCardHeader
        title={`Taking · ${attempt.quizTitle}`}
        description={
          secondsLeft != null
            ? `Time left: ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`
            : 'No time limit'
        }
      />
      <CompactCardBody className="space-y-4">
        {attempt.questions.map((question, index) => {
          const options = Array.isArray(question.options) ? question.options : [];
          return (
            <div key={question.id} className="rounded-lg border border-border p-3">
              <p className="font-medium">
                {index + 1}. {question.prompt}
              </p>
              <div className="mt-2 space-y-1">
                {options.map((option) => (
                  <label key={option} className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name={question.id}
                      checked={answers[question.id] === option}
                      onChange={() => setAnswers({ ...answers, [question.id]: option })}
                    />
                    {option}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
        <Button type="button" onClick={onSubmit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit quiz'}
        </Button>
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      </CompactCardBody>
    </CompactCard>
  );
}
