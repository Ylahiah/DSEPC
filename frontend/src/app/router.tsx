import { Users } from 'lucide-react'
import { createBrowserRouter } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { ProtectedRoute } from '@/components/protected-route'
import { AccessCodesPage } from '@/pages/access-codes-page'
import { AdminDashboardPage } from '@/pages/admin-dashboard-page'
import { AdminLoginPage } from '@/pages/admin-login-page'
import { CandidateAccessPage } from '@/pages/candidate-access-page'
import { EvaluationTemplatesPage } from '@/pages/evaluation-templates-page'
import { NotFoundPage } from '@/pages/not-found-page'
import { PlaceholderPage } from '@/pages/placeholder-page'
import { QuestionBankPage } from '@/pages/question-bank-page'
import { ReportsPage } from '@/pages/reports-page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AdminLoginPage />,
  },
  {
    path: '/candidato',
    element: <CandidateAccessPage />,
  },
  {
    path: '/admin/login',
    element: <AdminLoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/admin',
        element: <AppShell />,
        children: [
          {
            index: true,
            element: <AdminDashboardPage />,
          },
          {
            path: 'preguntas',
            element: <QuestionBankPage />,
          },
          {
            path: 'evaluaciones',
            element: <EvaluationTemplatesPage />,
          },
          {
            path: 'codigos',
            element: <AccessCodesPage />,
          },
          {
            path: 'candidatos',
            element: (
              <PlaceholderPage
                title="Gestion de candidatos"
                description="Esta vista alojara el padron de candidatos, intentos y resultados."
                icon={Users}
              />
            ),
          },
          {
            path: 'reportes',
            element: <ReportsPage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])
