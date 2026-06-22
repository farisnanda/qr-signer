import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { DeleteUserButton } from "./DeleteUserButton"

export default async function UsersPage() {
  const session = await getServerSession(authOptions)

  if (session?.user?.role !== "SUPERADMIN") {
    redirect("/admin")
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
  })

  const bidangLabels: Record<string, string> = {
    "204.1": "Sekretariat",
    "204.2": "P3DASI",
    "204.3": "PKPH",
    "204.4": "Mutasi",
    "204.5": "Pengembangan",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manage User</h1>
          <p className="text-slate-500">Kelola akun pengguna sistem.</p>
        </div>
        <Link
          href="/admin/users/create"
          className="rounded-lg bg-black px-4 py-2 text-sm text-white hover:bg-slate-800"
        >
          + Tambah User
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-3 text-left">No</th>
              <th className="px-4 py-3 text-left">Nama</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Bidang</th>
              <th className="px-4 py-3 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Belum ada user
                </td>
              </tr>
            )}
            {users.map((user: any, index: number) => (
              <tr key={user.id} className="border-t hover:bg-slate-50">
                <td className="px-4 py-3 text-sm">{index + 1}</td>
                <td className="px-4 py-3 text-sm font-medium">{user.name ?? "-"}</td>
                <td className="px-4 py-3 text-sm">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={
                    "rounded-full px-3 py-1 text-xs font-medium " +
                    (user.role === "SUPERADMIN" ? "bg-red-100 text-red-700" :
                    user.role === "KABAN" ? "bg-purple-100 text-purple-700" :
                    "bg-blue-100 text-blue-700")
                  }>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">
                  {user.bidang ? (bidangLabels[user.bidang] || user.bidang) : "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <Link
                      href={"/admin/users/" + user.id + "/edit"}
                      className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-100"
                    >
                      Edit
                    </Link>
                    <DeleteUserButton userId={user.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}