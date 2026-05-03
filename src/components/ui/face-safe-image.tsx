"use client";

import Image, { type ImageProps } from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  faceSafeObjectPosition,
  focalToObjectPosition,
  type FaceBoxLike,
  type FocalPointLike,
} from "@/lib/focal-point";

type FaceSafeProps = Omit<ImageProps, "objectFit"> & {
  faceBox?: FaceBoxLike;
  focalPoint?: FocalPointLike;
};

// Drop-in for next/image that picks an `object-position` keeping the entire
// faceBox inside the visible window. Still uses `object-cover`; falls back to
// the focal point (or 50% 50%) until natural dimensions are known.
export function FaceSafeImage({
  faceBox,
  focalPoint,
  style,
  className,
  ...rest
}: FaceSafeProps) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [pos, setPos] = useState(() => focalToObjectPosition(focalPoint));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const recompute = () => {
      const img = ref.current;
      if (!img) return;
      const nW = img.naturalWidth;
      const nH = img.naturalHeight;
      if (!nW || !nH) return;
      const rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setPos(
        faceSafeObjectPosition({
          faceBox,
          focalPoint,
          naturalAspect: nW / nH,
          containerAspect: rect.width / rect.height,
        }),
      );
    };

    if (el.complete && el.naturalWidth > 0) recompute();
    const onLoad = () => recompute();
    el.addEventListener("load", onLoad);
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    });
    ro.observe(el);

    return () => {
      el.removeEventListener("load", onLoad);
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [
    faceBox?.x,
    faceBox?.y,
    faceBox?.width,
    faceBox?.height,
    focalPoint?.x,
    focalPoint?.y,
  ]);

  return (
    <Image
      ref={ref}
      className={className}
      style={{ ...style, objectPosition: pos }}
      {...rest}
    />
  );
}

// Same logic but for a raw <img>. Pack-gallery uses one because its src is a
// remote URL and the surrounding code already opts out of next/image.
export function FaceSafeImg({
  faceBox,
  focalPoint,
  style,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  faceBox?: FaceBoxLike;
  focalPoint?: FocalPointLike;
}) {
  const ref = useRef<HTMLImageElement | null>(null);
  const [pos, setPos] = useState(() => focalToObjectPosition(focalPoint));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const recompute = () => {
      const img = ref.current;
      if (!img) return;
      const nW = img.naturalWidth;
      const nH = img.naturalHeight;
      if (!nW || !nH) return;
      const rect = img.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      setPos(
        faceSafeObjectPosition({
          faceBox,
          focalPoint,
          naturalAspect: nW / nH,
          containerAspect: rect.width / rect.height,
        }),
      );
    };

    if (el.complete && el.naturalWidth > 0) recompute();
    const onLoad = () => recompute();
    el.addEventListener("load", onLoad);
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(recompute);
    });
    ro.observe(el);

    return () => {
      el.removeEventListener("load", onLoad);
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [
    faceBox?.x,
    faceBox?.y,
    faceBox?.width,
    faceBox?.height,
    focalPoint?.x,
    focalPoint?.y,
  ]);

  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img ref={ref} style={{ ...style, objectPosition: pos }} {...rest} />;
}
