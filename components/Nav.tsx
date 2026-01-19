import Link from "next/link";

export default function Nav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/70 backdrop-blur-lg">
      <div className="mx-auto max-w-2xl px-6">
        <div className="flex h-16 items-center justify-between">
          <Link
            href="/"
            className="text-lg font-semibold text-gray-900 hover:text-gray-900"
          >
            <span className="bg-gradient-to-r from-indigo-600 to-indigo-500 bg-clip-text text-transparent">
              CollabSpace
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Feed
            </Link>
            <Link
              href="/posts/new"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              New Post
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
