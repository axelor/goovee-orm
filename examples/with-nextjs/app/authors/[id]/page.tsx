import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/goovee";
import { FormattedDate } from "@/app/components/FormattedDate";

interface AuthorPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { id } = await params;
  const client = await getClient();

  const author = await client.author.findOne({
    where: { id: { eq: id } },
    select: {
      id: true,
      name: true,
      email: true,
      bio: true,
      website: true,
      joinedOn: true,
    },
  });

  if (!author) {
    notFound();
  }

  // Get posts by this author
  const posts = await client.post.find({
    where: {
      author: {
        id: { eq: id },
      },
    },
    orderBy: { publishedOn: "DESC" },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      status: true,
      publishedOn: true,
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8">
          <Link
            href="/authors"
            className="inline-flex items-center text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
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
            Back to authors
          </Link>
        </div>

        <article className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 md:p-12">
          <header className="mb-8">
            <div className="flex items-start gap-6 mb-6">
              <div className="w-24 h-24 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-semibold text-4xl flex-shrink-0">
                {author.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-black dark:text-zinc-50 mb-2">
                  {author.name}
                </h1>
                <div className="text-zinc-600 dark:text-zinc-400 mb-2">
                  {author.email}
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-500">
                  Joined{" "}
                  <FormattedDate value={author.joinedOn} format="date-only" />
                </div>
              </div>
            </div>

            {author.bio && (
              <p className="text-lg text-zinc-700 dark:text-zinc-300 mb-4">
                {author.bio}
              </p>
            )}

            {author.website && (
              <a
                href={author.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
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
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Visit website
              </a>
            )}
          </header>

          <section className="border-t border-zinc-200 dark:border-zinc-800 pt-8">
            <h2 className="text-2xl font-bold text-black dark:text-zinc-50 mb-6">
              Posts by {author.name}
            </h2>

            {posts.length === 0 ? (
              <p className="text-zinc-600 dark:text-zinc-400">No posts yet.</p>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.slug}`}
                    className="block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 transition-all hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow"
                  >
                    <h3 className="text-xl font-semibold text-black dark:text-zinc-50 mb-2">
                      {post.title}
                    </h3>
                    {post.content && (
                      <p className="text-zinc-600 dark:text-zinc-400 mb-2 line-clamp-2">
                        {post.content}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-500">
                      {post.publishedOn && (
                        <FormattedDate
                          value={post.publishedOn}
                          format="short"
                        />
                      )}
                      {post.status && (
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                          {post.status}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </article>
      </main>
    </div>
  );
}
