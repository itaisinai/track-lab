import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ArtistHoverChips.css";

type ArtistHoverChipsProps = {
  artists: string;
};

export function ArtistHoverChips({ artists }: ArtistHoverChipsProps) {
  const triggerRef = useRef<HTMLDivElement>(null);
  const [popoverPosition, setPopoverPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const artistList = splitArtists(artists);
  const [mainArtist = "Unknown artist", ...otherArtists] = artistList;
  const extraCount = otherArtists.length;

  function openPopover() {
    if (!triggerRef.current) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    setPopoverPosition({
      top: rect.bottom + 8,
      left: rect.left,
    });
  }

  function closePopover() {
    setPopoverPosition(null);
  }

  return (
    <>
      <div
        className="artist-hover"
        tabIndex={0}
        ref={triggerRef}
        aria-label={`Artists: ${artistList.join(", ")}`}
        onBlur={closePopover}
        onFocus={openPopover}
        onMouseEnter={openPopover}
        onMouseLeave={closePopover}
      >
        <span className="artist-main-badge">{mainArtist}</span>
        {extraCount > 0 && (
          <span className="artist-extra-badge">+{extraCount}</span>
        )}
      </div>
      {popoverPosition &&
        createPortal(
          <div
            className="artist-chip-popover"
            style={{
              top: popoverPosition.top,
              left: popoverPosition.left,
            }}
          >
            {artistList.map((artist) => (
              <span className="artist-chip" key={artist}>
                {artist}
              </span>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}

function splitArtists(artists: string) {
  return artists
    .split(",")
    .map((artist) => artist.trim())
    .filter(Boolean);
}
