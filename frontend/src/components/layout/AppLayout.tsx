import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Globe2,
  CalendarDays,
  FileText,
  Settings,
  ListChecks,
  Newspaper,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/UserMenu";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

const navKeys = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/websites", labelKey: "nav.websites", icon: Globe2 },
  { to: "/planner", labelKey: "nav.planner", icon: CalendarDays },
  { to: "/topics", labelKey: "nav.topics", icon: ListChecks },
  { to: "/articles", labelKey: "nav.articles", icon: Newspaper },
  { to: "/calendar", labelKey: "nav.calendar", icon: CalendarDays },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
];

function headerForPath(pathname: string, t: (k: string) => string) {
  if (pathname.startsWith("/websites/") && pathname !== "/websites") {
    return { title: t("route.websiteDetail.title"), subtitle: t("route.websiteDetail.sub") };
  }
  if (pathname.includes("/review")) {
    return { title: t("route.topicReview.title"), subtitle: t("route.topicReview.sub") };
  }
  if (pathname.includes("/edit")) {
    return { title: t("route.articleEdit.title"), subtitle: t("route.articleEdit.sub") };
  }
  const routeTitles: Record<string, { titleKey: string; subtitleKey: string }> = {
    "/dashboard": { titleKey: "route.dashboard.title", subtitleKey: "route.dashboard.sub" },
    "/websites": { titleKey: "route.websites.title", subtitleKey: "route.websites.sub" },
    "/planner": { titleKey: "route.planner.title", subtitleKey: "route.planner.sub" },
    "/topics": { titleKey: "route.topics.title", subtitleKey: "route.topics.sub" },
    "/articles": { titleKey: "route.articles.title", subtitleKey: "route.articles.sub" },
    "/calendar": { titleKey: "route.calendar.title", subtitleKey: "route.calendar.sub" },
    "/settings": { titleKey: "route.settings.title", subtitleKey: "route.settings.sub" },
  };
  const r = routeTitles[pathname];
  if (r) return { title: t(r.titleKey), subtitle: t(r.subtitleKey) };
  return { title: t("header.defaultTitle"), subtitle: t("header.defaultSubtitle") };
}

export function AppLayout() {
  const t = useI18n();
  const location = useLocation();
  const header = headerForPath(location.pathname, t);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] md:flex">
        <div className="flex h-16 items-center border-b border-[var(--color-border)] px-4">
          <Link to="/dashboard" className="block min-w-0 py-1">
            <img
              src="/logo_zettaword_long.png"
              alt={t("app.name")}
              className="h-9 w-auto max-w-[200px] object-contain object-left"
            />
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-3">
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-muted)]">
            {t("nav.workspace")}
          </p>
          {navKeys.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900",
                  isActive && "bg-violet-50 font-semibold text-violet-900 shadow-sm ring-1 ring-violet-100"
                )
              }
            >
              <item.icon className="h-[18px] w-[18px] shrink-0 opacity-80" />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-[var(--color-border)] p-4">
          <p className="mb-3 line-clamp-2 px-1 text-xs leading-relaxed text-[var(--color-muted)]">{t("layout.footerNote")}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-[var(--color-background)]">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 backdrop-blur-md md:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 md:hidden"
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              aria-label={t("layout.mobileNav")}
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-zinc-900 md:text-base">{header.title}</h2>
              {header.subtitle && (
                <p className="hidden truncate text-xs text-[var(--color-muted)] sm:block">{header.subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 text-xs text-[var(--color-muted)] lg:flex">
              <FileText className="h-3.5 w-3.5" />
              {t("layout.aiBadge")}
            </span>
            <UserMenu />
          </div>
        </header>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden" role="dialog">
            <button
              type="button"
              className="absolute inset-0 bg-zinc-900/40"
              aria-label={t("common.cancel")}
              onClick={() => setMobileNavOpen(false)}
            />
            <nav className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-[var(--color-border)] bg-white shadow-xl">
              <div className="flex h-14 shrink-0 items-center border-b border-[var(--color-border)] px-4">
                <img
                  src="/logo_zettaword_long.png"
                  alt={t("app.name")}
                  className="h-8 w-auto max-w-[180px] object-contain object-left"
                />
              </div>
              <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
              {navKeys.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileNavOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                      isActive ? "bg-violet-50 text-violet-900" : "text-zinc-700"
                    )
                  }
                >
                  <item.icon className="h-[18px] w-[18px]" />
                  {t(item.labelKey)}
                </NavLink>
              ))}
              </div>
            </nav>
          </div>
        )}

        <main className="flex-1 px-4 py-8 md:px-8 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
