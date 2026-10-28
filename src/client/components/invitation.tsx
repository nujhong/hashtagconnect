import type { Person, Post } from "~/shared/people";
import type { PostLayer } from "~/client/scan-layer";
import { PostFrame } from "./post-frame";
import { OpenLink } from "./primitives";

/** The original invitation stays visible below its scan, with a fallback link if X cannot render it. */
export function Invitation({
  post,
  layer,
  onSpots,
  onOpen,
}: {
  post: Post;
  layer: PostLayer | null;
  onSpots: (shown: boolean) => void;
  onOpen: (target: { post?: Post; person?: Person }) => void;
}) {
  return (
    <PostFrame
      id={post.id}
      layer={layer}
      onSpots={onSpots}
      header={
        <>
          {post.person && <strong>@{post.person.handle}</strong>}
          {post.person?.onPlatform && (
            <span className="member-badge" title="Also here to connect">
              On hashtagconnect
            </span>
          )}
          <span className="original-label">Original post</span>
        </>
      }
      fallback={<OpenLink post={post} onOpen={(p) => onOpen({ post: p })} className="btn sm" />}
    />
  );
}
