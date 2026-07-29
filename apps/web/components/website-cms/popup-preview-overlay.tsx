'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { WebsitePopup, WebsitePublicPopup } from '@/types/website-cms';
import { resolvePopupImageUrl } from '@/components/website-cms/popup-utils';

type PopupLike = WebsitePopup | WebsitePublicPopup;

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

type Props = {
  popup: PopupLike;
  onClose: () => void;
  forceShow?: boolean;
};

export function PopupPreviewOverlay({ popup, onClose, forceShow }: Props) {
  useEffect(() => {
    if (!forceShow) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [forceShow, onClose]);

  const overlay = popup.overlayJson || {};
  const size = popup.sizeJson || {};
  const imageUrl = resolvePopupImageUrl(popup.imageJson);
  const isImagePopup = popup.popupType === 'IMAGE' && Boolean(imageUrl);
  const maxWidth = isImagePopup
    ? typeof size.maxWidth === 'number'
      ? Math.max(size.maxWidth, 680)
      : 760
    : typeof size.maxWidth === 'number'
      ? size.maxWidth
      : 560;
  const overlayEnabled = overlay.enabled !== false;
  const overlayOpacity = typeof overlay.opacity === 'number' ? overlay.opacity : 0.65;
  const overlayColor = typeof overlay.color === 'string' ? overlay.color : 'rgba(6, 31, 61, 0.65)';
  const canCloseX = popup.closeBehavior?.includes('X') ?? true;
  const canClickOutside = popup.closeBehavior?.includes('CLICK_OUTSIDE') ?? true;
  const videoEmbed = embedVideoUrl(popup.videoUrl || '', popup.videoType);

  const content = (
    <div className="fixed inset-0 z-[1200] overflow-y-auto" role="presentation">
      {overlayEnabled ? (
        <button
          type="button"
          aria-label="Close popup overlay"
          className="fixed inset-0"
          style={{
            background:
              typeof overlay.color === 'string'
                ? overlayColor
                : `rgba(6, 31, 61, ${overlayOpacity})`,
            opacity: overlayOpacity,
          }}
          onClick={canClickOutside ? onClose : undefined}
        />
      ) : null}
      <div
        className={`relative z-[1201] flex min-h-full w-full justify-center p-4 ${isImagePopup ? 'items-center' : positionClass(popup.position)}`}
      >
        {isImagePopup ? (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={popup.title}
            className={`relative inline-block max-h-[calc(100dvh-32px)] max-w-[min(92vw,900px)] overflow-hidden rounded-lg bg-white shadow-2xl ${animationClass(popup.animation)}`}
          >
            {canCloseX ? (
              <button
                type="button"
                className="absolute right-2 top-2 z-10 rounded-full border border-border bg-white/95 p-1.5 shadow"
                aria-label="Close popup"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            {(() => {
              const primary = Array.isArray(popup.buttonJson)
                ? popup.buttonJson.find((b) => b.href && b.href !== '#')
                : null;
              const img = (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl!}
                  alt={
                    (popup.imageJson && typeof popup.imageJson === 'object'
                      ? (popup.imageJson as { alt?: string }).alt
                      : undefined) || popup.title
                  }
                  className="block max-h-[calc(100dvh-96px)] max-w-[min(92vw,900px)] rounded-t-lg"
                  style={{ width: 'auto', height: 'auto', objectFit: 'contain' }}
                />
              );
              return primary ? (
                <a
                  href={primary.href}
                  target={primary.openInNewTab ? '_blank' : undefined}
                  rel={primary.openInNewTab ? 'noreferrer noopener' : undefined}
                  className="block"
                >
                  {img}
                </a>
              ) : (
                img
              );
            })()}
            {Array.isArray(popup.buttonJson) && popup.buttonJson.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-2 border-t border-border bg-white px-4 py-3">
                {popup.buttonJson.map((button, index) => (
                  <a
                    key={`${button.label}-${index}`}
                    href={button.href || '#'}
                    target={button.openInNewTab ? '_blank' : undefined}
                    rel={button.openInNewTab ? 'noreferrer noopener' : undefined}
                    className={
                      button.variant === 'outline'
                        ? 'inline-flex rounded border border-current px-4 py-2 text-sm font-semibold'
                        : button.variant === 'secondary'
                          ? 'inline-flex rounded bg-muted px-4 py-2 text-sm font-semibold'
                          : 'inline-flex rounded bg-[#0b2e59] px-4 py-2 text-sm font-semibold text-white'
                    }
                  >
                    {button.label}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={popup.title}
            className={`relative mx-4 w-full max-h-[min(92vh,960px)] overflow-y-auto overflow-x-hidden rounded-lg bg-white shadow-2xl ${animationClass(popup.animation)}`}
            style={{ maxWidth }}
          >
            {canCloseX ? (
              <button
                type="button"
                className="sticky top-3 z-10 ml-auto mr-3 mt-3 flex rounded-full border border-border bg-white/90 p-1.5 text-foreground shadow"
                aria-label="Close popup"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <div className={`p-4 pb-5 ${canCloseX ? 'pt-0' : 'pt-10'}`}>
              {popup.popupType === 'BANNER' ? (
                <div
                  className="website-popup-html prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: popup.contentHtml }}
                />
              ) : null}
              {(popup.popupType === 'HTML' || popup.popupType === 'ANNOUNCEMENT') &&
              popup.contentHtml ? (
                <div
                  className="website-popup-html prose prose-sm max-w-none"
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
              {Array.isArray(popup.buttonJson) && popup.buttonJson.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {popup.buttonJson.map((button, index) => (
                    <a
                      key={`${button.label}-${index}`}
                      href={button.href || '#'}
                      target={button.openInNewTab ? '_blank' : undefined}
                      rel={button.openInNewTab ? 'noreferrer noopener' : undefined}
                      className={
                        button.variant === 'outline'
                          ? 'inline-flex rounded border border-current px-4 py-2 text-sm font-semibold'
                          : button.variant === 'secondary'
                            ? 'inline-flex rounded bg-muted px-4 py-2 text-sm font-semibold'
                            : 'inline-flex rounded bg-[#0b2e59] px-4 py-2 text-sm font-semibold text-white'
                      }
                    >
                      {button.label}
                    </a>
                  ))}
                </div>
              ) : null}
              {popup.closeBehavior?.includes('CLOSE_BUTTON') ? (
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="text-sm font-semibold text-[#0b2e59]"
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

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
