import {continueRender, delayRender, staticFile} from 'remotion';

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

type Face = {family: string; file: string; weight: string; style: string};

const faces: Face[] = [];
for (const weight of ['700', '800', '900']) {
  for (const [subset] of [['latin'], ['latin-ext']]) {
    faces.push({family: 'Montserrat', file: `montserrat-${subset}-${weight}-normal.woff2`, weight, style: 'normal'});
    faces.push({family: 'Montserrat', file: `montserrat-${subset}-${weight}-italic.woff2`, weight, style: 'italic'});
    faces.push({family: 'Nunito', file: `nunito-${subset}-${weight}-normal.woff2`, weight, style: 'normal'});
  }
}

let loaded: Promise<void> | null = null;

/** Loads the self-hosted OFL fonts once. Blocks rendering until they are ready. */
export const loadFonts = (): Promise<void> => {
  if (loaded) return loaded;
  if (typeof document === 'undefined') return Promise.resolve();
  const handle = delayRender('Loading fonts');
  loaded = Promise.all(
    faces.map((f) => {
      const face = new FontFace(f.family, `url(${staticFile(`fonts/${f.file}`)}) format('woff2')`, {
        weight: f.weight,
        style: f.style,
        unicodeRange: f.file.includes('latin-ext') ? LATIN_EXT : LATIN,
      });
      document.fonts.add(face);
      return face.load();
    }),
  )
    .then(() => undefined)
    .catch((err) => {
      console.error('Font loading failed', err);
    })
    .finally(() => continueRender(handle));
  return loaded;
};
