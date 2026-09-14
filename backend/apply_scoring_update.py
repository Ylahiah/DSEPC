import sys
sys.path.insert(0, '.')
import json
import app.db.base
from app.db.session import SessionLocal
from app.models.question import Question
from app.models.evaluation_template import EvaluationTemplate
from app.models.evaluation_template_section import EvaluationTemplateSection
from app.models.evaluation_session import EvaluationSession
from app.models.evaluation_session_question import EvaluationSessionQuestion
from app.services.admin_reports_service import AdminReportsService

db = SessionLocal()

print("1. Updating Question #44 (Guardar archivo) -> Correct answer: Ctrl+G")
q44 = db.query(Question).filter(Question.statement.like('%guarda%')).first()
if q44:
    q44.correct_answer = "Ctrl+G"
    print(f"   Updated Q#{q44.id}: statement='{q44.statement}', correct_answer='{q44.correct_answer}'")

print("\n2. Updating Question Scores (Practicals=30pts, MultipleChoice=4pts)")
for q in db.query(Question).all():
    if q.question_type == "excel_practical":
        q.score = 30.0
    else:
        q.score = 4.0
db.commit()
print("   All question scores updated.")

print("\n3. Updating Template Sections (Weights: Practicals=60, Excel=20, Computacion=20)")
for tpl in db.query(EvaluationTemplate).all():
    for sec in tpl.sections:
        cat_name = (sec.category.name if sec.category else "").lower()
        if "practic" in cat_name or "ejercicio" in cat_name:
            sec.weight_override = 60.0
        elif "excel" in cat_name:
            sec.weight_override = 20.0
        elif "computa" in cat_name:
            sec.weight_override = 20.0
db.commit()
print("   Template sections weights updated.")

print("\n4. Applying specific candidate validations (Keyli, Rudy, Alexis, etc.)")
# Ctrl+G / Ctrl+S for saving questions
for sq in db.query(EvaluationSessionQuestion).all():
    if (q44 and sq.question_id == q44.id) or "guarda" in (sq.question.statement or "").lower():
        if sq.selected_answer in ["Ctrl+G", "Ctrl+S"]:
            sq.is_correct = True

# Keyli (Session #48): Practical 1 administratively validated (row displacement to 79)
s48 = db.get(EvaluationSession, 48)
if s48:
    for q in s48.sections[0].questions:
        if q.sort_order == 1:
            q.is_correct = True
            q.selected_answer = "Archivo validado (Aprobado por el Administrador)"
            q.practical_feedback = json.dumps({
                "total_cells": 181,
                "correct_cells": 181,
                "incorrect_cells": [],
                "success_rate": 1.0,
                "admin_validated": True,
                "criteria_results": {
                    "EJERCICIO 1: RESUMEN OPERATIVO POR MES": {"total": 40, "correct": 40, "success_rate": 1.0},
                    "EJERCICIO 2: RESUMEN POR JURISDICCION SANITARIA": {"total": 50, "correct": 50, "success_rate": 1.0},
                    "EJERCICIO 3: PRODUCTIVIDAD Y REGISTROS POR CAPTURISTA": {"total": 56, "correct": 56, "success_rate": 1.0}
                }
            })

# Rudy (Session #45): Practical 2 failed formulas (missing division in F12)
s45 = db.get(EvaluationSession, 45)
if s45:
    for q in s45.sections[0].questions:
        if q.sort_order == 2:
            q.is_correct = False
            q.selected_answer = "Archivo entregado (Error en formulas / Incompleto)"

# Alexis (Session #49): Assisted evaluation (partial assistance)
s49 = db.get(EvaluationSession, 49)
if s49:
    s49.assistance_level = "partial"
    s49.assistance_notes = "Guia y soporte del evaluador durante la ejecucion de ejercicios practicos."

db.commit()

# Recalculate session total_score for all sessions
for session in db.query(EvaluationSession).all():
    total = 0.0
    assis = getattr(session, "assistance_level", "none") or "none"
    for sec in session.sections:
        for sq in sec.questions:
            if sq.is_correct:
                if sq.question.question_type == "excel_practical" and assis == "partial":
                    total += sq.question.score * 0.5
                elif sq.question.question_type == "excel_practical" and assis == "full":
                    pass
                else:
                    total += sq.question.score
    session.total_score = round(total, 2)

db.commit()
print("   All session total scores recalculated.")

print("\n=== VERIFICATION OF CANDIDATES ===")
service = AdminReportsService(db)
for sid in [45, 46, 48, 49, 50]:
    s = db.get(EvaluationSession, sid)
    if not s:
        continue
    cand_name = service._build_candidate_name(s) if s.candidate else "Sin candidato"
    pct = service._calculate_session_score_percentage(s)
    passing_score = s.evaluation_template.passing_score_percentage or 80.0
    status_apto = "APTO (Aprobado)" if pct >= passing_score else "NO APTO (Reprobado)"
    assis = getattr(s, "assistance_level", "none") or "none"
    print(f"Session #{s.id:2d} | Cand: {cand_name:<30} | Score: {s.total_score:5.1f} / 100 | %: {pct:5.1f}% | Dictamen: {status_apto} (Umbral: {passing_score}%) | Asistencia: {assis}")
