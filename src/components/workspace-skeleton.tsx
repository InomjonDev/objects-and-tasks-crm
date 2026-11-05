import { useLocation } from "react-router-dom"
import { Skeleton } from "./ui/skeleton"
import { useI18n } from "@/i18n"

export function WorkspaceSkeleton({ shell = false }: { shell?: boolean }) {
  const { pathname } = useLocation()
  const { t } = useI18n()
  const cards = pathname === "/" || pathname === "/projects"
  const content = (
    <>
      <div className="mb-8 space-y-3">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {cards ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-5 rounded-xl border p-6">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="mt-8 h-4 w-40" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {[0, 1].map((index) => (
            <div key={index} className="space-y-5 rounded-xl border p-6">
              <Skeleton className="h-6 w-40" />
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-10 w-full" />
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  )
  return (
    <div
      role="status"
      aria-label={t("Загружаем рабочее пространство…")}
      aria-busy="true"
    >
      <span className="sr-only">{t("Загружаем рабочее пространство…")}</span>
      {shell ? (
        <>
          <div className="border-b">
            <div className="mx-auto flex max-w-7xl items-center justify-between p-5 sm:px-8">
              <div className="flex gap-3">
                <Skeleton className="size-9" />
                <Skeleton className="h-9 w-40" />
              </div>
              <Skeleton className="h-9 w-24" />
            </div>
          </div>
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Skeleton className="my-5 h-8 w-44" />
            <div className="border-t pt-8">{content}</div>
          </div>
        </>
      ) : (
        content
      )}
    </div>
  )
}
