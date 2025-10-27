import Link from "next/link";
import { getClient } from "@/goovee";
import { FormattedDate } from "../components/FormattedDate";

export default async function AuthorsPage() {
  const client = await getClient();
  const authors = await client.author.find({
    orderBy: { name: "ASC" },
    select: {
      id: true,
      name: true,
      email: true,
      bio: true,
      website: true,
      joinedOn: true,
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors mb-4"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to posts
          </Link>
          <h1 className="text-4xl font-bold text-black dark:text-zinc-50 mb-2">
            Authors
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Meet our writers
          </p>
        </div>

        <div className="space-y-6">
          {authors.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
              <p className="text-zinc-600 dark:text-zinc-400">
                No authors found.
              </p>
            </div>
          ) : (
            authors.map((author) => (
              <Link
                key={author.id}
                href={`/authors/${author.id}`}
                className="block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-semibold text-xl flex-shrink-0">
                    {author.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold text-black dark:text-zinc-50 mb-1">
                      {author.name}
                    </h2>
                    <div className="text-sm text-zinc-500 dark:text-zinc-500 mb-3">
                      {author.email}
                    </div>
                    {author.bio && (
                      <p className="text-zinc-600 dark:text-zinc-400 mb-3">
                        {author.bio}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-500">
                      <span>
                        Joined{" "}
                        <FormattedDate
                          value={author.joinedOn}
                          format="date-only"
                        />
                      </span>
                      {author.website && (
                        <span className="text-zinc-600 dark:text-zinc-400">
                          {author.website}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
