import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KOK } from './dist';

export interface Kitap {
  id: string;
  title: string;
  authors: string[];
  isbn: string | null;
  is_set: boolean;
  sources: {
    kitapyurdu: string | null;
    nobelkitap: string | null;
    kureselkitap: string | null;
    other: string[];
  };
}

export interface Yazar {
  slug: string;
  name?: string;
}

interface OnsozKaydi {
  slug: string;
  status: string;
  page_count: number;
}

const oku = <T>(yol: string): T => JSON.parse(readFileSync(join(KOK, yol), 'utf8')) as T;

export const kitaplar = (): Kitap[] => oku<Kitap[]>('data/catalog/books.json');
export const yazarlar = (): Yazar[] => oku<Yazar[]>('data/catalog/authors.json');
export const onsozIndex = (): OnsozKaydi[] => oku<OnsozKaydi[]>('data/catalog/onsoz/INDEX.json');
export const vitrin = (): { one_cikan: string; onizleme_vitrini: string[] } =>
  oku('data/site/vitrin.json');

/** Önizlemesi olan kitap kimlikleri (INDEX durumu "ok"). */
export const onizlemeliIdler = (): string[] =>
  onsozIndex().filter((k) => k.status === 'ok').map((k) => k.slug);

/** Görev tanımındaki 10 örnek: ilk, son, en uzun başlık, 2 set, 3 önizlemeli, 1 yazarsız. */
export function ornekKitaplar(): Kitap[] {
  const hepsi = kitaplar();
  const bul = (id: string): Kitap => {
    const k = hepsi.find((x) => x.id === id);
    if (!k) throw new Error(`books.json içinde yok: ${id}`);
    return k;
  };
  const enUzun = [...hepsi].sort((a, b) => b.title.length - a.title.length)[0];
  const setler = hepsi.filter((k) => k.is_set).slice(0, 2);
  const onizlemeli = ['sen-neden-kor-edildin', 'son-halifenin-drami', 'inas'].map(bul);
  const secim = [hepsi[0], hepsi[hepsi.length - 1], enUzun, ...setler, ...onizlemeli, bul('raculus-sanem')];
  const benzersiz = new Map(secim.map((k) => [k.id, k]));
  return [...benzersiz.values()];
}
