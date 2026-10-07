import { notFound } from 'next/navigation';

// Any unknown path inside a language (/fr/anything) renders the branded, translated not-found page.
export const dynamicParams = true;

export default function MissingPage() {
  notFound();
}
