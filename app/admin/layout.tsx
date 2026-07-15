import { Sidebar } from "@/components/dashboard/sidebar"
import { Navbar } from "@/components/dashboard/navbar"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar serverSession={session} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar />
        <main className="w-full flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}