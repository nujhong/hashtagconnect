import { AccountMenu, type Account } from "./auth";
import { Count, Keycap, Mark, StashIcon } from "./ui";

/**
 * Brand, session scope, the Stash counter (also the target the Keep sticker flies to, via data-jack),
 * and either the account menu or Continue with X.
 */
export function TopBar({ scope, preview, stashCount, stashOpen, letters, account, onStash, onSettings, onSignIn, onSignOut }: {
  scope: string | null; preview: boolean; stashCount: number; stashOpen: boolean; letters: boolean; account: Account | null;
  onStash: () => void; onSettings: () => void; onSignIn: () => void; onSignOut: () => Promise<void>;
}) {
  return <header className="top">
    <a href="/" className="brand" aria-label="hashtagconnect home"><Mark /><span className="brand-name"><span className="brand-pre">hashtag</span>connect</span></a>
    {scope && <span className={`scope${preview ? " is-preview" : ""}`} title={preview ? "Saves stay in this browser. No account data is used." : undefined}>{scope}</span>}
    <span className="top-gap" />
    <button className="kept-btn" data-jack onClick={onStash} aria-expanded={stashOpen} aria-controls="shelf" aria-keyshortcuts={letters ? "S" : undefined}>
      <StashIcon /><span className="kept-label">Stash</span> <Count value={stashCount} />{letters && <Keycap k="S" hint />}
    </button>
    {account
      ? <AccountMenu account={account} onPrivacy={onSettings} onSignOut={onSignOut} />
      : <button className="btn primary top-cta" onClick={onSignIn} aria-label="Continue with X">Continue<span className="cta-long">&nbsp;with X</span> <span aria-hidden="true">↗</span></button>}
  </header>;
}
