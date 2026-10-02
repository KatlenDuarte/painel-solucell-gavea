import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Img } from "./Media";

export function Lightbox({ images, index, onClose }: { images: string[]; index: number; onClose: () => void }) {
  const [i, setI] = useState(index);
  const go = (d: number) => setI((v) => (v + d + images.length) % images.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setI((v) => (v + 1) % images.length);
      if (e.key === "ArrowLeft") setI((v) => (v - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95" onClick={onClose}>
      <button className="absolute right-4 top-4 p-2 text-white" aria-label="Fechar">
        <X className="h-7 w-7" />
      </button>
      {images.length > 1 && (
        <>
          <button
            className="absolute left-2 p-3 text-white md:left-6"
            aria-label="Anterior"
            onClick={(e) => {
              e.stopPropagation();
              go(-1);
            }}
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            className="absolute right-2 p-3 text-white md:right-6"
            aria-label="Próxima"
            onClick={(e) => {
              e.stopPropagation();
              go(1);
            }}
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}
      <div onClick={(e) => e.stopPropagation()} className="max-h-[85vh] max-w-[90vw]">
        <Img src={images[i]} alt="" className="max-h-[85vh] max-w-[90vw] object-contain" />
      </div>
      <div className="absolute bottom-5 text-sm text-white/60">
        {i + 1} / {images.length}
      </div>
    </div>
  );
}
