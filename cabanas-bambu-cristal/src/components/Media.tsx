import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { resolveMedia } from "../lib/store";

/** <img> que entende fotos guardadas no Firestore ("media:<id>"). */
export function Img({ src = "", alt = "", ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src?: string }) {
  const [url, setUrl] = useState(src.startsWith("media:") ? "" : src);
  useEffect(() => {
    let alive = true;
    resolveMedia(src).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [src]);
  if (!url) return <div className={`bg-sand ${rest.className ?? ""}`} />;
  return <img src={url} alt={alt} loading="lazy" {...rest} />;
}

export function parseVideo(url: string): { kind: "youtube" | "vimeo" | "file"; id: string } | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return { kind: "youtube", id: yt[1] };
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { kind: "vimeo", id: vm[1] };
  return { kind: "file", id: url };
}

/** Vídeo com controles (YouTube, Vimeo ou arquivo .mp4). */
export function Video({ url, className = "" }: { url: string; className?: string }) {
  const v = parseVideo(url);
  if (!v) return null;
  if (v.kind === "file") return <video src={v.id} controls playsInline className={`w-full ${className}`} />;
  const src =
    v.kind === "youtube" ? `https://www.youtube-nocookie.com/embed/${v.id}?rel=0` : `https://player.vimeo.com/video/${v.id}`;
  return (
    <div className={`relative aspect-video w-full ${className}`}>
      <iframe
        src={src}
        className="absolute inset-0 h-full w-full"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        title="Vídeo"
      />
    </div>
  );
}

/** Vídeo de fundo, mudo e em loop, cobrindo todo o container. */
export function BackgroundVideo({ url, poster }: { url: string; poster?: string }) {
  const v = parseVideo(url);
  if (!v) return null;
  if (v.kind === "file")
    return <video src={v.id} poster={poster} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover" />;
  const src =
    v.kind === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&mute=1&loop=1&playlist=${v.id}&controls=0&showinfo=0&modestbranding=1&playsinline=1&rel=0`
      : `https://player.vimeo.com/video/${v.id}?background=1&autoplay=1&loop=1&muted=1`;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <iframe
        src={src}
        title="Vídeo de fundo"
        allow="autoplay"
        className="absolute left-1/2 top-1/2 h-[56.25vw] min-h-full w-[177.78vh] min-w-full -translate-x-1/2 -translate-y-1/2"
      />
    </div>
  );
}
