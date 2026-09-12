"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import IdeaFormModal from "@/components/ideas/IdeaFormModal";
import type { IdeaRow } from "@/lib/ideas";
import { formatDateOnly } from "@/lib/procurementDisplay";
import PageHeader from "@/components/hud/PageHeader";
import { HudFrameButton } from "@/components/hud/HudFrame";

export default function IdeasListClient({ ideas }: { ideas: IdeaRow[] }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<IdeaRow | null>(null);

  function afterChange() {
    setShowCreate(false);
    setEditing(null);
    router.refresh();
  }

  return (
    <div>
      <PageHeader label="IDEAS" title="Ideas">
        <button
          onClick={() => setShowCreate(true)}
          className="bg-accent text-ink btn-skew btn-glow px-4 py-2 text-sm font-medium"
        >
          + New Idea
        </button>
      </PageHeader>

      {ideas.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">No ideas yet — add the first one.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideas.map((idea) => (
            <HudFrameButton
              key={idea.id}
              corners="tl-br"
              onClick={() => setEditing(idea)}
              className="text-left bg-white dark:bg-neutral-900 border border-black/5 dark:border-white/10 rounded-2xl p-4 hover:border-accent/40"
            >
              <div className="text-sm font-medium truncate">{idea.name}</div>
              <div className="text-xs text-black/50 dark:text-white/50 mt-1">
                Expected start: {formatDateOnly(idea.expected_start_date)}
              </div>
              {idea.description && (
                <div className="text-xs text-black/50 dark:text-white/50 mt-2 line-clamp-2">
                  {idea.description}
                </div>
              )}
              {idea.created_by_username && (
                <div className="text-xs text-black/40 dark:text-white/40 mt-2">
                  Added by {idea.created_by_username}
                </div>
              )}
            </HudFrameButton>
          ))}
        </div>
      )}

      {showCreate && <IdeaFormModal onClose={() => setShowCreate(false)} onSaved={afterChange} onDeleted={afterChange} />}
      {editing && (
        <IdeaFormModal idea={editing} onClose={() => setEditing(null)} onSaved={afterChange} onDeleted={afterChange} />
      )}
    </div>
  );
}
