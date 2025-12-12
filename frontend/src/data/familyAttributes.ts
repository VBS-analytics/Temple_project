import { nakshatraOptions } from './nakshatraOptions';

export const gothraOptions = [
  'ஆத்ரேயா',
  'நைத்திருவ காட்ச்யபம்',
  'காஷ்யப கோத்திரம்',
  'வாதூல கோத்திரம்',
  'கார்கேயா',
  'கவுண்டின்யா',
  'கெளஷிகா',
  'கெளதமர்',
  'பரத்வாஜா',
  'ஹரிதா',
  'செளநகா',
  'சாண்டில்யர்',
  'ஸ்ரீவத்ஸ கோத்திரம்',
  'விஷ்ணு கோத்திரம்',
  'லத்ஸ் கோத்திரம்',
] as const;

export const rasiOptions = [
  'மேஷம்',
  'ரிஷபம்',
  'மிதுனம்',
  'கடகம்',
  'சிம்மம்',
  'கன்னி',
  'துலாம்',
  'விருச்சிகம்',
  'தனுசு',
  'மகரம்',
  'கும்பம்',
  'மீனம்',
] as const;

export const tamilStarOptions = nakshatraOptions;

export type GothraOption = (typeof gothraOptions)[number];
export type RasiOption = (typeof rasiOptions)[number];
export type TamilStarOption = (typeof tamilStarOptions)[number];
