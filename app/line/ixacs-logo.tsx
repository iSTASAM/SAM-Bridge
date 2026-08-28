type IxacsLogoProps = {
  width?: number;
  className?: string;
  alt?: string;
};

const NATIVE_WIDTH = 541;
const NATIVE_HEIGHT = 132;

export function IxacsLogo({
  width = 140,
  className = "",
  alt = "iXacs",
}: IxacsLogoProps) {
  const height = Math.max(1, Math.round((width * NATIVE_HEIGHT) / NATIVE_WIDTH));
  return (
    // Plain img keeps the wide iXacs mark crisp without next/image square crop.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/ixacs-logo.png"
      alt={alt}
      width={width}
      height={height}
      className={className}
      decoding="async"
    />
  );
}
