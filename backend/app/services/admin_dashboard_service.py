from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.models.evaluation_session import EvaluationSession
from app.schemas.admin_dashboard import (
    AdminDashboardCleanupRead,
    AdminDashboardRead,
    DashboardCategoryAverageRead,
    DashboardRankingItemRead,
    DashboardRecentSessionRead,
)
from app.repositories.evaluation_session_repository import EvaluationSessionRepository


class AdminDashboardService:
    FINISHED_STATUSES = {"completed", "expired"}
    ACTIVE_STATUSES = {"pending", "in_progress"}

    def __init__(self, db: Session) -> None:
        self.repository = EvaluationSessionRepository(db)

    def get_dashboard_summary(self) -> AdminDashboardRead:
        sessions = self.repository.list_all_for_dashboard()
        finished_sessions = [
            session for session in sessions if session.status in self.FINISHED_STATUSES
        ]
        active_sessions = [
            session for session in sessions if session.status in self.ACTIVE_STATUSES
        ]
        ranking = self._build_ranking(finished_sessions)

        average_score_percentage = (
            round(
                sum(self._calculate_session_score_percentage(session) for session in finished_sessions)
                / len(finished_sessions),
                2,
            )
            if finished_sessions
            else 0.0
        )
        average_time_seconds = (
            round(
                sum(session.consumed_time_seconds for session in finished_sessions)
                / len(finished_sessions),
                2,
            )
            if finished_sessions
            else 0.0
        )

        best_candidate = ranking[0] if ranking else None

        return AdminDashboardRead(
            evaluated_candidates_count=len({session.candidate_id for session in finished_sessions}),
            total_sessions_count=len(sessions),
            completed_sessions_count=len(finished_sessions),
            active_sessions_count=len(active_sessions),
            average_score_percentage=average_score_percentage,
            average_time_seconds=average_time_seconds,
            best_candidate_name=best_candidate.candidate_name if best_candidate else None,
            best_candidate_score_percentage=(
                best_candidate.average_score_percentage if best_candidate else None
            ),
            category_averages=self._build_category_averages(finished_sessions),
            ranking=ranking,
            recent_sessions=self._build_recent_sessions(sessions),
        )

    def cleanup_test_data(self) -> AdminDashboardCleanupRead:
        sessions = self.repository.list_all_for_dashboard()
        deleted_active_sessions_count = sum(
            1 for session in sessions if session.status in self.ACTIVE_STATUSES
        )

        for session in sessions:
            self.repository.db.delete(session)

        self.repository.db.flush()

        orphan_candidates = self.repository.db.scalars(
            select(Candidate).where(~Candidate.sessions.any())
        ).all()
        for candidate in orphan_candidates:
            self.repository.db.delete(candidate)

        self.repository.db.commit()

        deleted_sessions_count = len(sessions)
        deleted_candidates_count = len(orphan_candidates)
        message = (
            "No habia datos de prueba por limpiar."
            if deleted_sessions_count == 0 and deleted_candidates_count == 0
            else "Se limpiaron los datos de prueba del dashboard y del historial."
        )

        return AdminDashboardCleanupRead(
            deleted_sessions_count=deleted_sessions_count,
            deleted_active_sessions_count=deleted_active_sessions_count,
            deleted_candidates_count=deleted_candidates_count,
            message=message,
        )

    def _build_category_averages(
        self,
        sessions: list[EvaluationSession],
    ) -> list[DashboardCategoryAverageRead]:
        category_metrics: dict[str, dict[str, float | int | set[int]]] = {}

        for session in sessions:
            for section in session.sections:
                for session_question in section.questions:
                    category_name = session_question.question.category.name
                    metrics = category_metrics.setdefault(
                        category_name,
                        {
                            "score_obtained": 0.0,
                            "score_possible": 0.0,
                            "time_spent_seconds": 0,
                            "total_questions": 0,
                            "session_ids": set(),
                        },
                    )

                    metrics["score_possible"] += session_question.question.score
                    metrics["time_spent_seconds"] += session_question.time_spent_seconds
                    metrics["total_questions"] += 1
                    casted_session_ids = metrics["session_ids"]
                    assert isinstance(casted_session_ids, set)
                    casted_session_ids.add(session.id)

                    if session_question.question.question_type == "excel_practical" and session_question.practical_feedback:
                        import json
                        try:
                            fb = json.loads(session_question.practical_feedback)
                            metrics["score_obtained"] += session_question.question.score * fb.get("success_rate", 0.0)
                        except Exception:
                            if session_question.is_correct:
                                metrics["score_obtained"] += session_question.question.score
                    elif session_question.is_correct:
                        metrics["score_obtained"] += session_question.question.score

        category_averages: list[DashboardCategoryAverageRead] = []
        for category_name, metrics in category_metrics.items():
            total_questions = int(metrics["total_questions"])
            score_possible = float(metrics["score_possible"])
            score_obtained = float(metrics["score_obtained"])
            average_time_seconds = (
                round(float(metrics["time_spent_seconds"]) / total_questions, 2)
                if total_questions
                else 0.0
            )

            session_ids = metrics["session_ids"]
            assert isinstance(session_ids, set)

            category_averages.append(
                DashboardCategoryAverageRead(
                    category_name=category_name,
                    average_score_percentage=(
                        round((score_obtained / score_possible) * 100, 2)
                        if score_possible
                        else 0.0
                    ),
                    average_time_seconds=average_time_seconds,
                    total_questions=total_questions,
                    evaluated_sessions=len(session_ids),
                )
            )

        return sorted(
            category_averages,
            key=lambda item: (-item.average_score_percentage, item.category_name.lower()),
        )

    def _build_ranking(
        self,
        sessions: list[EvaluationSession],
    ) -> list[DashboardRankingItemRead]:
        candidate_metrics: dict[int, dict[str, object]] = {}

        for session in sessions:
            candidate_name = self._build_candidate_name(session)
            submitted_at = self._normalize_datetime(session.submitted_at) if session.submitted_at else None
            metrics = candidate_metrics.setdefault(
                session.candidate_id,
                {
                    "candidate_name": candidate_name,
                    "email": session.candidate.email,
                    "attempts_count": 0,
                    "score_percentage_sum": 0.0,
                    "best_score_percentage": 0.0,
                    "time_sum": 0,
                    "last_template_name": None,
                    "last_status": None,
                    "last_submitted_at": None,
                },
            )

            score_percentage = self._calculate_session_score_percentage(session)
            metrics["attempts_count"] = int(metrics["attempts_count"]) + 1
            metrics["score_percentage_sum"] = float(metrics["score_percentage_sum"]) + score_percentage
            metrics["best_score_percentage"] = max(
                float(metrics["best_score_percentage"]),
                score_percentage,
            )
            metrics["time_sum"] = int(metrics["time_sum"]) + session.consumed_time_seconds

            current_last_submitted_at = metrics["last_submitted_at"]
            if (
                current_last_submitted_at is None
                or submitted_at is not None
                and submitted_at > current_last_submitted_at
            ):
                metrics["last_submitted_at"] = submitted_at
                metrics["last_template_name"] = session.evaluation_template.name
                metrics["last_status"] = session.status

        ranking = [
            DashboardRankingItemRead(
                candidate_id=candidate_id,
                candidate_name=str(metrics["candidate_name"]),
                email=metrics["email"],
                attempts_count=int(metrics["attempts_count"]),
                average_score_percentage=round(
                    float(metrics["score_percentage_sum"]) / int(metrics["attempts_count"]),
                    2,
                ),
                best_score_percentage=round(float(metrics["best_score_percentage"]), 2),
                average_time_seconds=round(
                    int(metrics["time_sum"]) / int(metrics["attempts_count"]),
                    2,
                ),
                last_template_name=(
                    str(metrics["last_template_name"])
                    if metrics["last_template_name"] is not None
                    else None
                ),
                last_status=(
                    str(metrics["last_status"]) if metrics["last_status"] is not None else None
                ),
                last_submitted_at=metrics["last_submitted_at"],
            )
            for candidate_id, metrics in candidate_metrics.items()
        ]

        return sorted(
            ranking,
            key=lambda item: (
                -item.average_score_percentage,
                -item.best_score_percentage,
                item.average_time_seconds,
                item.candidate_name.lower(),
            ),
        )

    def _build_recent_sessions(
        self,
        sessions: list[EvaluationSession],
    ) -> list[DashboardRecentSessionRead]:
        return [
            DashboardRecentSessionRead(
                session_id=session.id,
                candidate_name=self._build_candidate_name(session),
                template_name=session.evaluation_template.name,
                status=session.status,
                total_score=session.total_score,
                score_percentage=self._calculate_session_score_percentage(session),
                answered_questions=session.answered_questions_count,
                omitted_questions=session.omitted_questions_count,
                consumed_time_seconds=session.consumed_time_seconds,
                started_at=self._normalize_datetime(session.started_at),
                submitted_at=(
                    self._normalize_datetime(session.submitted_at) if session.submitted_at else None
                ),
                completed_by_timeout=session.completed_by_timeout,
            )
            for session in sessions[:8]
        ]

    def _calculate_session_score_percentage(self, session: EvaluationSession) -> float:
        score_obtained = 0.0
        score_possible = 0.0

        for section in session.sections:
            for session_question in section.questions:
                score_possible += session_question.question.score
                if session_question.question.question_type == "excel_practical" and session_question.practical_feedback:
                    import json
                    try:
                        fb = json.loads(session_question.practical_feedback)
                        score_obtained += session_question.question.score * fb.get("success_rate", 0.0)
                    except Exception:
                        if session_question.is_correct:
                            score_obtained += session_question.question.score
                elif session_question.is_correct:
                    score_obtained += session_question.question.score

        if score_possible == 0:
            return 0.0

        return round((score_obtained / score_possible) * 100, 2)

    def _build_candidate_name(self, session: EvaluationSession) -> str:
        return f"{session.candidate.first_name} {session.candidate.last_name}".strip()

    def _normalize_datetime(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
