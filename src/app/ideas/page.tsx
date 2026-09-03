import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppNav from "@/components/app-nav";
import IdeaSubmitForm from "./idea-submit-form";
import TopicCard from "./topic-card";

type TopicRow = {
  id: string;
  title: string;
  summary: string | null;
  category: string;
  status: "open" | "addressed";
  addressed_at: string | null;
  decision_summary: string | null;
  addressed_notes: string | null;
  created_at: string;
};

type IdeaRow = {
  id: string;
  topic_id: string;
  title: string;
  body: string;
  author_display_name: string | null;
  is_anonymous: boolean;
  created_at: string;
};

export default async function IdeasPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, full_name, email")
    .eq("id", user.id)
    .single();
  if (!profile || profile.status === "pending") redirect("/verify");

  const isAdmin = profile.role === "admin";

  const [{ data: topics }, { data: ideas }, { data: voteCounts }, { data: myVotes }] =
    await Promise.all([
      supabase
        .from("idea_topics")
        .select("id, title, summary, category, status, addressed_at, decision_summary, addressed_notes, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("ideas")
        .select("id, topic_id, title, body, author_display_name, is_anonymous, created_at")
        .order("created_at", { ascending: true }),
      supabase.rpc("get_idea_vote_counts"),
      supabase.from("idea_votes").select("topic_id, vote_value").eq("voter_id", user.id),
    ]);

  const ideasByTopic = new Map<string, IdeaRow[]>();
  for (const idea of (ideas ?? []) as IdeaRow[]) {
    const list = ideasByTopic.get(idea.topic_id) ?? [];
    list.push(idea);
    ideasByTopic.set(idea.topic_id, list);
  }

  const countsByTopic = new Map<string, { upvotes: number; downvotes: number }>();
  for (const row of (voteCounts ?? []) as { topic_id: string; upvotes: number; downvotes: number }[]) {
    countsByTopic.set(row.topic_id, { upvotes: row.upvotes, downvotes: row.downvotes });
  }

  const myVoteByTopic = new Map<string, 1 | -1>();
  for (const v of (myVotes ?? []) as { topic_id: string; vote_value: 1 | -1 }[]) {
    myVoteByTopic.set(v.topic_id, v.vote_value);
  }

  const allTopics = (topics ?? []) as TopicRow[];
  const openTopics = allTopics
    .filter((t) => t.status === "open")
    .sort((a, b) => {
      const na = (countsByTopic.get(a.id)?.upvotes ?? 0) - (countsByTopic.get(a.id)?.downvotes ?? 0);
      const nb = (countsByTopic.get(b.id)?.upvotes ?? 0) - (countsByTopic.get(b.id)?.downvotes ?? 0);
      return nb - na;
    });
  const addressedTopics = allTopics
    .filter((t) => t.status === "addressed")
    .sort((a, b) => (b.addressed_at ?? "").localeCompare(a.addressed_at ?? ""));

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <AppNav isAdmin={isAdmin} />

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold text-neutral-900">Ideas for the next meeting</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Amendments, ARC changes, event ideas, questions for the board — submit
          one below. Similar submissions get grouped and summarized
          automatically. Vote once per topic; votes are always anonymous.
        </p>

        <div className="mt-6">
          <IdeaSubmitForm defaultName={profile.full_name || profile.email || ""} />
        </div>

        <div className="mt-8 flex flex-col gap-3">
          {openTopics.length === 0 && (
            <p className="text-sm text-neutral-500">No ideas submitted yet — be the first.</p>
          )}
          {openTopics.map((topic) => {
            const counts = countsByTopic.get(topic.id) ?? { upvotes: 0, downvotes: 0 };
            return (
              <TopicCard
                key={topic.id}
                topic={topic}
                ideas={ideasByTopic.get(topic.id) ?? []}
                upvotes={counts.upvotes}
                downvotes={counts.downvotes}
                myVote={myVoteByTopic.get(topic.id) ?? null}
                isAdmin={isAdmin}
              />
            );
          })}
        </div>

        {addressedTopics.length > 0 && (
          <div className="mt-12">
            <h2 className="text-sm font-medium text-neutral-500">
              Addressed ({addressedTopics.length})
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              {addressedTopics.map((topic) => {
                const counts = countsByTopic.get(topic.id) ?? { upvotes: 0, downvotes: 0 };
                return (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    ideas={ideasByTopic.get(topic.id) ?? []}
                    upvotes={counts.upvotes}
                    downvotes={counts.downvotes}
                    myVote={myVoteByTopic.get(topic.id) ?? null}
                    isAdmin={isAdmin}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
