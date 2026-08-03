import Link from "next/link"

function pageItems(currentPage: number, totalPages: number) {
  const pages = new Set<number>([1, totalPages])
  for (let n = currentPage - 2; n <= currentPage + 2; n++) {
    if (n >= 1 && n <= totalPages) pages.add(n)
  }

  const sorted = Array.from(pages).sort((a, b) => a - b)
  const items: Array<number | "..."> = []
  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i]
    const prev = sorted[i - 1]
    if (prev && page - prev > 1) items.push("...")
    items.push(page)
  }
  return items
}

export function AdminPagination({
  page,
  totalPages,
  hrefForPage,
}: {
  page: number
  totalPages: number
  hrefForPage: (page: number) => string
}) {
  const baseClass = "inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border px-3 text-sm font-medium transition"
  const activeClass = "border-blue-600 bg-blue-600 text-white"
  const linkClass = "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
  const disabledClass = "border-slate-100 bg-white text-slate-300"

  return (
    <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Pagination">
      {page > 1 ? (
        <Link href={hrefForPage(1)} className={`${baseClass} ${linkClass}`}>Awal</Link>
      ) : (
        <span className={`${baseClass} ${disabledClass}`}>Awal</span>
      )}
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)} className={`${baseClass} ${linkClass}`}>Sebelumnya</Link>
      ) : (
        <span className={`${baseClass} ${disabledClass}`}>Sebelumnya</span>
      )}

      {pageItems(page, totalPages).map((item, index) =>
        item === "..." ? (
          <span key={`ellipsis-${index}`} className="px-1 text-sm font-medium text-slate-400">...</span>
        ) : item === page ? (
          <span key={item} className={`${baseClass} ${activeClass}`} aria-current="page">{item}</span>
        ) : (
          <Link key={item} href={hrefForPage(item)} className={`${baseClass} ${linkClass}`}>{item}</Link>
        )
      )}

      {page < totalPages ? (
        <Link href={hrefForPage(page + 1)} className={`${baseClass} ${linkClass}`}>Berikutnya</Link>
      ) : (
        <span className={`${baseClass} ${disabledClass}`}>Berikutnya</span>
      )}
      {page < totalPages ? (
        <Link href={hrefForPage(totalPages)} className={`${baseClass} ${linkClass}`}>Akhir</Link>
      ) : (
        <span className={`${baseClass} ${disabledClass}`}>Akhir</span>
      )}
    </nav>
  )
}
