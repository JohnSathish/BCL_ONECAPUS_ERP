'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  onPopupClose,
  resolveAutoCloseMs,
  resolveShowDelayMs,
  shouldShowPopup,
  type PublicPopup,
} from '@/lib/popup-rules';

type Props = {
  popups: PublicPopup[];
};

function embedVideoUrl(url: string, type?: string | null) {
  if (!url) return null;
  const normalized = type?.toUpperCase();
  if (normalized === 'YOUTUBE' || url.includes('youtube.com') || url.includes('youtu.be')) {
    const id =
      url.match(/[?&]v=([^&]+)/)?.[1] ||
      url.match(/youtu\.be\/([^?&]+)/)?.[1] ||
      url.match(/embed\/([^?&]+)/)?.[1];
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (normalized === 'VIMEO' || url.includes('vimeo.com')) {
    const id = url.match(/vimeo\.com\/(\d+)/)?.[1];
    return id ? `https://player.vimeo.com/video/${id}` : null;
  }
  return url;
}

function positionClass(position: string) {
  switch (position) {
    case 'TOP':
      return 'items-start justify-center pt-16';
    case 'BOTTOM':
      return 'items-end justify-center pb-16';
    case 'TOP_LEFT':
      return 'items-start justify-start p-6';
    case 'TOP_RIGHT':
      return 'items-start justify-end p-6';
    case 'BOTTOM_LEFT':
      return 'items-end justify-start p-6';
    case 'BOTTOM_RIGHT':
      return 'items-end justify-end p-6';
    default:
      return 'items-center justify-center';
  }
}

function animationClass(animation: string) {
  switch (animation) {
    case 'SLIDE_UP':
      return 'website-popup-animate-slide-up';
    case 'SLIDE_DOWN':
      return 'website-popup-animate-slide-down';
    case 'ZOOM':
      return 'website-popup-animate-zoom';
    case 'NONE':
      return '';
    default:
      return 'website-popup-animate-fade';
  }
}

function PopupButtons({
  buttons,
  className,
}: {
  buttons: PublicPopup['buttonJson'];
  className?: string;
}) {
  if (!buttons.length) return null;
  return (
    <div className={className ?? 'mt-4 flex flex-wrap gap-2'}>
      {buttons.map((button, index) => (
        <a
          key={`${button.label}-${index}`}
          href={button.href || '#'}
          target={button.openInNewTab ? '_blank' : undefined}
          rel={button.openInNewTab ? 'noreferrer noopener' : undefined}
          className={
            button.variant === 'outline'
              ? 'ui-button ui-button-outline min-h-[40px] px-4 py-2 text-xs'
              : button.variant === 'secondary'
                ? 'ui-button ui-button-ghost min-h-[40px] px-4 py-2 text-xs'
                : 'ui-button min-h-[40px] px-4 py-2 text-xs'
          }
        >
          {button.label}
        </a>
      ))}
    </div>
  );
}

function PopupOverlay({ popup, onClose }: { popup: PublicPopup; onClose: () => void }) {
  const overlay = popup.overlayJson || {};
  const size = popup.sizeJson || {};
  const isImagePopup = popup.popupType === 'IMAGE';
  const maxWidth = isImagePopup
    ? typeof size.maxWidth === 'number'
      ? Math.max(size.maxWidth, 680)
      : 760
    : typeof size.maxWidth === 'number'
      ? size.maxWidth
      : 560;
  const overlayEnabled = overlay.enabled !== false;
  const overlayOpacity = typeof overlay.opacity === 'number' ? overlay.opacity : 0.65;
  const canCloseX = popup.closeBehavior?.includes('X') ?? true;
  const canClickOutside = popup.closeBehavior?.includes('CLICK_OUTSIDE') ?? true;
  const canEsc = popup.closeBehavior?.includes('ESC') ?? true;
  const videoEmbed = embedVideoUrl(popup.videoUrl || '', popup.videoType);
  const primaryLink = popup.buttonJson.find((b) => b.href && b.href !== '#') ?? null;

  useEffect(() => {
    if (!canEsc) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canEsc, onClose]);

  useEffect(() => {
    const autoCloseMs = resolveAutoCloseMs(popup);
    if (!autoCloseMs) return;
    const timer = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [popup, onClose]);

  const imageEl = popup.imageJson?.url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={popup.imageJson.url}
      alt={popup.imageJson.alt || popup.title}
      loading="lazy"
      className="website-popup-image rounded-lg"
    />
  ) : null;

  return (
    <div className="fixed inset-0 z-[1200] overflow-y-auto" role="presentation">
      {overlayEnabled ? (
        <button
          type="button"
          aria-label="Close popup overlay"
          className="fixed inset-0 border-0"
          style={{
            background: 'rgba(6, 31, 61, 1)',
            opacity: overlayOpacity,
          }}
          onClick={canClickOutside ? onClose : undefined}
        />
      ) : null}
      <div
        className={`relative z-[1201] flex min-h-full w-full justify-center p-4 ${isImagePopup ? 'items-center py-4' : positionClass(popup.position)}`}
      >
        {isImagePopup && imageEl ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={popup.title}
            className={`website-popup-image-shell rounded-lg bg-white shadow-2xl ${animationClass(popup.animation)}`}
            style={{ maxWidth }}
          >
            {canCloseX ? (
              <button
                type="button"
                className="website-popup-close-floating"
                aria-label="Close popup"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            {primaryLink ? (
              <a
                href={primaryLink.href}
                target={primaryLink.openInNewTab ? '_blank' : undefined}
                rel={primaryLink.openInNewTab ? 'noreferrer noopener' : undefined}
                className="block cursor-pointer"
                aria-label={primaryLink.label || popup.title}
              >
                {imageEl}
              </a>
            ) : (
              imageEl
            )}
            {popup.buttonJson.length > 0 ? (
              <div className="border-t border-[#e8eef4] bg-white px-4 py-3">
                <PopupButtons
                  buttons={popup.buttonJson}
                  className="flex flex-wrap justify-center gap-2"
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={popup.title}
            className={`website-popup-dialog website-popup-dialog--text rounded-lg bg-white shadow-2xl ${animationClass(popup.animation)}`}
            style={{ maxWidth }}
          >
            {canCloseX ? (
              <button
                type="button"
                className="sticky top-3 z-10 ml-auto mr-3 mt-3 flex rounded-full border border-[#dde3e9] bg-white/95 p-1.5 text-[#0b2e59] shadow"
                aria-label="Close popup"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <div
              className={`website-popup-body website-popup-body--text ${canCloseX ? '-mt-10' : ''}`}
            >
              {(popup.popupType === 'BANNER' ||
                popup.popupType === 'HTML' ||
                popup.popupType === 'ANNOUNCEMENT') &&
              popup.contentHtml ? (
                <div
                  className="website-popup-html prose max-w-none text-[15px] leading-relaxed text-[#14263a]"
                  dangerouslySetInnerHTML={{ __html: popup.contentHtml }}
                />
              ) : null}
              {popup.popupType === 'VIDEO' && videoEmbed ? (
                popup.videoType === 'MP4' || videoEmbed.endsWith('.mp4') ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={videoEmbed} controls className="w-full rounded-md" />
                ) : (
                  <iframe
                    title={popup.title}
                    src={videoEmbed}
                    className="aspect-video w-full rounded-md border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )
              ) : null}
              <PopupButtons buttons={popup.buttonJson} />
              {popup.closeBehavior?.includes('CLOSE_BUTTON') ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="text-sm font-bold text-[#0b2e59]"
                    onClick={onClose}
                  >
                    Close
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function waitForTrigger(popup: PublicPopup, signal: AbortSignal): Promise<void> {
  const delayMs = resolveShowDelayMs(popup);

  if (popup.showTrigger === 'SCROLL_PERCENT') {
    const target = Math.min(100, Math.max(0, popup.scrollPercent ?? 50));
    return new Promise((resolve, reject) => {
      const cleanup = () => window.removeEventListener('scroll', onScroll);
      const onScroll = () => {
        const doc = document.documentElement;
        const scrollTop = window.scrollY || doc.scrollTop;
        const height = doc.scrollHeight - doc.clientHeight;
        const percent = height > 0 ? (scrollTop / height) * 100 : 0;
        if (percent >= target) {
          cleanup();
          window.setTimeout(resolve, delayMs);
        }
      };
      signal.addEventListener('abort', () => {
        cleanup();
        reject(new DOMException('Aborted', 'AbortError'));
      });
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    });
  }

  if (popup.showTrigger === 'EXIT_INTENT') {
    return new Promise((resolve, reject) => {
      const onMouseLeave = (event: MouseEvent) => {
        if (event.clientY > 12) return;
        window.removeEventListener('mouseout', onMouseLeave);
        window.setTimeout(resolve, delayMs);
      };
      signal.addEventListener('abort', () => {
        window.removeEventListener('mouseout', onMouseLeave);
        reject(new DOMException('Aborted', 'AbortError'));
      });
      window.addEventListener('mouseout', onMouseLeave);
    });
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, delayMs);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

export function WebsitePopupManager({ popups }: Props) {
  const eligible = useMemo(() => popups.filter((popup) => shouldShowPopup(popup)), [popups]);
  const [active, setActive] = useState<PublicPopup | null>(null);
  const closeResolverRef = useRef<(() => void) | null>(null);

  const handleClose = useCallback(() => {
    if (active) onPopupClose(active);
    setActive(null);
    closeResolverRef.current?.();
    closeResolverRef.current = null;
  }, [active]);

  useEffect(() => {
    if (!eligible.length) return;
    const controller = new AbortController();

    const runQueue = async () => {
      for (const popup of eligible) {
        if (controller.signal.aborted) break;
        try {
          await waitForTrigger(popup, controller.signal);
        } catch {
          break;
        }
        if (controller.signal.aborted) break;
        await new Promise<void>((resolve) => {
          closeResolverRef.current = resolve;
          setActive(popup);
        });
      }
    };

    void runQueue();
    return () => controller.abort();
  }, [eligible]);

  if (!active || typeof document === 'undefined') return null;
  return createPortal(<PopupOverlay popup={active} onClose={handleClose} />, document.body);
}
