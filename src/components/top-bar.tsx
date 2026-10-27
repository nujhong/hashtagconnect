import { AccountMenu, type Account } from "./auth";
import { Count, Keycap, Mark, StashIcon } from "./ui";

/**
 * Brand, session scope, scan service status, the Stash counter (also the target the Keep sticker flies to, via data-jack),
 * and either the account menu or Continue with X.
 */
export function TopBar({
  scope,
  guest,
  stashCount,
  stashOpen,
  shortcuts,
  account,
  scanPause,
  onStash,
  onSettings,
  onSignIn,
  onSignOut,
}: {
  scope: string | null;
  guest: boolean;
  stashCount: number;
  stashOpen: boolean;
  shortcuts: boolean;
  account: Account | null;
  scanPause: string | null;
  onStash: () => void;
  onSettings: () => void;
  onSignIn: () => void;
  onSignOut: () => Promise<void>;
}) {
  return (
    <header className="top">
      <a href="/" className="brand" aria-label="hashtagconnect home">
        <Mark />
        <span className="brand-name">
          <span className="brand-pre">hashtag</span>connect
        </span>
      </a>
      {scope && (
        <span
          className="scope"
          title={guest ? "Saves stay in this browser. No account data is used." : undefined}
        >
          {scope}
        </span>
      )}
      <span className="top-gap" />
      {/* Service failures pause scanning until Retry. */}
      {scanPause && (
        <span className="scan-usage" title={scanPause}>
          Scans paused
        </span>
      )}
      <button
        className="kept-btn"
        data-jack
        onClick={onStash}
        aria-expanded={stashOpen}
        aria-controls="shelf"
        aria-keyshortcuts={shortcuts ? "S" : undefined}
      >
        <StashIcon />
        <span className="kept-label">Stash</span> <Count value={stashCount} />
        {shortcuts && <Keycap k="S" hint />}
      </button>
      {account ? (
        <AccountMenu account={account} onPrivacy={onSettings} onSignOut={onSignOut} />
      ) : (
        <button className="btn primary top-cta" onClick={onSignIn} aria-label="Continue with X">
          Continue<span className="cta-long">&nbsp;with X</span> <span aria-hidden="true">↗</span>
        </button>
      )}
    </header>
  );
}
