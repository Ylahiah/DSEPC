import sys
sys.path.insert(0, '.')
import json
import app.db.base
from app.db.session import SessionLocal
from app.models.question import Question
from app.models.evaluation_session import EvaluationSession
from app.models.evaluation_session_question import EvaluationSessionQuestion
from app.services.admin_reports_service import AdminReportsService

db = SessionLocal()
service = AdminReportsService(db)

print("=== CURRENT SCORES ===")
for sid in [45, 46, 48, 50]:
    s = db.query(EvaluationSession).get(sid)
    cand_name = service._build_candidate_name(s)
    pct = service._calculate_session_score_percentage(s)
    print(f"Session #{sid} ({cand_name}): Score {s.total_score} -> {pct:.1f}% (Apto >= 80%: {pct >= 80.0})")

# Let's simulate:
# 1) Q44 (guardar archivo): correct_answer = 'Ctrl+G' (or accept Ctrl+G)
# 2) practical questions score = 30.0
# 3) multiple_choice questions score = 4.0
print("\n=== SIMULATED SCORES (Practicals=30pts, MultipleChoice=4pts, Total=100pts) ===")

for sid in [45, 46, 48, 50]:
    s = db.query(EvaluationSession).get(sid)
    cand_name = service._build_candidate_name(s)
    score_possible = 0.0
    score_obtained = 0.0
    
    for sec in s.sections:
        for sq in sec.questions:
            # Simulated question score
            if sq.question.question_type == "excel_practical":
                q_score = 30.0
            else:
                q_score = 4.0
            
            score_possible += q_score
            
            # Check is_correct with Ctrl+G fix
            is_corr = sq.is_correct
            if sq.question_id == 44 or "guarda" in (sq.question.statement or "").lower():
                if sq.selected_answer in ['Ctrl+G', 'Ctrl+S']:
                    is_corr = True
            
            if sq.question.question_type == "excel_practical" and sq.practical_feedback:
                try:
                    fb = json.loads(sq.practical_feedback)
                    rate = fb.get("success_rate", 0.0)
                    # If Rudy failed a formula in practical 2, rate is 44/45 = 0.977 or if penalty applied
                    score_obtained += q_score * rate
                except Exception:
                    if is_corr:
                        score_obtained += q_score
            elif is_corr:
                score_obtained += q_score
                
    pct = (score_obtained / score_possible) * 100
    print(f"Session #{sid} ({cand_name}): Possible {score_possible} | Obtained {score_obtained:.2f} -> {pct:.1f}% | APTO (>=80%): {pct >= 80.0}")
