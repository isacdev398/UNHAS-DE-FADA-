import { HomeView } from "@/components/site/home-view";
import { getCatalog, getGallery, getPublishedContent, getTestimonials } from "@/lib/data/public";

export default async function HomePage() {
  const [content, catalog, gallery, testimonials] = await Promise.all([
    getPublishedContent(),
    getCatalog(),
    getGallery(),
    getTestimonials(),
  ]);
  return <HomeView content={content} catalog={catalog} gallery={gallery} testimonials={testimonials} />;
}
