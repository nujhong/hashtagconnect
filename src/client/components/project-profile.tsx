import { useState } from "react";
import { fetch as api, FetchError } from "void/client";
import { bioProjectLinks, type ProjectDraft, type ProjectProfile } from "~/shared/project-profile";

/** Review the automatically saved bio project, or read another link into an editable preview. */
export function ProjectProfileEditor({
  bio,
  project,
  readingBioProject = false,
  onSaved,
}: {
  readingBioProject?: boolean;
  bio: string | null;
  project: ProjectProfile | null;
  onSaved: (project: ProjectProfile | null) => void;
}) {
  const [url, setUrl] = useState(project?.url ?? "");
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [summary, setSummary] = useState(project?.summary ?? "");
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [error, setError] = useState("");
  const suggestions = bioProjectLinks(bio).filter((link) => link !== project?.url);
  async function save(value: ProjectProfile | null) {
    setBusy("saving");
    setError("");
    try {
      const saved = await api("/api/me/project", { method: "POST", body: { project: value } });
      onSaved(saved.project);
    } catch {
      setError("Couldn’t save your project. Try again.");
      setBusy(null);
    }
  }
  if (readingBioProject)
    return (
      <section className="project-editor" aria-labelledby="project-heading">
        <h3 id="project-heading">Your project</h3>
        <p className="fine" role="status">
          Reading the link in your bio. You can edit the context here afterward.
        </p>
      </section>
    );
  return (
    <section className="project-editor" aria-labelledby="project-heading">
      <div className="project-heading">
        <h3 id="project-heading">{project ? "Your project" : "Add a project"}</h3>
        <span className="fine">Optional</span>
      </div>
      <p className="fine">
        {project
          ? "Review or edit the context used in your scans."
          : "Drop a project link. We’ll read the page and add detail to your scans."}
      </p>
      <form
        className="community-form"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy("reading");
          setError("");
          try {
            const response = await api("/api/me/project/preview", {
              method: "POST",
              body: { url },
              retry: 0,
            });
            if (!("draft" in response)) throw new Error();
            setDraft(response.draft);
            setSummary(response.draft.summary);
            setUrl(response.draft.url);
          } catch (error) {
            const message =
              error instanceof FetchError &&
              error.data &&
              typeof error.data === "object" &&
              "error" in error.data &&
              typeof error.data.error === "string"
                ? error.data.error
                : "Couldn’t read that project. Check the link and try again.";
            setError(message);
          } finally {
            setBusy(null);
          }
        }}
      >
        <label htmlFor="project-url">Project link</label>
        <div className="project-link-row">
          <input
            id="project-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://your-project.com"
            required
            maxLength={2048}
            value={url}
            disabled={!!busy}
            onChange={(event) => {
              setUrl(event.target.value);
              setDraft(null);
              setSummary(project?.summary ?? "");
            }}
          />
          <button className="btn" disabled={!!busy}>
            {busy === "reading" ? "Reading…" : "Read link"}
          </button>
        </div>
        {!project && !draft && suggestions.length > 0 && (
          <div className="project-suggestions">
            <span className="fine">From your bio</span>
            {suggestions.map((link) => (
              <button
                className="link"
                type="button"
                key={link}
                disabled={!!busy}
                onClick={() => setUrl(link)}
              >
                {new URL(link).hostname}
                <span aria-hidden="true"> ↗</span>
              </button>
            ))}
          </div>
        )}
      </form>
      {busy === "reading" && (
        <p className="fine project-progress" role="status">
          Reading the page and finding the useful details…
        </p>
      )}
      {(draft || (project && url === project.url)) && (
        <form
          className="community-form project-draft"
          onSubmit={(event) => {
            event.preventDefault();
            void save({
              url: draft?.url ?? project!.url,
              summary,
              topics: draft ? draft.topics : project?.topics,
            });
          }}
        >
          <label htmlFor="project-summary">
            {draft ? "Does this describe your project?" : "Your project context"}
          </label>
          <textarea
            id="project-summary"
            rows={6}
            minLength={20}
            maxLength={600}
            required
            value={summary}
            disabled={!!busy}
            onChange={(event) => setSummary(event.target.value)}
          />
          {draft && (
            <p className="fine">Edit anything that’s off. Used with your X bio after you save.</p>
          )}
          {(draft?.topics ?? project?.topics)?.length ? (
            <p className="fine">
              Scans look for: {(draft?.topics ?? project!.topics)!.join(" · ")}
            </p>
          ) : null}
          {draft && (
            <details className="project-excerpt">
              <summary>From the page</summary>
              <blockquote>{draft.excerpt}</blockquote>
            </details>
          )}
          <div className="project-actions">
            <button className="btn" disabled={!!busy}>
              {busy === "saving" ? "Saving…" : draft ? "Use this profile" : "Save changes"}
            </button>
            {draft ? (
              <button
                className="link"
                type="button"
                disabled={!!busy}
                onClick={() => {
                  setDraft(null);
                  setSummary(project?.summary ?? "");
                  setUrl(project?.url ?? "");
                }}
              >
                Cancel
              </button>
            ) : (
              <button
                className="link"
                type="button"
                disabled={!!busy}
                onClick={() => void save(null)}
              >
                Remove
              </button>
            )}
          </div>
        </form>
      )}
      {project && !draft && url !== project.url && (
        <button
          className="link"
          disabled={!!busy}
          onClick={() => {
            setUrl(project.url);
            setSummary(project.summary);
            setError("");
          }}
        >
          Back to saved project
        </button>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
