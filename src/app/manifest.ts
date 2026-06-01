import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rhythm",
    short_name: "Rhythm",
    description: "Mobile-first family responsibility and money tracking.",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    background_color: "#222A59",
    theme_color: "#222A59",
    icons: [
      {
        src: "/brand/rhythm-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
