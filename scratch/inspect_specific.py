import sys
sys.path.insert(0, '.')
import app.db.base
from app.db.session import SessionLocal
from app.models.evaluation_session import EvaluationSession
from app.services.admin_reports_service import AdminReportsService

db = SessionLocal()
service = AdminReportsService(db)

for sid in [45, 46, 48]:
    s = db.query(EvaluationSession).get(sid)
    cand = s.candidate
    print(f"\n=======================================================")
    print(f"SESSION #{s.id} ({cand.first_name} {cand.last_name} | {cand.email})")
    print(f"Time: {s.consumed_time_seconds}s ({s.consumed_time_seconds//60}m {s.consumed_time_seconds%60}s) | Score: {s.total_score} | Score%: {service._calculate_session_score_percentage(s):.1f}%")
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
