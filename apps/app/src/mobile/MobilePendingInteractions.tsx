import { useState } from "react";
import type {
  PendingInteraction,
  PendingInteractionResolution,
  PendingInteractionUserAnswer,
} from "@bb/domain";
import { sdk } from "@/lib/sdk";

interface MobilePendingInteractionsProps {
  interactions: readonly PendingInteraction[];
  onResolved: () => void;
}

function approvalLabel(interaction: PendingInteraction): string {
  if (interaction.payload.kind !== "approval") return "Approval required";
  const subject = interaction.payload.subject;
  if (subject.kind === "command") return subject.command;
  if (subject.kind === "file_change") return subject.writeScope ?? "File change";
  return subject.toolName ?? "Permission request";
}

function grantFor(interaction: PendingInteraction) {
  if (interaction.payload.kind !== "approval") return null;
  const subject = interaction.payload.subject;
  return subject.kind === "permission_grant"
    ? subject.permissions
    : subject.sessionGrant;
}

function ApprovalInteraction({
  interaction,
  onResolved,
}: {
  interaction: PendingInteraction;
  onResolved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (interaction.payload.kind !== "approval") return null;

  const resolve = async (
    decision: "allow_once" | "allow_for_session" | "deny",
  ) => {
    setBusy(true);
    try {
      const resolution: PendingInteractionResolution =
        decision === "deny"
          ? { decision }
          : { decision, grantedPermissions: grantFor(interaction) };
      await sdk.threads.interactions.resolve({
        threadId: interaction.threadId,
        interactionId: interaction.id,
        resolution,
      });
      onResolved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bb-mobile-interaction">
      <span>Approval required</span>
      <strong>{approvalLabel(interaction)}</strong>
      {interaction.payload.reason ? <p>{interaction.payload.reason}</p> : null}
      <div>
        {interaction.payload.availableDecisions.includes("deny") ? (
          <button type="button" disabled={busy} onClick={() => void resolve("deny")}>
            Deny
          </button>
        ) : null}
        {interaction.payload.availableDecisions.includes("allow_once") ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void resolve("allow_once")}
          >
            Allow once
          </button>
        ) : null}
        {interaction.payload.availableDecisions.includes("allow_for_session") ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void resolve("allow_for_session")}
          >
            Allow for session
          </button>
        ) : null}
      </div>
    </section>
  );
}

function QuestionInteraction({
  interaction,
  onResolved,
}: {
  interaction: PendingInteraction;
  onResolved: () => void;
}) {
  const [answers, setAnswers] = useState<
    Record<string, PendingInteractionUserAnswer>
  >({});
  const [busy, setBusy] = useState(false);
  if (interaction.payload.kind !== "user_question") return null;

  const updateSelected = (
    questionId: string,
    value: string,
    multiSelect: boolean,
  ) => {
    setAnswers((current) => {
      const existing = current[questionId] ?? { selected: [] };
      const selected = multiSelect
        ? existing.selected.includes(value)
          ? existing.selected.filter((item) => item !== value)
          : [...existing.selected, value]
        : [value];
      return { ...current, [questionId]: { ...existing, selected } };
    });
  };

  const submit = async () => {
    setBusy(true);
    try {
      const normalized: Record<string, PendingInteractionUserAnswer> =
        Object.fromEntries(
          interaction.payload.questions.map((question) => [
            question.id,
            answers[question.id] ?? { selected: [] },
          ]),
        );
      await sdk.threads.interactions.resolve({
        threadId: interaction.threadId,
        interactionId: interaction.id,
        resolution: { kind: "user_answer", answers: normalized },
      });
      onResolved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bb-mobile-interaction">
      <span>Agent question</span>
      {interaction.payload.questions.map((question) => {
        const answer = answers[question.id] ?? { selected: [] };
        return (
          <fieldset key={question.id}>
            <legend>{question.prompt}</legend>
            <div className="bb-mobile-question-options">
              {question.options?.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  data-selected={
                    answer.selected.includes(option.value) ? "true" : undefined
                  }
                  onClick={() =>
                    updateSelected(
                      question.id,
                      option.value,
                      question.multiSelect,
                    )
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
            {question.allowFreeText ? (
              <textarea
                rows={2}
                value={answer.freeText ?? ""}
                onChange={(event) =>
                  setAnswers((current) => {
                    const existing = current[question.id] ?? { selected: [] };
                    const freeText = event.target.value;
                    return {
                      ...current,
                      [question.id]: freeText.trim()
                        ? { ...existing, freeText }
                        : { selected: existing.selected },
                    };
                  })
                }
                placeholder="Type an answer"
              />
            ) : null}
          </fieldset>
        );
      })}
      <button type="button" disabled={busy} onClick={() => void submit()}>
        Send answer
      </button>
    </section>
  );
}

export function MobilePendingInteractions({
  interactions,
  onResolved,
}: MobilePendingInteractionsProps) {
  const pending = interactions.filter(
    (interaction) => interaction.status === "pending",
  );
  if (pending.length === 0) return null;
  return (
    <div className="bb-mobile-interactions">
      {pending.map((interaction) =>
        interaction.payload.kind === "approval" ? (
          <ApprovalInteraction
            key={interaction.id}
            interaction={interaction}
            onResolved={onResolved}
          />
        ) : interaction.payload.kind === "user_question" ? (
          <QuestionInteraction
            key={interaction.id}
            interaction={interaction}
            onResolved={onResolved}
          />
        ) : null,
      )}
    </div>
  );
}
