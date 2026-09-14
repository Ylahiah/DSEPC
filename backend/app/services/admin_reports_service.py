import re
from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, status
from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, PageBreak, Image, KeepTogether
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.services.system_setting_service import SystemSettingService

import app.db.base
from app.models.candidate import Candidate
from app.models.evaluation_session import EvaluationSession
from app.schemas.admin_reports import (
    AdminReportsSummaryRead,
    ReportSessionItemRead,
    ReportSessionDetailRead,
    ReportCategoryMetricRead,
    ReportQuestionResultRead,
)
from app.services.admin_dashboard_service import AdminDashboardService
from app.repositories.evaluation_session_repository import EvaluationSessionRepository


class AdminReportsService:
    FINISHED_STATUSES = {"completed", "expired"}

    def __init__(self, db: Session) -> None:
        self.db = db
        self.settings = get_settings()
        self.repository = EvaluationSessionRepository(db)
        self.dashboard_service = AdminDashboardService(db)

    def get_reports_summary(self) -> AdminReportsSummaryRead:
        finished_sessions = self._get_finished_sessions()
        return AdminReportsSummaryRead(
            generated_at=datetime.now(timezone.utc),
            evaluated_candidates_count=len({session.candidate_id for session in finished_sessions}),
            total_finished_sessions=len(finished_sessions),
            average_score_percentage=self._calculate_average_score_percentage(finished_sessions),
            average_time_seconds=self._calculate_average_time_seconds(finished_sessions),
            sessions=[self._build_report_session_item(session) for session in finished_sessions],
        )

    def delete_session(self, session_id: int) -> dict[str, object]:
        session = self.db.get(EvaluationSession, session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Sesion #{session_id} no encontrada.",
            )

        candidate_id = session.candidate_id
        self.db.delete(session)
        self.db.flush()

        # If the candidate has no remaining sessions, remove the orphan candidate record
        if candidate_id:
            has_other_sessions = self.db.scalar(
                select(EvaluationSession.id).where(EvaluationSession.candidate_id == candidate_id)
            )
            if not has_other_sessions:
                candidate = self.db.get(Candidate, candidate_id)
                if candidate:
                    self.db.delete(candidate)

        self.db.commit()
        return {
            "message": f"Sesion #{session_id} eliminada correctamente.",
            "session_id": session_id,
        }

    def build_general_excel(self) -> tuple[BytesIO, str]:
        dashboard = self.dashboard_service.get_dashboard_summary()
        finished_sessions = self._get_finished_sessions()

        workbook = Workbook()
        summary_sheet = workbook.active
        summary_sheet.title = "Resumen"

        summary_rows = [
            ("Reporte", "General de evaluaciones"),
            ("Generado", self._format_datetime(datetime.now(timezone.utc))),
            ("Candidatos evaluados", dashboard.evaluated_candidates_count),
            ("Sesiones cerradas", dashboard.completed_sessions_count),
            ("Promedio general", f"{dashboard.average_score_percentage:.2f}%"),
            ("Tiempo promedio", self._format_duration(dashboard.average_time_seconds)),
            ("Mejor candidato", dashboard.best_candidate_name or "Sin datos"),
            (
                "Puntaje del mejor candidato",
                (
                    f"{dashboard.best_candidate_score_percentage:.2f}%"
                    if dashboard.best_candidate_score_percentage is not None
                    else "Sin datos"
                ),
            ),
        ]
        for key, value in summary_rows:
            summary_sheet.append([key, value])
        self._style_headerless_key_value_sheet(summary_sheet)

        sessions_sheet = workbook.create_sheet("Sesiones")
        sessions_sheet.append(
            [
                "ID sesion",
                "Candidato",
                "Plantilla",
                "Estado",
                "Puntaje",
                "Porcentaje",
                "Respondidas",
                "Omitidas",
                "Tiempo consumido",
                "Inicio",
                "Cierre",
                "Cierre por tiempo",
            ]
        )
        for session in finished_sessions:
            sessions_sheet.append(
                [
                    session.id,
                    self._build_candidate_name(session),
                    session.evaluation_template.name,
                    session.status,
                    session.total_score if session.total_score is not None else 0,
                    self._calculate_session_score_percentage(session),
                    session.answered_questions_count,
                    session.omitted_questions_count,
                    session.consumed_time_seconds,
                    self._format_datetime(session.started_at),
                    self._format_datetime(session.submitted_at),
                    "Si" if session.completed_by_timeout else "No",
                ]
            )
        self._style_table_sheet(sessions_sheet)

        categories_sheet = workbook.create_sheet("Categorias")
        categories_sheet.append(
            [
                "Categoria",
                "Promedio",
                "Tiempo promedio",
                "Reactivos evaluados",
                "Sesiones evaluadas",
            ]
        )
        for category in dashboard.category_averages:
            categories_sheet.append(
                [
                    category.category_name,
                    category.average_score_percentage,
                    category.average_time_seconds,
                    category.total_questions,
                    category.evaluated_sessions,
                ]
            )
        self._style_table_sheet(categories_sheet)

        ranking_sheet = workbook.create_sheet("Ranking")
        ranking_sheet.append(
            [
                "Posicion",
                "Candidato",
                "Correo",
                "Intentos",
                "Promedio",
                "Mejor puntaje",
                "Tiempo promedio",
                "Ultima plantilla",
                "Ultimo estado",
                "Ultimo cierre",
            ]
        )
        for index, item in enumerate(dashboard.ranking, start=1):
            ranking_sheet.append(
                [
                    index,
                    item.candidate_name,
                    item.email or "",
                    item.attempts_count,
                    item.average_score_percentage,
                    item.best_score_percentage,
                    item.average_time_seconds,
                    item.last_template_name or "",
                    item.last_status or "",
                    self._format_datetime(item.last_submitted_at),
                ]
            )
        self._style_table_sheet(ranking_sheet)

        output = BytesIO()
        workbook.save(output)
        output.seek(0)
        return output, f"reporte_general_dsepc_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"

    def build_general_pdf(self) -> tuple[BytesIO, str]:
        dashboard = self.dashboard_service.get_dashboard_summary()
        finished_sessions = self._get_finished_sessions()

        output = BytesIO()
        document = SimpleDocTemplate(output, pagesize=landscape(A4))
        styles = getSampleStyleSheet()
        elements: list = []

        if "Center" not in styles:
            from reportlab.lib.styles import ParagraphStyle
            styles.add(ParagraphStyle(name='Center', alignment=1))
            
        banner_data = [[Paragraph("<font color='white' size='18'><b>REPORTE GENERAL DSEPC</b></font>", styles["Center"])]]
        banner = Table(banner_data, colWidths=[700])
        banner.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#0f172a")),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 12),
            ('BOTTOMPADDING', (0,0), (-1,-1), 12),
        ]))
        elements.append(banner)
        elements.append(Spacer(1, 20))
        
        elements.append(
            Paragraph(
                f"Generado: {self._format_datetime(datetime.now(timezone.utc))}",
                styles["Normal"],
            )
        )
        elements.append(Spacer(1, 12))

        aptos_count = sum(1 for s in finished_sessions if self._calculate_session_score_percentage(s) >= 80.0)
        
        summary_table = Table(
            [
                ["Indicador", "Valor"],
                ["Candidatos evaluados", dashboard.evaluated_candidates_count],
                ["Sesiones cerradas", dashboard.completed_sessions_count],
                ["Candidatos Aptos", f"{aptos_count} (Umbral: 80%)"],
                ["Promedio general", f"{dashboard.average_score_percentage:.2f}%"],
                ["Tiempo promedio", self._format_duration(dashboard.average_time_seconds)],
                ["Mejor candidato", dashboard.best_candidate_name or "Sin datos"],
            ],
            colWidths=[200, 260],
        )
        self._apply_pdf_table_style(summary_table)
        elements.append(summary_table)
        elements.append(Spacer(1, 16))

        elements.append(Paragraph("Promedio por categoria", styles["Heading2"]))
        category_table = Table(
            [
                [
                    "Categoria",
                    "Promedio",
                    "Tiempo promedio",
                    "Reactivos",
                    "Sesiones",
                ]
            ]
            + [
                [
                    item.category_name,
                    f"{item.average_score_percentage:.2f}%",
                    self._format_duration(item.average_time_seconds),
                    item.total_questions,
                    item.evaluated_sessions,
                ]
                for item in dashboard.category_averages
            ],
            repeatRows=1,
        )
        self._apply_pdf_table_style(category_table)
        elements.append(category_table)
        elements.append(Spacer(1, 16))

        elements.append(Paragraph("Top 10 ranking", styles["Heading2"]))
        ranking_table = Table(
            [
                ["Pos.", "Candidato", "Promedio", "Mejor", "Estatus", "Intentos", "Tiempo prom."]
            ]
            + [
                [
                    index,
                    item.candidate_name,
                    f"{item.average_score_percentage:.2f}%",
                    f"{item.best_score_percentage:.2f}%",
                    "APTO" if item.best_score_percentage >= 80.0 else "NO APTO",
                    item.attempts_count,
                    self._format_duration(item.average_time_seconds),
                ]
                for index, item in enumerate(dashboard.ranking[:10], start=1)
            ],
            repeatRows=1,
            colWidths=[35, 200, 75, 75, 75, 60, 90]
        )
        self._apply_pdf_table_style(ranking_table)
        elements.append(ranking_table)
        elements.append(Spacer(1, 16))

        elements.append(Paragraph("Ultimas sesiones cerradas", styles["Heading2"]))
        sessions_table = Table(
            [
                ["Sesion", "Candidato", "Plantilla", "Estatus", "Porcentaje", "Tiempo", "Cierre"]
            ]
            + [
                [
                    session.id,
                    self._build_candidate_name(session),
                    session.evaluation_template.name,
                    "APTO" if self._calculate_session_score_percentage(session) >= 80.0 else "NO APTO",
                    f"{self._calculate_session_score_percentage(session):.2f}%",
                    self._format_duration(session.consumed_time_seconds),
                    self._format_datetime(session.submitted_at),
                ]
                for session in finished_sessions[:20]
            ],
            repeatRows=1,
            colWidths=[40, 160, 150, 70, 75, 60, 130]
        )
        self._apply_pdf_table_style(sessions_table)
        elements.append(sessions_table)

        document.build(elements)
        output.seek(0)
        return output, f"reporte_general_dsepc_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

    def build_session_excel(self, session_id: int) -> tuple[BytesIO, str]:
        session = self._get_session_or_404(session_id)
        workbook = Workbook()
        summary_sheet = workbook.active
        summary_sheet.title = "Resumen"

        summary_rows = [
            ("Sesion", session.id),
            ("Candidato", self._build_candidate_name(session)),
            ("Plantilla", session.evaluation_template.name),
            ("Estado", session.status),
            ("Puntaje", session.total_score if session.total_score is not None else 0),
            ("Porcentaje", f"{self._calculate_session_score_percentage(session):.2f}%"),
            ("Respondidas", session.answered_questions_count),
            ("Omitidas", session.omitted_questions_count),
            ("Tiempo consumido", self._format_duration(session.consumed_time_seconds)),
            ("Inicio", self._format_datetime(session.started_at)),
            ("Cierre", self._format_datetime(session.submitted_at)),
            ("Cierre por tiempo", "Si" if session.completed_by_timeout else "No"),
        ]
        for key, value in summary_rows:
            summary_sheet.append([key, value])
        self._style_headerless_key_value_sheet(summary_sheet)

        categories_sheet = workbook.create_sheet("Categorias")
        categories_sheet.append(
            [
                "Categoria",
                "Reactivos",
                "Respondidas",
                "Omitidas",
                "Correctas",
                "Incorrectas",
                "Puntaje obtenido",
                "Puntaje posible",
            ]
        )
        for item in self._build_session_category_rows(session):
            categories_sheet.append(item)
        self._style_table_sheet(categories_sheet)

        questions_sheet = workbook.create_sheet("Preguntas")
        questions_sheet.append(
            [
                "Orden seccion",
                "Seccion",
                "Orden pregunta",
                "Categoria",
                "Pregunta",
                "Respuesta seleccionada",
                "Respuesta correcta",
                "Respondida",
                "Correcta",
                "Omitida",
                "Tiempo",
                "Puntaje",
            ]
        )
        for section in session.sections:
            for session_question in section.questions:
                questions_sheet.append(
                    [
                        section.sort_order,
                        section.title,
                        session_question.sort_order,
                        session_question.question.category.name,
                        session_question.question.statement,
                        session_question.selected_answer or "",
                        session_question.question.correct_answer,
                        "Si" if session_question.is_answered else "No",
                        (
                            "Si"
                            if session_question.is_correct
                            else "No" if session_question.is_correct is False else ""
                        ),
                        "Si" if session_question.was_omitted else "No",
                        session_question.time_spent_seconds,
                        session_question.question.score,
                    ]
                )
        self._style_table_sheet(questions_sheet)

        output = BytesIO()
        workbook.save(output)
        output.seek(0)
        filename = (
            f"reporte_individual_{self._safe_filename(self._build_candidate_name(session))}"
            f"_sesion_{session.id}.xlsx"
        )
        return output, filename

    def build_session_pdf(self, session_id: int) -> tuple[BytesIO, str]:
        session = self._get_session_or_404(session_id)
        settings_service = SystemSettingService(self.db)
        settings = settings_service.get_settings()
        logo_path = settings_service.get_logo_path()
        company_name = (settings.company_name or "PENSIV").strip()

        output = BytesIO()
        # Documento Carta (8.5 x 11 in = 612 x 792 pt) con margenes controlados
        document = SimpleDocTemplate(
            output,
            pagesize=letter,
            leftMargin=36,
            rightMargin=36,
            topMargin=32,
            bottomMargin=32,
        )
        
        styles = getSampleStyleSheet()
        
        # Estilos tipograficos
        style_title = ParagraphStyle(
            name='RepExecTitle',
            fontName='Helvetica-Bold',
            fontSize=13,
            leading=15,
            textColor=colors.HexColor('#0f172a'),
        )
        style_subtitle = ParagraphStyle(
            name='RepExecSubtitle',
            fontName='Helvetica-Bold',
            fontSize=7.5,
            leading=9.5,
            textColor=colors.HexColor('#64748b'),
        )
        style_sec_header = ParagraphStyle(
            name='RepSecHeader',
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            textColor=colors.HexColor('#334155'),
        )
        style_normal = ParagraphStyle(
            name='RepExecNormal',
            fontName='Helvetica',
            fontSize=8,
            leading=10.5,
            textColor=colors.HexColor('#1e293b'),
        )
        style_normal_bold = ParagraphStyle(
            name='RepExecNormalBold',
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10.5,
            textColor=colors.HexColor('#0f172a'),
        )
        style_small = ParagraphStyle(
            name='RepExecSmall',
            fontName='Helvetica',
            fontSize=7,
            leading=9,
            textColor=colors.HexColor('#64748b'),
        )
        style_small_bold = ParagraphStyle(
            name='RepExecSmallBold',
            fontName='Helvetica-Bold',
            fontSize=7,
            leading=9,
            textColor=colors.HexColor('#334155'),
        )
        style_center = ParagraphStyle(
            name='RepExecCenter',
            fontName='Helvetica',
            fontSize=8,
            leading=10,
            alignment=1,
            textColor=colors.HexColor('#1e293b'),
        )
        style_center_bold = ParagraphStyle(
            name='RepExecCenterBold',
            fontName='Helvetica-Bold',
            fontSize=8,
            leading=10,
            alignment=1,
            textColor=colors.HexColor('#0f172a'),
        )
        style_right = ParagraphStyle(
            name='RepExecRight',
            fontName='Helvetica',
            fontSize=7.5,
            leading=9.5,
            alignment=2,
            textColor=colors.HexColor('#64748b'),
        )
        style_kpi_label = ParagraphStyle(
            name='RepExecKpiLabel',
            fontName='Helvetica-Bold',
            fontSize=7,
            leading=8.5,
            textColor=colors.HexColor('#64748b'),
        )
        style_kpi_val = ParagraphStyle(
            name='RepExecKpiVal',
            fontName='Helvetica-Bold',
            fontSize=15,
            leading=17,
            textColor=colors.HexColor('#0f172a'),
        )

        elements: list = []
        candidate_name = self._build_candidate_name(session)
        score_percentage = self._calculate_session_score_percentage(session)
        passing_score = getattr(session.evaluation_template, "passing_score_percentage", 80.0) or 80.0
        is_apto = score_percentage >= passing_score
        total_questions = len([q for sec in session.sections for q in sec.questions])
        correct_count = sum(
            1 for sec in session.sections for q in sec.questions if q.is_correct
        )
        score_display = f"{score_percentage:.2f}%" if score_percentage % 1 != 0 else f"{int(score_percentage)}%"
        passing_display = f"{passing_score:.0f}%" if passing_score % 1 == 0 else f"{passing_score:.1f}%"

        # =========================================================================
        # PAGINA 1: RESUMEN EJECUTIVO DE EVALUACION
        # =========================================================================
        
        # 1. Cabecera Institucional
        logo_element = None
        if logo_path and logo_path.exists():
            try:
                logo_element = Image(str(logo_path), height=26, width=80)
            except Exception:
                logo_element = None

        header_left = []
        if logo_element:
            header_left.append(logo_element)
            header_left.append(Spacer(1, 2))
        header_left.append(Paragraph(f"PROGRAMA DE EVALUACIÓN PARA CANDIDATOS {company_name.upper()}", style_subtitle))
        header_left.append(Paragraph("REPORTE EJECUTIVO DE EVALUACIÓN", style_title))

        emission_date = datetime.now().strftime("%d %b %Y").lower()
        header_right = [
            Paragraph(f"<b>FOLIO #{session.id}</b>", ParagraphStyle(name='FolioBox', fontName='Helvetica-Bold', fontSize=9, leading=11, alignment=2, textColor=colors.HexColor('#0f172a'))),
            Spacer(1, 2),
            Paragraph(f"Fecha de Emisión: <b>{emission_date}</b>", style_right),
        ]

        header_table = Table(
            [[header_left, header_right]],
            colWidths=[380, 160],
        )
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('LINEBELOW', (0, 0), (-1, -1), 1.5, colors.HexColor('#0f172a')),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 8))

        # 2. Ficha Tecnica del Candidato
        sub_date_str = session.submitted_at.strftime("%d/%m/%Y") if session.submitted_at else "En proceso"
        status_label = "CONCLUIDO" if session.status == "completed" else "CIERRE POR TIEMPO" if session.status == "expired" else session.status.upper()
        cand_assistance = getattr(session, "assistance_level", "none") or "none"
        if cand_assistance == "partial":
            modalidad_tag = "<font color='#b45309'><b>ASISTENCIA PARCIAL (50%)</b></font>"
        elif cand_assistance == "full":
            modalidad_tag = "<font color='#b91c1c'><b>ASISTENCIA TOTAL</b></font>"
        else:
            modalidad_tag = f"{session.answered_questions_count} de {total_questions} respondidas"

        cand_col1 = [
            Paragraph("<b>CANDIDATO EVALUADO</b>", style_kpi_label),
            Spacer(1, 1),
            Paragraph(f"<b>{candidate_name.upper()}</b>", style_normal_bold),
            Spacer(1, 1),
            Paragraph(f"Evaluación realizada el {sub_date_str}", style_small),
        ]
        cand_col2 = [
            Paragraph("<b>PLANTILLA / PERFIL EVALUADO</b>", style_kpi_label),
            Spacer(1, 1),
            Paragraph(f"<b>{session.evaluation_template.name}</b>", style_normal_bold),
            Spacer(1, 1),
            Paragraph(f"{total_questions} Reactivos aplicados", style_small),
        ]
        cand_col3 = [
            Paragraph("<b>ESTATUS DEL EXAMEN</b>", style_kpi_label),
            Spacer(1, 1),
            Paragraph(f"<b>{status_label}</b>", style_normal_bold),
            Spacer(1, 1),
            Paragraph(modalidad_tag, style_small),
        ]

        candidate_table = Table([[cand_col1, cand_col2, cand_col3]], colWidths=[190, 200, 150])
        candidate_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(candidate_table)
        elements.append(Spacer(1, 10))

        # 3. Seccion Resultados Generales / KPIs
        kpi_header_table = Table(
            [[
                Paragraph("<b>RESULTADOS GENERALES DE LA EVALUACIÓN</b>", style_sec_header),
                Paragraph(f"Umbral mínimo aprobatorio: <b>{passing_display}</b>", style_right),
            ]],
            colWidths=[360, 180],
        )
        kpi_header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))
        elements.append(kpi_header_table)
        elements.append(Spacer(1, 4))

        dictamen_text = "APTO" if is_apto else "NO APTO"
        dictamen_desc = "Cumple perfil requerido" if is_apto else "Por debajo del umbral"
        dictamen_color = colors.HexColor('#15803d') if is_apto else colors.HexColor('#b91c1c')
        dictamen_bg = colors.HexColor('#f0fdf4') if is_apto else colors.HexColor('#fef2f2')
        dictamen_border = colors.HexColor('#86efac') if is_apto else colors.HexColor('#fca5a5')

        precision_pct = (
            int((correct_count / session.answered_questions_count) * 100)
            if session.answered_questions_count
            else 0
        )

        consumed_sec = session.consumed_time_seconds
        if consumed_sec < 25 * 60:
            time_efficiency_level = "ÓPTIMO"
            time_efficiency_desc = "Dominio ágil y fluido"
            time_efficiency_color = colors.HexColor('#15803d')
        elif consumed_sec <= 35 * 60:
            time_efficiency_level = "ACEPTABLE"
            time_efficiency_desc = "Ritmo normal de trabajo"
            time_efficiency_color = colors.HexColor('#475569')
        else:
            time_efficiency_level = "CRÍTICO"
            time_efficiency_desc = "Alerta por lentitud operativa"
            time_efficiency_color = colors.HexColor('#b45309')

        kpi_card_1 = [
            Paragraph("DICTAMEN", ParagraphStyle(name='K1', fontName='Helvetica-Bold', fontSize=7, leading=8, textColor=dictamen_color)),
            Spacer(1, 2),
            Paragraph(f"<font color='{dictamen_color.hexval()}'><b>{dictamen_text}</b></font>", style_kpi_val),
            Spacer(1, 1),
            Paragraph(dictamen_desc, ParagraphStyle(name='K1d', fontName='Helvetica', fontSize=6.5, leading=8, textColor=dictamen_color)),
        ]
        kpi_card_2 = [
            Paragraph("CALIFICACIÓN", style_kpi_label),
            Spacer(1, 2),
            Paragraph(f"<b>{score_display}</b>", style_kpi_val),
            Spacer(1, 1),
            Paragraph(f"{correct_count} de {total_questions} aciertos", style_small),
        ]
        kpi_card_3 = [
            Paragraph("PRECISIÓN", style_kpi_label),
            Spacer(1, 2),
            Paragraph(f"<b>{precision_pct}%</b>", style_kpi_val),
            Spacer(1, 1),
            Paragraph("Efectividad en respuestas", style_small),
        ]
        kpi_card_4 = [
            Paragraph("TIEMPO TOTAL", style_kpi_label),
            Spacer(1, 2),
            Paragraph(f"<b>{self._format_duration(session.consumed_time_seconds)}</b>", style_kpi_val),
            Spacer(1, 1),
            Paragraph(f"<font color='{time_efficiency_color.hexval()}'><b>{time_efficiency_level}</b>: {time_efficiency_desc}</font>", ParagraphStyle(name='K4d', fontName='Helvetica', fontSize=6.2, leading=7.5, textColor=time_efficiency_color)),
        ]

        kpis_table = Table([[kpi_card_1, kpi_card_2, kpi_card_3, kpi_card_4]], colWidths=[135, 135, 135, 135])
        kpis_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, 0), dictamen_bg),
            ('BACKGROUND', (1, 0), (-1, -1), colors.HexColor('#ffffff')),
            ('BOX', (0, 0), (0, 0), 0.75, dictamen_border),
            ('BOX', (1, 0), (1, 0), 0.75, colors.HexColor('#cbd5e1')),
            ('BOX', (2, 0), (2, 0), 0.75, colors.HexColor('#cbd5e1')),
            ('BOX', (3, 0), (3, 0), 0.75, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        elements.append(kpis_table)
        elements.append(Spacer(1, 12))

        # 4. Desglose por Competencia / Area Tecnica con Barra de Progreso
        elements.append(Paragraph("<b>DESGLOSE POR COMPETENCIA / ÁREA TÉCNICA</b>", style_sec_header))
        elements.append(Spacer(1, 4))

        cat_rows = [
            [
                Paragraph("<b>COMPETENCIA</b>", style_small_bold),
                Paragraph("<b>REACTIVOS</b>", ParagraphStyle(name='HReact', fontName='Helvetica-Bold', fontSize=7, leading=9, alignment=1, textColor=colors.HexColor('#334155'))),
                Paragraph("<b>DESGLOSE ( ✔ / ✘ / ➖ )</b>", ParagraphStyle(name='HDesg', fontName='Helvetica-Bold', fontSize=7, leading=9, alignment=1, textColor=colors.HexColor('#334155'))),
                Paragraph("<b>APROVECHAMIENTO</b>", ParagraphStyle(name='HAprov', fontName='Helvetica-Bold', fontSize=7, leading=9, alignment=2, textColor=colors.HexColor('#334155'))),
            ]
        ]

        for row in self._build_session_category_rows(session):
            cat_name = row[0]
            cat_total = row[1]
            cat_correct = row[4]
            cat_incorrect = row[5]
            cat_omitted = row[3]
            cat_score = row[6]
            cat_possible = row[7]
            pct = int((cat_score / cat_possible) * 100) if cat_possible else 0

            # Barra de progreso visual integrada
            bar_total_w = 75
            fill_w = max(2, int(bar_total_w * (pct / 100.0)))
            empty_w = max(0, bar_total_w - fill_w)
            
            bar_color = colors.HexColor('#0f172a') if pct >= passing_score else colors.HexColor('#64748b')
            bar_inner = Table([['', '']], colWidths=[fill_w, empty_w], rowHeights=[6])
            bar_inner.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (0, 0), bar_color),
                ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#e2e8f0')),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ]))

            aprov_cell = Table(
                [[bar_inner, Paragraph(f"<b>{pct}%</b>", ParagraphStyle(name='PctR', fontName='Helvetica-Bold', fontSize=8, leading=9, alignment=2, textColor=colors.HexColor('#0f172a')))]],
                colWidths=[78, 32],
            )
            aprov_cell.setStyle(TableStyle([
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('LEFTPADDING', (0, 0), (-1, -1), 0),
                ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                ('TOPPADDING', (0, 0), (-1, -1), 0),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
            ]))

            omitted_part = f"  |  <font color='#64748b'>{cat_omitted} ➖</font>" if cat_omitted > 0 else ""
            cat_rows.append([
                Paragraph(f"<b>{cat_name}</b>", style_normal),
                Paragraph(str(cat_total), style_center),
                Paragraph(f"<font color='#16a34a'><b>{cat_correct} ✔</b></font>  |  <font color='#dc2626'><b>{cat_incorrect} ✘</b></font>{omitted_part}", style_center),
                aprov_cell,
            ])

        cat_table = Table(cat_rows, colWidths=[185, 65, 170, 120])
        cat_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(cat_table)
        elements.append(Spacer(1, 12))

        # 5. Conclusion del Dictamen Institucional
        if is_apto:
            conclusion_text = (
                f"El candidato <b>{candidate_name}</b> acreditó satisfactoriamente la evaluación con una calificación final de <b>{score_display}</b>, "
                f"superando el estándar mínimo institucional del {passing_display} para la posición <b>\"{session.evaluation_template.name}\"</b>. "
                f"Se dictamina como <b>APTO</b> para desempeñar las funciones del puesto."
            )
        else:
            conclusion_text = (
                f"El candidato <b>{candidate_name}</b> obtuvo una calificación final de <b>{score_display}</b>, "
                f"ubicándose por debajo del estándar mínimo del {passing_display} establecido para el puesto <b>\"{session.evaluation_template.name}\"</b>. "
                f"Se dictamina como <b>NO APTO</b>."
            )

        if cand_assistance == "partial":
            conclusion_text += "<br/><font color='#b45309'><b>Nota de Modalidad:</b> Evaluación con Acompañamiento / Asistencia Técnica en ejercicios prácticos (Ponderación al 50%).</font>"
        elif cand_assistance == "full":
            conclusion_text += "<br/><font color='#b91c1c'><b>Nota de Modalidad:</b> Evaluación realizada en Modalidad de Asistencia Total / Inducción Técnica.</font>"
        if session.assistance_notes:
            conclusion_text += f"<br/><i>Observaciones: {session.assistance_notes}</i>"

        conclusion_content = [
            Paragraph("<b>CONCLUSIÓN DEL DICTAMEN INSTITUCIONAL</b>", ParagraphStyle(name='C1', fontName='Helvetica-Bold', fontSize=7.5, leading=9, textColor=colors.HexColor('#0f172a'))),
            Spacer(1, 3),
            Paragraph(conclusion_text, ParagraphStyle(name='C2', fontName='Helvetica', fontSize=7.5, leading=10.5, textColor=colors.HexColor('#334155'))),
        ]

        conclusion_table = Table([[conclusion_content]], colWidths=[540])
        conclusion_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(conclusion_table)
        elements.append(Spacer(1, 10))

        # Pie de Pagina 1
        footer_p1 = Table(
            [[
                Paragraph(f"PROGRAMA DE EVALUACIÓN PARA CANDIDATOS {company_name.upper()} • REPORTE CONFIDENCIAL DE EVALUACIÓN", style_small),
                Paragraph("PÁGINA 1 DE 2", style_right),
            ]],
            colWidths=[400, 140],
        )
        footer_p1.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))
        elements.append(footer_p1)

        # =========================================================================
        # PAGINA 2: DETALLE TECNICO DE REACTIVOS Y FIRMAS FORMALES
        # =========================================================================
        elements.append(PageBreak())

        # Cabecera Pagina 2
        p2_left = [
            Paragraph(f"DETALLE TÉCNICO DE REACTIVOS • PROGRAMA DE EVALUACIÓN PARA CANDIDATOS {company_name.upper()}", style_subtitle),
            Paragraph(f"<b>CANDIDATO: {candidate_name.upper()} [{session.evaluation_template.name}]</b>", ParagraphStyle(name='P2Cand', fontName='Helvetica-Bold', fontSize=8.5, leading=11, textColor=colors.HexColor('#0f172a'))),
        ]
        p2_right = [
            Paragraph(f"<b>FOLIO #{session.id}</b>", ParagraphStyle(name='P2Folio', fontName='Helvetica-Bold', fontSize=9, leading=11, alignment=2, textColor=colors.HexColor('#0f172a'))),
        ]

        p2_header = Table([[p2_left, p2_right]], colWidths=[420, 120])
        p2_header.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (-1, -1), 1, colors.HexColor('#0f172a')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(p2_header)
        elements.append(Spacer(1, 6))

        # Tabla de Reactivos
        question_rows = [
            [
                Paragraph("<b>#</b>", style_center_bold),
                Paragraph("<b>ÁREA</b>", style_small_bold),
                Paragraph("<b>PLANTEAMIENTO</b>", style_small_bold),
                Paragraph("<b>RESPUESTA REGISTRADA</b>", style_small_bold),
                Paragraph("<b>DICTAMEN</b>", style_center_bold),
                Paragraph("<b>TIEMPO</b>", ParagraphStyle(name='TTime', fontName='Helvetica-Bold', fontSize=7, leading=9, alignment=2, textColor=colors.HexColor('#334155'))),
            ]
        ]
        
        for section in session.sections:
            for session_question in section.questions:
                statement_clean = (session_question.question.statement or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                answer_clean = (session_question.selected_answer or "Sin responder").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                
                if session_question.is_correct:
                    result_badge = "<font color='#15803d'><b>✔ Correcto</b></font>"
                elif session_question.is_correct is False:
                    result_badge = "<font color='#b91c1c'><b>✘ Incorrecto</b></font>"
                else:
                    result_badge = "<font color='#64748b'><b>➖ Omitida</b></font>"

                question_rows.append([
                    Paragraph(str(session_question.sort_order), style_center),
                    Paragraph(session_question.question.category.name if session_question.question.category else "-", style_small),
                    Paragraph(statement_clean, style_small),
                    Paragraph(answer_clean, style_small),
                    Paragraph(result_badge, style_center),
                    Paragraph(self._format_duration(session_question.time_spent_seconds), ParagraphStyle(name='TQTime', fontName='Helvetica', fontSize=7, leading=9, alignment=2, textColor=colors.HexColor('#64748b'))),
                ])

        questions_table = Table(question_rows, colWidths=[18, 80, 220, 117, 60, 45])
        
        tstyle = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
            ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0, 0), (-1, -1), 2.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]
        for row_i in range(1, len(question_rows)):
            if row_i % 2 == 0:
                tstyle.append(('BACKGROUND', (0, row_i), (-1, row_i), colors.HexColor('#f8fafc')))
        questions_table.setStyle(TableStyle(tstyle))
        elements.append(questions_table)
        elements.append(Spacer(1, 10))

        # Bloque Formal de 2 Firmas (Candidato / Sustentante y Evaluador Tecnico con amplio espacio para firmar a mano)
        signatures_data = [
            [
                Spacer(1, 48),
                Paragraph("", style_normal),
                Spacer(1, 48),
            ],
            [
                Paragraph(f"<b>{candidate_name.upper()}</b>", style_center_bold),
                Paragraph("", style_normal),
                Paragraph("<b>EVALUADOR / RESPONSABLE TÉCNICO</b>", style_center_bold),
            ],
            [
                Paragraph("Firma de Conformidad del Candidato", style_center),
                Paragraph("", style_normal),
                Paragraph("Firma y Sello de Validación Técnica", style_center),
            ],
        ]
        signatures_table = Table(signatures_data, colWidths=[230, 80, 230])
        signatures_table.setStyle(TableStyle([
            ('LINEBELOW', (0, 0), (0, 0), 1, colors.HexColor('#475569')),
            ('LINEBELOW', (2, 0), (2, 0), 1, colors.HexColor('#475569')),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))

        footer_p2 = Table(
            [[
                Paragraph(f"PROGRAMA DE EVALUACIÓN PARA CANDIDATOS {company_name.upper()} • REPORTE CONFIDENCIAL DE EVALUACIÓN", style_small),
                Paragraph("PÁGINA 2 DE 2", style_right),
            ]],
            colWidths=[400, 140],
        )
        footer_p2.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ]))

        elements.append(KeepTogether([
            signatures_table,
            Spacer(1, 8),
            footer_p2,
        ]))

        document.build(elements)
        output.seek(0)
        filename = (
            f"reporte_ejecutivo_{self._safe_filename(candidate_name)}"
            f"_sesion_{session.id}.pdf"
        )
        return output, filename

    def _get_question_result_label(self, session_question, styles) -> object:
        if session_question.question.question_type == "excel_practical" and session_question.practical_feedback:
            import json
            try:
                fb = json.loads(session_question.practical_feedback)
                lines = [f"<b>{fb.get('correct_cells', 0)}/{fb.get('total_cells', 0)} aciertos</b>"]
                
                criteria_results = fb.get("criteria_results", {})
                if criteria_results:
                    for c_name, c_data in criteria_results.items():
                        c_correct = c_data.get("correct", 0)
                        c_total = c_data.get("total", 0)
                        pct = int(c_data.get("success_rate", 0) * 100)
                        lines.append(f"• {c_name}: {c_correct}/{c_total} ({pct}%)")
                        
                from reportlab.platypus import Paragraph
                return Paragraph("<br/>".join(lines), styles["Normal"])
            except Exception:
                pass
        
        if session_question.is_correct:
            return "Correcta"
        if session_question.is_correct is False:
            return "Incorrecta"
        return "Omitida"

    def _get_finished_sessions(self) -> list[EvaluationSession]:
        sessions = self.repository.list_all_for_dashboard()
        return [session for session in sessions if session.status in self.FINISHED_STATUSES]

    def _get_session_or_404(self, session_id: int) -> EvaluationSession:
        session = self.repository.get_by_id(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="La sesion no existe.",
            )
        return session

    def _build_report_session_item(self, session: EvaluationSession) -> ReportSessionItemRead:
        return ReportSessionItemRead(
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
            assistance_level=getattr(session, "assistance_level", "none") or "none",
            assistance_notes=getattr(session, "assistance_notes", None),
        )

    def _build_candidate_name(self, session: EvaluationSession) -> str:
        return f"{session.candidate.first_name} {session.candidate.last_name}".strip()

    def _calculate_average_score_percentage(self, sessions: list[EvaluationSession]) -> float:
        if not sessions:
            return 0.0
        return round(
            sum(self._calculate_session_score_percentage(session) for session in sessions)
            / len(sessions),
            2,
        )

    def _calculate_average_time_seconds(self, sessions: list[EvaluationSession]) -> float:
        if not sessions:
            return 0.0
        return round(
            sum(session.consumed_time_seconds for session in sessions) / len(sessions),
            2,
        )

    def _calculate_session_score_percentage(self, session: EvaluationSession) -> float:
        score_possible = 0.0
        score_obtained = 0.0
        assistance = getattr(session, "assistance_level", "none") or "none"

        for section in session.sections:
            for session_question in section.questions:
                score_possible += session_question.question.score
                if session_question.question.question_type == "excel_practical":
                    if assistance == "full":
                        pass
                    elif assistance == "partial":
                        if session_question.is_correct:
                            score_obtained += session_question.question.score * 0.5
                    elif session_question.is_correct:
                        score_obtained += session_question.question.score
                elif session_question.is_correct:
                    score_obtained += session_question.question.score

        if score_possible == 0:
            return 0.0

        return round((score_obtained / score_possible) * 100, 2)

    def update_session_assistance(
        self,
        session_id: int,
        assistance_level: str,
        assistance_notes: str | None = None,
    ) -> ReportSessionDetailRead:
        session = self._get_session_or_404(session_id)
        if assistance_level not in {"none", "partial", "full"}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nivel de asistencia invalido. Use 'none', 'partial' o 'full'.",
            )
        session.assistance_level = assistance_level
        session.assistance_notes = assistance_notes

        total = 0.0
        for section in session.sections:
            for sq in section.questions:
                if sq.question.question_type == "excel_practical":
                    if assistance_level == "partial":
                        if sq.is_correct:
                            total += sq.question.score * 0.5
                    elif assistance_level == "full":
                        pass
                    elif sq.is_correct:
                        total += sq.question.score
                elif sq.is_correct:
                    total += sq.question.score

        session.total_score = round(total, 2)
        self.db.commit()
        self.db.refresh(session)
        return self.get_session_detail(session.id)

    def _resolve_submission_path(self, raw_path: str | None, session_id: int | None = None) -> Path | None:
        if not raw_path:
            return None
        p = Path(raw_path)
        if p.exists() and p.is_file():
            return p
        clean_name = raw_path.replace("\\", "/").split("/")[-1]
        if session_id:
            candidate = self.settings.excel_submission_storage_dir / str(session_id) / clean_name
            if candidate.exists() and candidate.is_file():
                return candidate
        candidate = self.settings.excel_submission_storage_dir / clean_name
        if candidate.exists() and candidate.is_file():
            return candidate
        return p

    def get_session_detail(self, session_id: int) -> ReportSessionDetailRead:
        session = self._get_session_or_404(session_id)
        
        category_rows = self._build_session_category_rows(session)
        categories = []
        for row in category_rows:
            score_possible = float(row[7])
            score_obtained = float(row[6])
            categories.append(ReportCategoryMetricRead(
                category_name=str(row[0]),
                total_questions=int(row[1]),
                answered_questions=int(row[2]),
                omitted_questions=int(row[3]),
                correct_questions=int(row[4]),
                incorrect_questions=int(row[5]),
                score_percentage=float(f"{(score_obtained / score_possible * 100):.2f}") if score_possible > 0 else 0.0
            ))

        questions = []
        for section in session.sections:
            for session_question in section.questions:
                resolved_sub = self._resolve_submission_path(session_question.practical_submission_path, session.id)
                has_sub = bool(
                    resolved_sub and resolved_sub.exists()
                )
                questions.append(ReportQuestionResultRead(
                    session_question_id=session_question.id,
                    question_id=session_question.question_id,
                    sort_order=section.sort_order,
                    category_name=session_question.question.category.name,
                    question_type=session_question.question.question_type,
                    statement=session_question.question.statement or "",
                    selected_answer=session_question.selected_answer,
                    correct_answer=session_question.question.correct_answer,
                    result_label=self._get_question_result_label_str(session_question),
                    time_spent_seconds=session_question.time_spent_seconds,
                    has_practical_submission=has_sub,
                    practical_submission_filename=session_question.practical_submission_filename,
                ))

        total_correct = sum(1 for q in questions if "Correcta" in q.result_label or "acierto" in q.result_label)
        precision_percentage = round((total_correct / len(questions) * 100), 2) if questions else 0.0

        return ReportSessionDetailRead(
            session_id=session.id,
            candidate_name=self._build_candidate_name(session),
            template_name=session.evaluation_template.name,
            status=session.status,
            score_percentage=self._calculate_session_score_percentage(session),
            precision_percentage=precision_percentage,
            consumed_time_seconds=session.consumed_time_seconds,
            started_at=self._normalize_datetime(session.started_at),
            submitted_at=self._normalize_datetime(session.submitted_at) if session.submitted_at else None,
            assistance_level=getattr(session, "assistance_level", "none") or "none",
            assistance_notes=getattr(session, "assistance_notes", None),
            categories=categories,
            questions=questions,
        )

    def get_candidate_excel_submission(
        self,
        session_id: int,
        session_question_id: int,
    ) -> tuple[BytesIO, str]:
        session = self._get_session_or_404(session_id)
        session_question = None
        for section in session.sections:
            for sq in section.questions:
                if sq.id == session_question_id or sq.question_id == session_question_id:
                    session_question = sq
                    break
            if session_question:
                break

        if not session_question or not session_question.practical_submission_path:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontro ningun archivo entregado por el candidato para este reactivo.",
            )

        file_path = self._resolve_submission_path(session_question.practical_submission_path, session.id)
        if not file_path or not file_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="El archivo entregado ya no se encuentra disponible en el servidor.",
            )

        with open(file_path, "rb") as f:
            content = BytesIO(f.read())

        candidate_name = self._safe_filename(self._build_candidate_name(session))
        orig_filename = session_question.practical_submission_filename or f"entrega_candidato_{candidate_name}_sesion_{session_id}.xlsx"
        return content, orig_filename

    def _get_question_result_label_str(self, session_question) -> str:
        if session_question.question.question_type == "excel_practical" and session_question.practical_feedback:
            import json
            try:
                fb = json.loads(session_question.practical_feedback)
                return f"{fb.get('correct_cells', 0)}/{fb.get('total_cells', 0)} aciertos"
            except Exception:
                pass
        
        if session_question.is_correct:
            return "Correcta"
        if session_question.is_correct is False:
            return "Incorrecta"
        return "Omitida"

    def _build_session_category_rows(self, session: EvaluationSession) -> list[list[object]]:
        category_metrics: dict[str, dict[str, float | int]] = {}

        for section in session.sections:
            for session_question in section.questions:
                category_name = session_question.question.category.name
                metrics = category_metrics.setdefault(
                    category_name,
                    {
                        "total_questions": 0,
                        "answered_questions": 0,
                        "omitted_questions": 0,
                        "correct_questions": 0,
                        "incorrect_questions": 0,
                        "score_obtained": 0.0,
                        "score_possible": 0.0,
                    },
                )

                metrics["total_questions"] += 1
                metrics["score_possible"] += session_question.question.score

                if session_question.is_answered:
                    metrics["answered_questions"] += 1
                    if session_question.question.question_type == "excel_practical":
                        fb = None
                        if session_question.practical_feedback:
                            try:
                                fb = json.loads(session_question.practical_feedback)
                            except Exception:
                                pass
                        sr = float(fb.get("success_rate", 1.0 if session_question.is_correct else 0.0)) if fb else (1.0 if session_question.is_correct else 0.0)
                        if sr >= 0.70:
                            metrics["correct_questions"] += 1
                        else:
                            metrics["incorrect_questions"] += 1
                        metrics["score_obtained"] += session_question.question.score * sr
                    else:
                        if session_question.is_correct:
                            metrics["correct_questions"] += 1
                            metrics["score_obtained"] += session_question.question.score
                        else:
                            metrics["incorrect_questions"] += 1
                elif session_question.was_omitted:
                    metrics["omitted_questions"] += 1

        return [
            [
                category_name,
                int(metrics["total_questions"]),
                int(metrics["answered_questions"]),
                int(metrics["omitted_questions"]),
                int(metrics["correct_questions"]),
                int(metrics["incorrect_questions"]),
                round(float(metrics["score_obtained"]), 2),
                round(float(metrics["score_possible"]), 2),
            ]
            for category_name, metrics in sorted(category_metrics.items())
        ]

    def _style_table_sheet(self, worksheet) -> None:
        for cell in worksheet[1]:
            cell.font = Font(bold=True)

        for column_cells in worksheet.columns:
            max_length = 0
            column_letter = column_cells[0].column_letter
            for cell in column_cells:
                cell_value = "" if cell.value is None else str(cell.value)
                max_length = max(max_length, len(cell_value))
            worksheet.column_dimensions[column_letter].width = min(max_length + 2, 45)

    def _style_headerless_key_value_sheet(self, worksheet) -> None:
        for cell in worksheet["A"]:
            cell.font = Font(bold=True)

        worksheet.column_dimensions["A"].width = 28
        worksheet.column_dimensions["B"].width = 40

    def _apply_pdf_table_style(self, table: Table) -> None:
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )

    def _format_datetime(self, value: datetime | None) -> str:
        if value is None:
            return "Sin dato"
        normalized = self._normalize_datetime(value)
        return normalized.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    def _format_duration(self, seconds: float | int) -> str:
        total_seconds = max(0, int(round(seconds)))
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60
        remaining_seconds = total_seconds % 60

        if hours:
            return f"{hours}h {minutes:02d}m"
        if minutes:
            return f"{minutes}m {remaining_seconds:02d}s"
        return f"{remaining_seconds}s"

    def _truncate_text(self, value: str, length: int) -> str:
        if len(value) <= length:
            return value
        return f"{value[: length - 3]}..."

    def _safe_filename(self, value: str) -> str:
        normalized = re.sub(r"[^A-Za-z0-9]+", "_", value.strip())
        return normalized.strip("_").lower() or "reporte"

    def _normalize_datetime(self, value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
