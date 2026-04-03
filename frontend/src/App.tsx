import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { WebsitesPage } from "@/pages/WebsitesPage";
import { WebsiteDetailPage } from "@/pages/WebsiteDetailPage";
import { PlannerPage } from "@/pages/PlannerPage";
import { TopicsPage } from "@/pages/TopicsPage";
import { TopicReviewPage } from "@/pages/TopicReviewPage";
import { ArticleEditorPage } from "@/pages/ArticleEditorPage";
import { CalendarPage } from "@/pages/CalendarPage";
import { ArticlesPage } from "@/pages/ArticlesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { I18nProvider } from "@/i18n/I18nContext";

const qc = new QueryClient();

function Protected({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <Protected>
                <AppLayout />
              </Protected>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/websites" element={<WebsitesPage />} />
            <Route path="/websites/:id" element={<WebsiteDetailPage />} />
            <Route path="/planner" element={<PlannerPage />} />
            <Route path="/topics" element={<TopicsPage />} />
            <Route path="/topics/:id/review" element={<TopicReviewPage />} />
            <Route path="/articles" element={<ArticlesPage />} />
            <Route path="/articles/:id/edit" element={<ArticleEditorPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
      </I18nProvider>
    </QueryClientProvider>
  );
}
