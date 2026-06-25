"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"

type Log = {
  id: string
  namaFile: string | null
  status: string
  errorMessage: string | null
  signedAt: string
}

type Batch = {
  id: string
  batchCode: string
  jenisSk: string
  total: number
  successCount: number
  errorCount: number
  zipFileName: string | null
  reportFileName: string | null
  signedBy: string
  createdAt: string
}

type Props = {
  batches: Batch[]
  page: number
  totalPages: number
  totalBatches: number
}

function BatchTable({ batch }: { batch: Batch }) {
  const [logPage, setLogPage] = useState(1)
  const [logs, setLogs] = useState<Log[]>([])
  const [totalLogs, setTotalLogs] = useState(0)
  const [totalLogPages, setTotalLogPages] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchLogs = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/qr-signer/api/sign-log/${batch.id}?page=${p}`)
      const data = await res.json()
      setLogs(data.logs)
      setTotalLogs(data.totalLogs)
      setTotalLogPages(data.totalPages)
      setLogPage(p)
    } catch {}
    setLoading(false)
  }, [batch.id])

  useEffect(() => {
    fetchLogs(1)
  }, [fetchLogs])

  function formatTime(dateStr: string) {
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "2-digit", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      {/* Header batch */}
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 bg-slate-50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-lg bg-slate-200 px-2 py-0.5 text-xs font-mono text-slate-600">
              {batch.batchCode}
            </span>
            <span className="rounded-lg bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {batch.jenisSk}
            </span>
            {batch.errorCount === 0 ? (
              <span className="rounded-lg bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✓ Semua Berhasil</span>
            ) : batch.successCount === 0 ? (
              <span className="rounded-lg bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">✗ Semua Gagal</span>
            ) : (
              <span className="rounded-lg bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">⚠ Sebagian Gagal</span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {formatTime(batch.createdAt)} · Oleh:{" "}
            <span className="font-medium text-slate-700">{batch.signedBy}</span>
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center">
            <p className="text-xl font-bold text-slate-800">{batch.total}</p>
            <p className="text-xs text-slate-400">Total</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-green-600">{batch.successCount}</p>
            <p className="text-xs text-slate-400">Berhasil</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-red-600">{batch.errorCount}</p>
            <p className="text-xs text-slate-400">Gagal</p>
          </div>
          {batch.zipFileName && (
            <a href={`/api/bulk-sk-download/${batch.zipFileName}`} download
              className="rounded-xl bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 transition">
              ⬇ ZIP
            </a>
          )}
          {batch.reportFileName && (
            <a href={`/api/bulk-sk-download/${batch.reportFileName}`} download
              className="rounded-xl border px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition">
              📊 Laporan
            </a>
          )}
        </div>
      </div>

      {/* Tabel dokumen */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700" />
            <span className="ml-2 text-sm text-slate-400">Memuat...</span>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-xs text-slate-500">
                <th className="px-4 py-3 text-left font-medium">No</th>
                <th className="px-4 py-3 text-left font-medium">Nama File</th>
                <th className="px-4 py-3 text-left font-medium">Waktu Sign</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Keterangan Error</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                    Tidak ada data
                  </td>
                </tr>
              )}
              {logs.map((log, idx) => (
                <tr key={log.id} className={log.status === "error" ? "bg-red-50" : ""}>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {(logPage - 1) * 10 + idx + 1}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 font-mono">
                    {log.namaFile || "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatTime(log.signedAt)}</td>
                  <td className="px-4 py-3">
                    {log.status === "success" ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">✓ Berhasil</span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">✗ Gagal</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-red-500">{log.errorMessage || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination log */}
      {totalLogPages > 1 && (
        <div className="flex items-center justify-between border-t px-4 py-3 bg-slate-50">
          <p className="text-xs text-slate-500">
            {(logPage - 1) * 10 + 1}–{Math.min(logPage * 10, totalLogs)} dari {totalLogs} dokumen
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => fetchLogs(1)} disabled={logPage === 1 || loading}
              className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">«</button>
            <button onClick={() => fetchLogs(logPage - 1)} disabled={logPage === 1 || loading}
              className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
            <span className="text-xs text-slate-600 px-2">{logPage} / {totalLogPages}</span>
            <button onClick={() => fetchLogs(logPage + 1)} disabled={logPage === totalLogPages || loading}
              className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">›</button>
            <button onClick={() => fetchLogs(totalLogPages)} disabled={logPage === totalLogPages || loading}
              className="rounded-lg border px-2.5 py-1 text-xs hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">»</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RiwayatSignClient({ batches, page, totalPages, totalBatches }: Props) {
  const router = useRouter()

  function goPage(p: number) {
    router.push(`/admin/riwayat-sign?page=${p}`)
  }

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...")
      acc.push(p)
      return acc
    }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Riwayat Sign</h1>
          <p className="text-slate-500">Jejak penandatanganan dokumen digital</p>
        </div>
        <span className="text-sm text-slate-400">{totalBatches} total batch</span>
      </div>

      {batches.length === 0 && (
        <div className="rounded-2xl border bg-white p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium text-slate-700">Belum ada riwayat sign</p>
          <p className="text-sm text-slate-400 mt-1">Riwayat akan muncul setelah melakukan Bulk Sign SK</p>
        </div>
      )}

      {batches.map((batch) => (
        <BatchTable key={batch.id} batch={batch} />
      ))}

      {/* PAGINATION BATCH */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border bg-white px-6 py-4">
          <p className="text-sm text-slate-500">
            Halaman <span className="font-medium text-slate-800">{page}</span> dari{" "}
            <span className="font-medium text-slate-800">{totalPages}</span>
          </p>
          <div className="flex items-center gap-1.5">
            <button onClick={() => goPage(1)} disabled={page === 1}
              className="rounded-lg border px-2.5 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">«</button>
            <button onClick={() => goPage(page - 1)} disabled={page === 1}
              className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">‹ Prev</button>

            {pageNumbers.map((p, idx) =>
              p === "..." ? (
                <span key={`e-${idx}`} className="px-2 text-xs text-slate-400">...</span>
              ) : (
                <button key={p} onClick={() => goPage(p as number)}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                    p === page ? "bg-slate-900 text-white border-slate-900" : "hover:bg-slate-50"
                  }`}>
                  {p}
                </button>
              )
            )}

            <button onClick={() => goPage(page + 1)} disabled={page === totalPages}
              className="rounded-lg border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">Next ›</button>
            <button onClick={() => goPage(totalPages)} disabled={page === totalPages}
              className="rounded-lg border px-2.5 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">»</button>
          </div>
        </div>
      )}
    </div>
  )
}