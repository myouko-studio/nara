import type { SpecialMessageResource } from './types';

export const firstCollectionItemMessage: SpecialMessageResource = {
  id: 'firstCollectionItem',
  locales: {
    es: {
      imageDescription: 'La primera pieza de tu colección',
      blocks: [
        { kind: 'title', text: '✨ PRIMERA PIEZA REGISTRADA ✨' },
        { kind: 'shout', text: 'AAAAAAAAAAAAAAAAAAAAAAAAH 💖' },
        { kind: 'emphasis', text: '¡ES LA PRIMERA!\n¡LA PRIMERA!\n¡LA PRIMERA DE TODAS!' },
        { kind: 'decoration', text: '✨📸🌸💖✨📸🌸💖✨' },
        { kind: 'emphasis', text: 'Hiya! 💖\nTu colección ya tiene memoria.' },
        {
          kind: 'body',
          text: 'Puede que esta no sea la más rara.\nPuede que tampoco sea la más valiosa.\nPero es la primera.\nLa pieza que convirtió una aplicación vacía en una colección.\nY eso la hace especial. ✨',
        },
        { kind: 'decoration', text: '🌸💖📸' },
        {
          kind: 'body',
          text: 'Nara all around the world... empieza por una sola photocard.',
        },
        { kind: 'signature', text: '💖 Myouko, Stay\n💖 Eko, Stay Honoraria' },
      ],
      buttonLabel: '💖 EMPEZAMOS 💖',
    },
    en: {
      imageDescription: 'The first piece in your collection',
      blocks: [
        { kind: 'title', text: '✨ FIRST PIECE REGISTERED ✨' },
        { kind: 'shout', text: 'AAAAAAAAAAAAAAAAAAAAAAAAH 💖' },
        { kind: 'emphasis', text: "IT'S THE FIRST!\nTHE FIRST!\nTHE VERY FIRST!" },
        { kind: 'decoration', text: '✨📸🌸💖✨📸🌸💖✨' },
        { kind: 'emphasis', text: 'Hiya! 💖\nYour collection has a memory now.' },
        {
          kind: 'body',
          text: "Maybe this one isn't the rarest.\nMaybe it isn't the most valuable either.\nBut it's the first.\nThe piece that turned an empty app into a collection.\nAnd that makes it special. ✨",
        },
        { kind: 'decoration', text: '🌸💖📸' },
        {
          kind: 'body',
          text: 'Nara all around the world... it all starts with one photocard.',
        },
        { kind: 'signature', text: '💖 Myouko, Stay\n💖 Eko, Stay Honoraria' },
      ],
      buttonLabel: "💖 LET'S BEGIN 💖",
    },
  },
};
