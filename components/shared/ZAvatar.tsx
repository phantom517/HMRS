/** Compute the display initials of a person name ("Anisha Rai" -> "AR"). */
export function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** Small circular initials avatar shared across dashboard, roster, calendar, and directory. */
export function ZAvatar({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={className ? `zavatar ${className}` : "zavatar"} style={style} aria-hidden="true">
      {initialsOf(name)}
    </span>
  );
}
