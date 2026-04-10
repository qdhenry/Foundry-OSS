"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

interface Props {
  programId: string;
  analysisId: string;
}

export function SpeakerMappingPanel({ programId, analysisId }: Props) {
  const state = useQuery(api.videoAnalysis.getSpeakerMappingState, {
    analysisId: analysisId as Id<"videoAnalyses">,
  });
  const teamMembers = useQuery(api.teamMembers.listByProgram, {
    programId: programId as Id<"programs">,
  });

  const mapSpeaker = useMutation(api.videoAnalysis.mapSpeakerToTeamMember);
  const addExternal = useMutation(api.videoAnalysis.addExternalSpeakerMapping);
  const complete = useMutation(api.videoAnalysis.completeSpeakerMapping);

  const [selectedUsers, setSelectedUsers] = useState<Record<string, string>>({});
  const [externalNames, setExternalNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!state || !teamMembers) {
    return <p className="text-sm text-slate-500">Loading speaker mapping...</p>;
  }

  // Post-completion: speaker mapping was already submitted
  if (state.speakerMappingComplete) {
    return (
      <div className="space-y-4 rounded-xl border border-border-default bg-surface-default p-6">
        <h2 className="text-lg font-semibold text-text-heading">Speaker Mapping</h2>
        <p className="text-sm text-accent-default">
          Speaker mapping was already completed. The pipeline is continuing.
        </p>
      </div>
    );
  }

  const handleMapTeam = async (speakerId: string) => {
    const userId = selectedUsers[speakerId];
    if (!userId) return;
    setError(null);
    await mapSpeaker({
      analysisId: analysisId as Id<"videoAnalyses">,
      speakerId,
      userId: userId as Id<"users">,
    });
  };

  const handleMapExternal = async (speakerId: string) => {
    const name = externalNames[speakerId]?.trim();
    if (!name) return;
    setError(null);
    await addExternal({
      analysisId: analysisId as Id<"videoAnalyses">,
      speakerId,
      name,
    });
  };

  const handleContinue = async (skipped: boolean) => {
    setSaving(true);
    setError(null);
    try {
      await complete({
        analysisId: analysisId as Id<"videoAnalyses">,
        skipped,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to continue");
    } finally {
      setSaving(false);
    }
  };

  // Three-way state for speaker status
  const noSpeakersDetected = state.totalSpeakers === 0 && !state.speakerMappingComplete;
  const allMapped = state.unmappedSpeakers.length === 0 && state.totalSpeakers > 0;
  const hasUnmapped = state.unmappedSpeakers.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-border-default bg-surface-default p-6">
      <h2 className="text-lg font-semibold text-text-heading">Speaker Mapping</h2>
      <p className="text-sm text-text-secondary">
        Map detected speakers to team members or external participants to continue analysis.
      </p>

      {noSpeakersDetected && (
        <div className="rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2">
          <p className="text-sm text-status-warning-fg">
            No speakers detected yet. The transcription stage has not produced speaker data. You can
            skip speaker mapping and continue.
          </p>
        </div>
      )}

      {allMapped && (
        <p className="text-sm text-status-success-fg">All speakers mapped. Continue when ready.</p>
      )}

      {hasUnmapped && (
        <div className="space-y-3">
          {state.unmappedSpeakers.map((speakerId: string) => (
            <div key={speakerId} className="rounded-lg border border-border-default p-3">
              <p className="mb-2 text-sm font-medium text-text-heading">{speakerId}</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedUsers[speakerId] ?? ""}
                  onChange={(e) =>
                    setSelectedUsers((prev) => ({ ...prev, [speakerId]: e.target.value }))
                  }
                  className="select"
                >
                  <option value="">Select team member</option>
                  {teamMembers.map((member: any) => (
                    <option key={member.userId} value={member.userId}>
                      {member.user?.name ?? member.role}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleMapTeam(speakerId)}
                  className="rounded bg-accent-default px-3 py-1 text-xs font-medium text-text-on-brand hover:bg-accent-strong"
                >
                  Map Team
                </button>
                <input
                  value={externalNames[speakerId] ?? ""}
                  onChange={(e) =>
                    setExternalNames((prev) => ({ ...prev, [speakerId]: e.target.value }))
                  }
                  placeholder="External participant"
                  className="select"
                />
                <button
                  onClick={() => handleMapExternal(speakerId)}
                  className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Add External
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-status-error-fg">{error}</p>}

      {success ? (
        <p className="text-sm font-medium text-status-success-fg">Pipeline continuing...</p>
      ) : (
        <div className="flex items-center gap-2 pt-2">
          <button
            disabled={saving}
            onClick={() => handleContinue(false)}
            className="rounded bg-status-success-fg px-4 py-2 text-sm font-medium text-text-on-brand hover:opacity-90 disabled:opacity-50"
          >
            Continue Analysis
          </button>
          <button
            disabled={saving}
            onClick={() => handleContinue(true)}
            className="rounded border border-border-default px-4 py-2 text-sm font-medium text-text-primary hover:bg-interactive-hover disabled:opacity-50"
          >
            Skip and Continue
          </button>
        </div>
      )}
    </div>
  );
}
