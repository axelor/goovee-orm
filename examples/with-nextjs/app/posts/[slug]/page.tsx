import Link from "next/link";
import { notFound } from "next/navigation";
import { getClient } from "@/goovee";
import { FormattedDate } from "@/app/components/ClientFormattedDate";

interface PostPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const client = await getClient();

  const post = await client.post.findOne({
    where: { slug: { eq: slug } },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      status: true,
      publishedOn: true,
      createdOn: true,
      author: {
        id: true,
        name: true,
        email: true,
        bio: true,
        website: true,
      },
    },
  });

  if (!post) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8">
          <Link
            href="/"
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
            Back to all posts
          </Link>
        </div>

        <article className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 md:p-12">
          <header className="mb-8">
            {post.status && (
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 mb-4">
                {post.status}
              </span>
            )}
            <h1 className="text-4xl md:text-5xl font-bold text-black dark:text-zinc-50 mb-4">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              {post.author && (
                <Link
                  href={`/authors/${post.author.id}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-semibold">
                    {post.author.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-black dark:text-zinc-50">
                      {post.author.name}
                    </div>
                    {post.author.email && (
                      <div className="text-xs text-zinc-500 dark:text-zinc-500">
                        {post.author.email}
                      </div>
                    )}
                  </div>
                </Link>
              )}
              {post.publishedOn && (
                <span className="text-zinc-500 dark:text-zinc-500">
                  Published on{" "}
                  <FormattedDate value={post.publishedOn} format="full" />
                </span>
              )}
            </div>
          </header>

          {post.content && (
            <div className="prose prose-zinc dark:prose-invert max-w-none">
              <div className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
                {post.content}
              </div>
            </div>
          )}

          {post.author && (post.author.bio || post.author.website) && (
            <footer className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-3">
                About the Author
              </h3>
              <Link
                href={`/authors/${post.author.id}`}
                className="flex items-start gap-4 hover:opacity-80 transition-opacity"
              >
                <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-semibold text-xl flex-shrink-0">
                  {post.author.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="font-medium text-black dark:text-zinc-50 mb-1">
                    {post.author.name}
                  </div>
                  {post.author.bio && (
                    <p className="text-zinc-600 dark:text-zinc-400 mb-2">
                      {post.author.bio}
                    </p>
                  )}
                  {post.author.website && (
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      Visit website →
                    </span>
                  )}
                </div>
              </Link>
            </footer>
          )}
        </article>
      </main>
    </div>
  );
}
