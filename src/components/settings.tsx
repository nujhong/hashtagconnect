import { useState, type ReactNode } from "react";
import { ProjectProfileEditor } from "./project-profile";
import type { ViewerProfile } from "~/src/project-profile";
import { BioContext } from "./community";
import { Keycap, Modal } from "./ui";

/**
 * Settings & privacy, in grouped cards: your profile (signed in), keyboard shortcuts, how scoring and storage work,
 * and clearing your data. Methodology lives here so scan results don't repeat it.
 */
export function Settings({
  context,
  readingBioProject = false,
  shortcuts,
  busy,
  onProfileChange,
  onShortcuts,
  onClear,
  onClose,
}: {
  context?: ViewerProfile;
  readingBioProject?: boolean;
  onProfileChange: (changes: Partial<Pick<ViewerProfile, "sentence" | "project">>) => void;
  shortcuts: boolean;
  busy: boolean;
  onShortcuts: (v: boolean) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [clearing, setClearing] = useState(false);
  return (
    <Modal label="Settings and privacy" onClose={onClose} wide>
      <h2>Settings</h2>

      {context && (
        <Group
          title="Your profile"
          note="What each scan compares with an invitation. Private to you."
        >
          <ProjectProfileEditor
            key={context.project?.url ?? "empty"}
            readingBioProject={readingBioProject}
            bio={context.bio}
            project={context.project}
            onSaved={(project) => onProfileChange({ project })}
          />
          <BioContext
            bio={context.bio}
            sentence={context.sentence}
            onSaved={(sentence) => onProfileChange({ sentence })}
          />
        </Group>
      )}

      <Group title="Keyboard">
        <label className="set-row">
          <span className="set-text">
            <b>Keyboard shortcuts</b>
            <small>Decide and open Stash without the mouse.</small>
          </span>
          <span className="switch">
            <input
              type="checkbox"
              checked={shortcuts}
              onChange={(e) => onShortcuts(e.target.checked)}
            />
            <span aria-hidden="true" />
          </span>
        </label>
        <ul className={`set-keys${shortcuts ? "" : " is-off"}`} aria-label="Shortcuts">
          <li>
            <Keycap k="←" />
            Pass
          </li>
          <li>
            <Keycap k="→" />
            Keep
          </li>
          <li>
            <Keycap k="S" />
            Stash
          </li>
        </ul>
        <p className="set-fine">
          Paused while you type or a sheet is open. <Keycap k="Esc" /> always closes sheets.
        </p>
      </Group>

      <Group title="Privacy">
        <Info title="How relevance works">
          <p>
            Relevance compares your X bio, saved project and any optional context with one
            invitation. Jev rates relevance and selects a short explanation in one request. Shared
            interests, related work and project fit are separate estimated probabilities. Project
            fit shows a dash until a project is available. “Tentative” means the evidence is
            uncertain. These signals don’t establish identity or predict a reply.
          </p>
          <p>
            Highlights outline where Jev located each signal in a screenshot of the post. Dashed
            outlines are approximate. They sit beside X’s post and never change it, and they appear
            only when your view matches the screenshot.
          </p>
        </Info>
        <Info title="Where scans run">
          <p>
            Scans run through Cloudflare and TypeSafe, with requests and results logged in our
            Cloudflare gateway. Saved results are reused until your profile, the post or the
            analysis changes. Project pages are read by Cloudflare Browser Run; Gemini drafts the
            project description through the same logged gateway. The first project link in your bio
            is read automatically when your profile is set up. You can edit or remove the saved
            context here. The full page is not stored in our database. Signing in again refreshes
            your bio.
          </p>
        </Info>
        <Info title="What we store">
          <p>
            Your identity, bio, saved project description and source link, optional context, choices
            and opened history are stored for your account. First-party measurement records your
            first Keep, first opening, active UTC days and optional feedback. Your linked X profile
            can show an “On hashtagconnect” badge, showing that you’re also here to connect. Your
            Stash is private. Only our own links record an opening; clicks inside X’s widgets don’t.
          </p>
        </Info>
        <Info title="X embeds">
          <p>
            X receives your IP address and browsing data when embeds load and may set cookies.{" "}
            <a href="https://x.com/en/privacy" target="_blank" rel="noreferrer">
              X privacy policy ↗
            </a>
          </p>
        </Info>
      </Group>

      <Group title="Your data">
        <div className="set-row">
          <span className="set-text">
            <b>Clear Stash and history</b>
            <small>
              {clearing
                ? "Every keep, pass and opening goes. This can’t be undone."
                : "Removes every keep, pass and opened record."}
            </small>
          </span>
          {clearing ? (
            <span className="set-actions">
              <button className="link" onClick={() => setClearing(false)}>
                Cancel
              </button>
              <button className="btn sm danger-btn" disabled={busy} onClick={onClear}>
                Clear
              </button>
            </span>
          ) : (
            <button className="btn sm" onClick={() => setClearing(true)}>
              Clear…
            </button>
          )}
        </div>
      </Group>
    </Modal>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="set-group" aria-label={title}>
      <h3 className="set-label">{title}</h3>
      {note && <p className="set-note">{note}</p>}
      <div className="set-card">{children}</div>
    </section>
  );
}

function Info({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="set-info">
      <summary>{title}</summary>
      {children}
    </details>
  );
}
