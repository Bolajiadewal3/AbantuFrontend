import { useEffect, useState } from "react";
import { apiFetch } from "../utils/api";

interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer?: string;
}

interface Slide {
  id: number;
  title: string;
  content: string;
}

interface CourseDetails {
  id: number;
  title: string;
  passingScorePercentage: number;
  slides: Slide[];
  quizQuestions: Question[];
}

export default function CarerCoursePlayer({
  courseId,
  onBack,
}: {
  courseId: number;
  onBack: () => void;
}) {
  const [course, setCourse] = useState<CourseDetails | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [inQuizMode, setInQuizMode] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [quizError, setQuizError] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quizResult, setQuizResult] = useState<{
    passed: boolean;
    score: number;
  } | null>(null);

  useEffect(() => {
    async function fetchCourse() {
      try {
        const res = await apiFetch(`/api/courses/${courseId}`);
        if (res.ok) {
          const data = await res.json();

          const mappedSlides: Slide[] = (data.slides || []).map((s: any) => ({
            id: s.id,
            title: s.title,
            content: s.contentMarkdown,
          }));

          const mappedQuestions: Question[] = (data.quizQuestions || []).map(
            (q: any) => {
              let parsedOptions = [];
              try {
                parsedOptions =
                  typeof q.optionsJson === "string"
                    ? JSON.parse(q.optionsJson)
                    : q.optionsJson;
              } catch {
                parsedOptions = [];
              }
              return {
                id: q.id,
                text: q.questionText,
                options: parsedOptions,
              };
            },
          );

          setCourse({
            id: data.id,
            title: data.title,
            passingScorePercentage: data.passingScorePercentage,
            slides: mappedSlides,
            quizQuestions: mappedQuestions,
          });

          // Restore saved progress from backend
          if (typeof data.currentSlideIndex === "number") {
            setCurrentSlide(data.currentSlideIndex);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    fetchCourse();
  }, [courseId]);

  const saveProgress = async (newSlideIndex: number) => {
    try {
      await apiFetch(`/api/courses/${courseId}/progress`, {
        method: "POST",
        body: JSON.stringify({ slideIndex: newSlideIndex }),
      });
    } catch (err) {
      console.error("Failed to save progress", err);
    }
  };

  const handleNextSlide = () => {
    if (course && currentSlide < course.slides.length - 1) {
      const nextIndex = currentSlide + 1;
      setCurrentSlide(nextIndex);
      saveProgress(nextIndex);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      const prevIndex = currentSlide - 1;
      setCurrentSlide(prevIndex);
      saveProgress(prevIndex);
    }
  };

  if (loading || !course) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs">
        Loading course materials...
      </div>
    );
  }

  const slides = course.slides || [];
  const questions = course.quizQuestions || [];

  const handleOptionSelect = (questionId: number, optionText: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionText }));
  };

  const handleQuizSubmit = async () => {
    setQuizError("");
    if (questions.length === 0 || Object.keys(answers).length !== questions.length) {
      setQuizError("Please answer every question before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/courses/${courseId}/submit-quiz`, {
        method: "POST",
        body: JSON.stringify(answers),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        setQuizError(error?.message || "The assessment could not be submitted.");
        return;
      }

      const result = await res.json();
      setQuizResult({
        passed: result.passed,
        score: result.scorePercentage,
      });
    } catch {
      setQuizError("Could not submit the assessment. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-slate-100 min-h-screen">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <button
          onClick={() => {
            saveProgress(currentSlide);
            onBack();
          }}
          className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
        >
          ← Back to Portal (Progress Saved)
        </button>
        <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
          {course.title}
        </span>
      </div>

      {quizResult ? (
        <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4">
          {quizResult.passed ? (
            <>
              <div className="text-4xl">🎉</div>
              <h2 className="text-2xl font-bold text-emerald-400">
                Module Passed & Competency Awarded!
              </h2>
              <p className="text-xs text-slate-300">
                You scored {quizResult.score.toFixed(1)}%. Your certificate and
                linked competency have been successfully logged.
              </p>
              <button
                onClick={onBack}
                className="mt-4 px-6 py-2.5 bg-emerald-500 text-slate-950 font-bold rounded-xl text-xs cursor-pointer"
              >
                Return to Dashboard
              </button>
            </>
          ) : (
            <>
              <div className="text-4xl">⚠️</div>
              <h2 className="text-2xl font-bold text-rose-400">
                Requires Retake
              </h2>
              <p className="text-xs text-slate-300">
                You scored {quizResult.score.toFixed(1)}%. Review the slides and
                try again.
              </p>
              <button
                onClick={() => {
                  setQuizResult(null);
                  setInQuizMode(false);
                  setCurrentSlide(0);
                  saveProgress(0);
                }}
                className="mt-4 px-6 py-2.5 bg-slate-800 text-white font-bold rounded-xl text-xs cursor-pointer"
              >
                Review Slides
              </button>
            </>
          )}
        </div>
      ) : !inQuizMode ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6 min-h-[400px] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="text-xs text-slate-500 font-semibold">
              Slide {currentSlide + 1} of {slides.length}
            </div>
            <h2 className="text-xl font-bold text-white">
              {slides[currentSlide]?.title}
            </h2>
            <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
              {slides[currentSlide]?.content}
            </div>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-slate-800">
            <button
              disabled={currentSlide === 0}
              onClick={handlePrevSlide}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-semibold disabled:opacity-30 cursor-pointer"
            >
              Previous
            </button>

            {currentSlide < slides.length - 1 ? (
              <button
                onClick={handleNextSlide}
                className="px-5 py-2 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Next Slide
              </button>
            ) : (
              <button
                onClick={() => setInQuizMode(true)}
                className="px-5 py-2 rounded-xl bg-teal-400 text-slate-950 font-bold text-xs cursor-pointer"
              >
                Take Assessment Quiz →
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
          <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-white">
                Knowledge Assessment
              </h2>
              <p className="text-xs text-slate-400">
                Passing threshold: {course.passingScorePercentage}%
              </p>
            </div>
            <button
              onClick={() => setInQuizMode(false)}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              ← Back to Slides
            </button>
          </div>

          <div className="space-y-6">
            {questions.map((q, idx) => (
              <div key={q.id} className="space-y-3">
                <p className="text-xs font-semibold text-slate-200">
                  {idx + 1}. {q.text}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt, optIdx) => (
                    <label
                      key={optIdx}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${
                        answers[q.id] === opt
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-300"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        checked={answers[q.id] === opt}
                        onChange={() => handleOptionSelect(q.id, opt)}
                        className="hidden"
                      />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {quizError && (
            <p role="alert" className="text-sm text-rose-300">
              {quizError}
            </p>
          )}

          <button
            onClick={handleQuizSubmit}
            disabled={submitting || questions.length === 0 || Object.keys(answers).length !== questions.length}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Submitting Assessment..." : "Submit Assessment"}
          </button>
        </div>
      )}
    </div>
  );
}
