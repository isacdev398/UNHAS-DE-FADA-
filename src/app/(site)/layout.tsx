import { Suspense } from "react";
import { SiteBottomNav } from "@/components/site/bottom-nav";
import { SiteFooter } from "@/components/site/footer";
import { getPublishedContent } from "@/lib/data/public";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const content = await getPublishedContent();
  return (
    <>
      {children}
      <SiteFooter content={content} />
      <Suspense>
        <SiteBottomNav />
      </Suspense>
    </>
  );
}
