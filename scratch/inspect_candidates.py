import sys
sys.path.insert(0, '.')
import app.db.base
from app.db.session import SessionLocal
from app.models.candidate import Candidate
from app.models.evaluation_session import EvaluationSession
from app.models.question import Question
from app.models.evaluation_session_question import EvaluationSessionQuestion
from app.models.evaluation_template import EvaluationTemplate
from app.models.evaluation_template_section import EvaluationTemplateSection
from app.services.admin_reports_service import AdminReportsService

db = SessionLocal()
service = AdminReportsService(db)

print("\n=== SESSIONS 45 (Rudy) & 46 (Diana) ===")
for sid in [45, 46]:
    s = db.query(EvaluationSession).get(sid)
    if not s: continue
    print(f"\n=======================================================")
    print(f"SESSION #{s.id} ({service._build_candidate_name(s)}) | Time: {s.consumed_time_seconds}s | Score: {s.total_score}")
    print(f"=======================================================")
    for sec in s.sections:
        print(f" Section: {sec.title}")
        for q in sec.questions:
            q_type = q.question.question_type
            score = q.question.score
            cat = q.question.category.name if q.question.category else "N/A"
            print(f"   Q#{q.sort_order} [{cat}] ({q_type}) Score: {score} | IsCorrect: {q.is_correct} | Selected: {q.selected_answer!r} | Correct: {q.question.correct_answer!r} | Time: {q.time_spent_seconds}s")
            if q.practical_feedback:
                print(f"       Practical FB: {q.practical_feedback}")


print("\n=== SESSIONS 45 (Rudy), 46 (Diana), 48 (Keyli), 50 (Keyli) ===")
for sid in [45, 46, 48, 50]:
    s = db.query(EvaluationSession).get(sid)
    if not s: continue
    print(f"\n--- SESSION #{s.id} ({service._build_candidate_name(s)}) | Time: {s.consumed_time_seconds}s ---")
    for sec in s.sections:
        for q in sec.questions:
            q_type = q.question.question_type
            score = q.question.score
            print(f"  Q#{q.sort_order} [{q.question.category.name if q.question.category else 'N/A'}] ({q_type}) Score: {score} | Selected: {q.selected_answer!r} | Correct: {q.question.correct_answer!r} | IsCorrect: {q.is_correct} | Time: {q.time_spent_seconds}s | Statement: {q.question.statement[:60]}...")
            if q.practical_feedback:
                print(f"      Practical Feedback: {q.practical_feedback}")

