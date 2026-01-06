export interface DailyScheduleEntry {
  id: number;
  label: string;
  description: string;
  messageId?: number;
}

export const STATIC_DAILY_HEADER_TEXT: DailyScheduleEntry[] = [
  {
    id: 1,
    label: 'Sunday',
    description:
      'ஞாயிறு  கிழமை -அபிஷேகம், * ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பாள், *அய்யனார் கோவில்,  * பெருமாள் கோவில்',
  },
  {
    id: 2,
    label: 'Monday',
    description:
      'திங்கட் கிழமை கிழமை அர்சனை  -* ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பாள், * அய்யனார் கோவில், * பெருமாள் கோவில்',
  },
  {
    id: 3,
    label: 'Tuesday',
    description:
      'செவ்வாய்  கிழமை -அபிஷேகம், * ஆத்தங்கரை பிள்ளையാർ, * சிவன் கோவிலில், சிவன்+ அம்பாள், *அய்யனார் கோவில், * பெருமாள் கோவில்',
  },
  {
    id: 4,
    label: 'Wednesday',
    description:
      'கிழம அர்சனை  -* ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பாள், * அய்யனார் கோவில், * பெருமாள் கோவில்',
  },
  {
    id: 5,
    label: 'Thursday',
    description:
      'வியாழன் கிழமை அர்சனை  -* ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பாள், * அய்யனார் கோவில், * பெருமாள் கோவில்',
  },
  {
    id: 6,
    label: 'Friday',
    description:
      'வெள்ளி  கிழமை -அபிஷேகம், * ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பாள், *அய்யனார் கோவில், * பெருமாள் கோவில்',
  },
  {
    id: 7,
    label: 'Saturday',
    description:
      'சனி கிழமை அர்சனை  -* ஆத்தங்கரை பிள்ளையார், * சிவன் கோவிலில், சிவன்+ அம்பாள், * அய்யனார் கோவில், * பெருமாள் கோவில் + நவக்ரக அபிஷேகம் / அர்சனை',
  },
];

export const FALLBACK_DAILY_HEADERS: Record<string, string> = STATIC_DAILY_HEADER_TEXT.reduce(
  (result, entry) => {
    result[entry.label] = entry.description;
    return result;
  },
  {} as Record<string, string>,
);
