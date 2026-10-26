import { useParams, useNavigate } from "react-router-dom";
import CarerCoursePlayer from "./CarerCoursePlayer";

export default function CoursePlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const courseId = Number(id);

  if (!courseId || isNaN(courseId)) {
    return (
      <div className="p-12 text-center text-slate-400 text-xs">
        Invalid course ID provided.
      </div>
    );
  }

  const handleBack = () => {
    // If there is history to go back to, return there; otherwise default to the To-Do list
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate("/elearning/todos");
    }
  };

  return <CarerCoursePlayer courseId={courseId} onBack={handleBack} />;
}
