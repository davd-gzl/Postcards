import { MoreButton } from "./MoreButton";

/**
 * The "Showing X of Y / Show N more" footer shared by every paged list. The
 * caller keeps the `X.length > shown` guard so this only renders when there's
 * more to reveal.
 */
export function ListPager({
  shown,
  total,
  step,
  onMore,
}: {
  shown: number;
  total: number;
  step: number;
  onMore: () => void;
}) {
  return (
    <div className="list-pager">
      <span className="muted small">
        Showing {shown} of {total}
      </span>
      <MoreButton onMore={onMore}>Show {step} more</MoreButton>
    </div>
  );
}
