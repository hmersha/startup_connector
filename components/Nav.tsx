import Link from "next/link";

export default function Nav() {
  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-gray-900">
            CollabSpace
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-600 hover:text-gray-900">
              Home
            </Link>
            <Link href="/posts/new" className="text-gray-600 hover:text-gray-900">
              New Post
            </Link>
            <Link href="/login" className="text-gray-600 hover:text-gray-900">
              Login
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
