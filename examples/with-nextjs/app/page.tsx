import Link from "next/link";
import { getClient } from "@/goovee";
import { FormattedDate } from "./components/FormattedDate";

export default async function Home() {
  const client = await getClient();
  const posts = await client.post.find({
    orderBy: { publishedOn: "DESC" },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      status: true,
      publishedOn: true,
      author: {
        id: true,
        name: true,
      },
    },
  });

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold text-black dark:text-zinc-50">
              Blog Posts
            </h1>
            <Link
              href="/authors"
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-white transition-colors"
            >
              View all authors →
            </Link>
          </div>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Explore our collection of articles
          </p>
        </div>

        <div className="space-y-6">
          {posts.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
              <p className="text-zinc-600 dark:text-zinc-400">
                No blog posts yet. Create your first post to get started!
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="block rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <Link href={`/posts/${post.slug}`}>
                      <h2 className="text-2xl font-semibold text-black dark:text-zinc-50 mb-2 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
                        {post.title}
                      </h2>
                    </Link>
                    {post.content && (
                      <p className="text-zinc-600 dark:text-zinc-400 mb-3 line-clamp-2">
                        {post.content}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-500">
                      {post.author && (
                        <Link
                          href={`/authors/${post.author.id}`}
                          className="hover:text-black dark:hover:text-white transition-colors"
                        >
                          By {post.author.name}
                        </Link>
                      )}
                      {post.publishedOn && (
                        <FormattedDate value={post.publishedOn} format="full" />
                      )}
                      {post.status && (
                        <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                          {post.status}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
