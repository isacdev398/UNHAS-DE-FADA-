import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Unhas de Fada",
    short_name: "Unhas de Fada",
    description: "Manicure e pedicure com horário marcado.",
    start_url: "/",
    display: "standalone",
    background_color: "#fff8f7",
    theme_color: "#fff8f7",
    lang: "pt-BR",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
