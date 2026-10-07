import { notFound } from 'next/navigation';
import { Hero } from '@/components/home/Hero';
import { BestSellers, CategoryStrip, FindUs, Modes, Promo, ReserveCta, Why } from '@/components/home/Sections';
import { demoMenu } from '@/content/demo/menu';
import { getDictionary, isLocale } from '@/i18n';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = getDictionary(locale);
  const featured = demoMenu.products.filter((p) => p.featured && p.available);

  return (
    <>
      <Hero locale={locale} dict={dict} />
      <CategoryStrip locale={locale} dict={dict} categories={demoMenu.categories} />
      <BestSellers locale={locale} dict={dict} products={featured} />
      <Promo locale={locale} dict={dict} />
      <Modes locale={locale} dict={dict} />
      <Why locale={locale} dict={dict} />
      <ReserveCta locale={locale} dict={dict} />
      <FindUs locale={locale} dict={dict} />
    </>
  );
}
