import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";

// --- Interfaces matching backend domain models ---
interface ImageHotspot {
  xPercent: number;
  yPercent: number;
  label: string;
  tooltipText: string;
}

interface CourseSlide {
  slideNumber: number;
  title: string;
  type: number; // 0 = Standard, 1 = InteractiveImage, 2 = ReflectionPrompt, 3 = InlineQuizCheck
  contentMarkdown: string;
  mediaUrl: string;
  hotspots: ImageHotspot[];
  textPromptQuestion: string;
  placeholderText: string;
  minimumTimeSeconds: number;
  requiresVideoCompletion: boolean;
}

interface CourseQuizQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
}

interface Competency {
  id: number;
  name: string;
}

export default function AdminCreateCourse({
  onCourseCreated,
}: {
  onCourseCreated?: () => void;
}) {
  const navigate = useNavigate();

  const handleCancel = () => {
    if (onCourseCreated) {
      onCourseCreated();
    } else {
      navigate("/elearning/dashboard");
    }
  };

  // Wizard Step State (1: Metadata, 2: Slides, 3: Quiz Pool, 4: Review)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // --- Main Form State ---
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [passingScorePercentage, setPassingScorePercentage] =
    useState<number>(80);
  const [validityMonths, setValidityMonths] = useState<number>(12);
  const [questionsToServe, setQuestionsToServe] = useState<number>(10);
  const [linkedCompetencyId, setLinkedCompetencyId] = useState<number | "">("");
  const [competencies, setCompetencies] = useState<Competency[]>([]);

  useEffect(() => {
    // Fetch available competencies for dropdown selection
    apiFetch("/api/competencies")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setCompetencies(data))
      .catch(() => {});
  }, []);

  // --- Slides State ---
  const [slides, setSlides] = useState<CourseSlide[]>([
    {
      slideNumber: 1,
      title: "Introduction",
      type: 0,
      contentMarkdown:
        "Welcome to this training module. Please read through all materials carefully.",
      mediaUrl: "",
      hotspots: [],
      textPromptQuestion: "",
      placeholderText: "",
      minimumTimeSeconds: 10,
      requiresVideoCompletion: false,
    },
  ]);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);

  // --- Quiz Questions State ---
  const [quizQuestions, setQuizQuestions] = useState<CourseQuizQuestion[]>([
    {
      questionText: "",
      options: ["", "", "", ""],
      correctAnswer: "",
    },
  ]);

  // ----------------------------------------------------
  // Slide Helper Methods
  // ----------------------------------------------------
  const addSlide = () => {
    const newSlide: CourseSlide = {
      slideNumber: slides.length + 1,
      title: `Slide ${slides.length + 1}`,
      type: 0,
      contentMarkdown: "",
      mediaUrl: "",
      hotspots: [],
      textPromptQuestion: "",
      placeholderText: "",
      minimumTimeSeconds: 5,
      requiresVideoCompletion: false,
    };
    setSlides([...slides, newSlide]);
    setActiveSlideIndex(slides.length);
  };

  const removeSlide = (index: number) => {
    if (slides.length === 1) return;
    const updated = slides
      .filter((_, i) => i !== index)
      .map((s, idx) => ({ ...s, slideNumber: idx + 1 }));
    setSlides(updated);
    setActiveSlideIndex(Math.max(0, index - 1));
  };

  const updateActiveSlide = (fields: Partial<CourseSlide>) => {
    const updated = [...slides];
    updated[activeSlideIndex] = { ...updated[activeSlideIndex], ...fields };
    setSlides(updated);
  };

  const handleImageClickForHotspot = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    const currentSlide = slides[activeSlideIndex];
    const newHotspot: ImageHotspot = {
      xPercent: x,
      yPercent: y,
      label: `Hotspot ${currentSlide.hotspots.length + 1}`,
      tooltipText: "Key instruction details here...",
    };

    updateActiveSlide({
      hotspots: [...currentSlide.hotspots, newHotspot],
    });
  };

  const removeHotspot = (hotspotIdx: number) => {
    const currentSlide = slides[activeSlideIndex];
    const updated = currentSlide.hotspots.filter((_, i) => i !== hotspotIdx);
    updateActiveSlide({ hotspots: updated });
  };

  // ----------------------------------------------------
  // Quiz Pool Helper Methods
  // ----------------------------------------------------
  const addQuizQuestion = () => {
    setQuizQuestions([
      ...quizQuestions,
      {
        questionText: "",
        options: ["", "", "", ""],
        correctAnswer: "",
      },
    ]);
  };

  const removeQuizQuestion = (qIndex: number) => {
    if (quizQuestions.length === 1) return;
    setQuizQuestions(quizQuestions.filter((_, i) => i !== qIndex));
  };

  const updateQuestion = (
    qIndex: number,
    field: keyof CourseQuizQuestion,
    value: any,
  ) => {
    const updated = [...quizQuestions];
    updated[qIndex] = { ...updated[qIndex], [field]: value };
    setQuizQuestions(updated);
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const updated = [...quizQuestions];
    const options = [...updated[qIndex].options];
    options[optIndex] = value;
    updated[qIndex] = { ...updated[qIndex], options };
    setQuizQuestions(updated);
  };

  // ----------------------------------------------------
  // Submit Course Payload
  // ----------------------------------------------------
  const handleSubmitCourse = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setSubmitting(true);

    const formattedQuestions = quizQuestions.map((q) => ({
      questionText: q.questionText,
      optionsJson: JSON.stringify(q.options.filter((o) => o.trim() !== "")),
      correctAnswer: q.correctAnswer,
    }));

    const payload = {
      title,
      description,
      passingScorePercentage,
      validityMonths: validityMonths || null,
      questionsToServe,
      linkedCompetencyId:
        linkedCompetencyId !== "" ? Number(linkedCompetencyId) : null,
      slides,
      quizQuestions: formattedQuestions,
    };

    try {
      const res = await apiFetch("/api/courses/admin/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSuccessMsg("Course created and published successfully!");
        if (onCourseCreated) onCourseCreated();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.message || "Failed to create course.");
      }
    } catch {
      setErrorMsg("An unexpected network error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const currentSlide = slides[activeSlideIndex] || slides[0];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8 bg-slate-950 text-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Course Authoring Tool
          </span>
          <h1 className="text-2xl font-extrabold text-white">
            Create New E-Learning Module
          </h1>
        </div>
        <button
          onClick={handleCancel}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
        >
          Cancel
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs sm:text-sm">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs sm:text-sm font-semibold">
          {successMsg}
        </div>
      )}

      {/* Stepper Navigation */}
      <div className="grid grid-cols-4 gap-2 p-1.5 bg-slate-900/90 border border-slate-800 rounded-2xl text-xs font-semibold text-center">
        {[
          { step: 1, label: "1. Course Settings" },
          { step: 2, label: "2. Slide Deck" },
          { step: 3, label: "3. Quiz Pool" },
          { step: 4, label: "4. Review & Publish" },
        ].map((s) => (
          <button
            key={s.step}
            onClick={() => setCurrentStep(s.step as any)}
            className={`py-2.5 rounded-xl transition cursor-pointer ${
              currentStep === s.step
                ? "bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ================= STEP 1: METADATA & RULES ================= */}
      {currentStep === 1 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6 backdrop-blur-md">
          <h2 className="text-base font-bold text-white border-b border-slate-800 pb-3">
            Course Metadata & Compliance Rules
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4 md:col-span-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Course Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Annual Safeguarding & Duty of Care"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Course Description
                </label>
                <textarea
                  rows={3}
                  placeholder="Summary of module objectives and target audience..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Passing Threshold (%)
              </label>
              <input
                type="number"
                min={50}
                max={100}
                value={passingScorePercentage}
                onChange={(e) =>
                  setPassingScorePercentage(Number(e.target.value))
                }
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Minimum score required to issue a certificate.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Validity Duration (Months)
              </label>
              <input
                type="number"
                min={1}
                max={36}
                value={validityMonths}
                onChange={(e) => setValidityMonths(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Months until the certificate expires (12 = Annual Retraining).
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Questions Served Per Attempt
              </label>
              <input
                type="number"
                min={1}
                value={questionsToServe}
                onChange={(e) => setQuestionsToServe(Number(e.target.value))}
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Randomized subset drawn from question pool to prevent answer
                sharing.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Linked Competency Framework (Optional)
              </label>
              <select
                value={linkedCompetencyId}
                onChange={(e) =>
                  setLinkedCompetencyId(
                    e.target.value ? Number(e.target.value) : "",
                  )
                }
                className="w-full rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                <option value="">-- None (Standalone Course) --</option>
                {competencies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Links completion to practical observation matrices.
              </p>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => setCurrentStep(2)}
              disabled={!title.trim()}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition cursor-pointer"
            >
              Continue to Slide Deck Builder ➔
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: SLIDE DECK BUILDER ================= */}
      {currentStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Slide Navigator Sidebar */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Slides ({slides.length})
              </h3>
              <button
                onClick={addSlide}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-semibold text-xs transition cursor-pointer"
              >
                + Add Slide
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {slides.map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveSlideIndex(idx)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between ${
                    activeSlideIndex === idx
                      ? "bg-emerald-500/10 border-emerald-500/40 text-white font-bold"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="truncate">
                    {idx + 1}. {s.title || "Untitled Slide"}
                  </span>
                  {slides.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSlide(idx);
                      }}
                      className="text-rose-400 hover:text-rose-300 ml-2 px-1"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Active Slide Editor */}
          <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-4 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold text-white">
                Editing Slide {activeSlideIndex + 1} of {slides.length}
              </h2>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Slide Title *
                  </label>
                  <input
                    type="text"
                    value={currentSlide.title}
                    onChange={(e) =>
                      updateActiveSlide({ title: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Slide Interaction Type
                  </label>
                  <select
                    value={currentSlide.type}
                    onChange={(e) =>
                      updateActiveSlide({ type: Number(e.target.value) })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  >
                    <option value={0}>Standard Reading / Video Slide</option>
                    <option value={1}>Interactive Image Hotspot Slide</option>
                    <option value={2}>Reflection Prompt (Open Text)</option>
                    <option value={3}>Inline Knowledge Check Quiz</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Content Markdown
                </label>
                <textarea
                  rows={5}
                  value={currentSlide.contentMarkdown}
                  onChange={(e) =>
                    updateActiveSlide({ contentMarkdown: e.target.value })
                  }
                  placeholder="Supports Markdown formatting..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Media URL (Video / Image Asset)
                </label>
                <input
                  type="text"
                  value={currentSlide.mediaUrl}
                  onChange={(e) =>
                    updateActiveSlide({ mediaUrl: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>

              {/* Conditional Hotspot Builder for Type 1 */}
              {currentSlide.type === 1 && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3">
                  <h4 className="font-bold text-emerald-400">
                    Interactive Image Hotspots
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Provide a media image URL above, then click on the preview
                    area below to drop a coordinate hotspot.
                  </p>
                  {currentSlide.mediaUrl ? (
                    <div
                      onClick={handleImageClickForHotspot}
                      className="relative inline-block cursor-crosshair max-w-full overflow-hidden rounded-lg border border-slate-700"
                    >
                      <img
                        src={currentSlide.mediaUrl}
                        alt="Preview"
                        className="max-h-60 object-contain pointer-events-none"
                      />
                      {currentSlide.hotspots.map((h, hIdx) => (
                        <div
                          key={hIdx}
                          style={{
                            top: `${h.yPercent}%`,
                            left: `${h.xPercent}%`,
                          }}
                          className="absolute w-4 h-4 -ml-2 -mt-2 bg-emerald-500 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[9px] font-bold text-slate-950"
                        >
                          {hIdx + 1}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-500 border border-dashed border-slate-800 rounded-lg">
                      Enter a valid Media Image URL above to activate hotspot
                      placement.
                    </div>
                  )}

                  {/* List current hotspots */}
                  <div className="space-y-2 mt-3">
                    {currentSlide.hotspots.map((h, hIdx) => (
                      <div
                        key={hIdx}
                        className="flex items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800"
                      >
                        <span className="font-bold text-emerald-400">
                          #{hIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={h.label}
                          onChange={(e) => {
                            const updatedHs = [...currentSlide.hotspots];
                            updatedHs[hIdx].label = e.target.value;
                            updateActiveSlide({ hotspots: updatedHs });
                          }}
                          placeholder="Hotspot label"
                          className="bg-slate-950 border border-slate-800 px-2 py-1 rounded text-white flex-1"
                        />
                        <input
                          type="text"
                          value={h.tooltipText}
                          onChange={(e) => {
                            const updatedHs = [...currentSlide.hotspots];
                            updatedHs[hIdx].tooltipText = e.target.value;
                            updateActiveSlide({ hotspots: updatedHs });
                          }}
                          placeholder="Tooltip info description"
                          className="bg-slate-950 border border-slate-800 px-2 py-1 rounded text-white flex-1"
                        />
                        <button
                          type="button"
                          onClick={() => removeHotspot(hIdx)}
                          className="text-rose-400 hover:text-rose-300 px-2"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Minimum Time Required (Seconds)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={currentSlide.minimumTimeSeconds}
                    onChange={(e) =>
                      updateActiveSlide({
                        minimumTimeSeconds: Number(e.target.value),
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentSlide.requiresVideoCompletion}
                      onChange={(e) =>
                        updateActiveSlide({
                          requiresVideoCompletion: e.target.checked,
                        })
                      }
                      className="rounded bg-slate-950 border-slate-800 text-emerald-500 focus:ring-0"
                    />
                    <span className="text-slate-300 font-medium">
                      Require full video playback before advancing
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-800">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition cursor-pointer"
              >
                ← Back
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition cursor-pointer"
              >
                Continue to Quiz Pool ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= STEP 3: QUIZ POOL BUILDER ================= */}
      {currentStep === 3 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white">
                Summative Assessment Question Pool ({quizQuestions.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Questions will be drawn randomly per attempt based on the
                settings specified in Step 1.
              </p>
            </div>
            <button
              onClick={addQuizQuestion}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-semibold text-xs transition cursor-pointer"
            >
              + Add Question
            </button>
          </div>

          <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2">
            {quizQuestions.map((q, qIndex) => (
              <div
                key={qIndex}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-400">
                    Question #{qIndex + 1}
                  </span>
                  {quizQuestions.length > 1 && (
                    <button
                      onClick={() => removeQuizQuestion(qIndex)}
                      className="text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      Remove Question
                    </button>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Question Text *
                  </label>
                  <input
                    type="text"
                    value={q.questionText}
                    onChange={(e) =>
                      updateQuestion(qIndex, "questionText", e.target.value)
                    }
                    placeholder="e.g. What is the immediate action required when..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block font-medium text-slate-300">
                    Multiple Choice Options (Select correct answer below)
                  </label>
                  {q.options.map((opt, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={q.correctAnswer === opt && opt.trim() !== ""}
                        onChange={() =>
                          updateQuestion(qIndex, "correctAnswer", opt)
                        }
                        className="text-emerald-500 bg-slate-900 border-slate-800"
                        title="Mark as correct answer"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) =>
                          updateOption(qIndex, optIdx, e.target.value)
                        }
                        placeholder={`Option ${optIdx + 1}`}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
            >
              ← Back to Slides
            </button>
            <button
              onClick={() => setCurrentStep(4)}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer"
            >
              Continue to Review ➔
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 4: REVIEW & PUBLISH ================= */}
      {currentStep === 4 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 space-y-6 backdrop-blur-md">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white">
              Review Course & Publish
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Verify all module parameters before publishing live to carers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h3 className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                Metadata Summary
              </h3>
              <div className="space-y-1.5 text-slate-300">
                <p>
                  <strong className="text-white">Title:</strong>{" "}
                  {title || "N/A"}
                </p>
                <p>
                  <strong className="text-white">Description:</strong>{" "}
                  {description || "No description provided."}
                </p>
                <p>
                  <strong className="text-white">Passing Score:</strong>{" "}
                  {passingScorePercentage}%
                </p>
                <p>
                  <strong className="text-white">Validity Duration:</strong>{" "}
                  {validityMonths} Months
                </p>
                <p>
                  <strong className="text-white">Questions Served:</strong>{" "}
                  {questionsToServe}
                </p>
                <p>
                  <strong className="text-white">Linked Competency ID:</strong>{" "}
                  {linkedCompetencyId || "None (Standalone)"}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <h3 className="font-bold text-emerald-400 uppercase tracking-wider text-[11px]">
                Structure Summary
              </h3>
              <div className="space-y-1.5 text-slate-300">
                <p>
                  <strong className="text-white">Total Slide Count:</strong>{" "}
                  {slides.length} Slides
                </p>
                <p>
                  <strong className="text-white">Quiz Question Pool:</strong>{" "}
                  {quizQuestions.length} Questions
                </p>
                <p>
                  <strong className="text-white">Interactive Elements:</strong>{" "}
                  {
                    slides.filter((s) => s.type === 1 || s.hotspots.length > 0)
                      .length
                  }{" "}
                  Slides with Hotspots
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-800">
            <button
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
            >
              ← Back to Quiz Pool
            </button>
            <button
              onClick={handleSubmitCourse}
              disabled={submitting}
              className="px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Publishing Course..." : "Publish Course Live 🚀"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
