export type OriginalSource = 'wikisource' | 'suttacentral' | 'gita' | 'perseus' | 'sefaria';

export interface Work {
  id: string;
  author: string;
  title: string;
  originalTitle: string;
  originalLanguage: string;
  tradition: string;
  translator: string;
  year: number;
  original: OriginalSource;
}

export const PILOT_WORKS: Work[] = [
  {
    id: 'tao-te-ching',
    author: 'Laozi',
    title: 'Tao Te Ching',
    originalTitle: '道德經',
    originalLanguage: 'lzh',
    tradition: 'chinese',
    translator: 'James Legge',
    year: 1891,
    original: 'wikisource',
  },
  {
    id: 'analects',
    author: 'Confucius',
    title: 'The Analects',
    originalTitle: '論語',
    originalLanguage: 'lzh',
    tradition: 'chinese',
    translator: 'James Legge',
    year: 1861,
    original: 'wikisource',
  },
  {
    id: 'dhammapada',
    author: 'Attributed to the Buddha',
    title: 'The Dhammapada',
    originalTitle: 'Dhammapada',
    originalLanguage: 'pli',
    tradition: 'indian',
    translator: 'F. Max Müller',
    year: 1881,
    original: 'suttacentral',
  },
  {
    id: 'bhagavad-gita',
    author: 'Anonymous (Mahabharata)',
    title: 'The Song Celestial (Bhagavad Gita)',
    originalTitle: 'भगवद्गीता',
    originalLanguage: 'san',
    tradition: 'indian',
    translator: 'Edwin Arnold',
    year: 1885,
    original: 'gita',
  },
  {
    id: 'enchiridion',
    author: 'Epictetus',
    title: 'The Enchiridion',
    originalTitle: 'Ἐγχειρίδιον',
    originalLanguage: 'grc',
    tradition: 'greco-roman',
    translator: 'Thomas Wentworth Higginson',
    year: 1865,
    original: 'perseus',
  },
  {
    id: 'meditations',
    author: 'Marcus Aurelius',
    title: 'Meditations',
    originalTitle: 'Τὰ εἰς ἑαυτόν',
    originalLanguage: 'grc',
    tradition: 'greco-roman',
    translator: 'Meric Casaubon',
    year: 1634,
    original: 'perseus',
  },
  {
    id: 'sermon-on-the-mount',
    author: 'Jesus (per Matthew)',
    title: 'Sermon on the Mount (Matthew 5-7)',
    originalTitle: 'Κατὰ Ματθαῖον 5–7',
    originalLanguage: 'grc',
    tradition: 'abrahamic',
    translator: 'King James Version',
    year: 1611,
    original: 'perseus',
  },
  {
    id: 'ecclesiastes',
    author: 'Qoheleth',
    title: 'Ecclesiastes',
    originalTitle: 'קֹהֶלֶת',
    originalLanguage: 'hbo',
    tradition: 'abrahamic',
    translator: 'King James Version',
    year: 1611,
    original: 'sefaria',
  },
];
