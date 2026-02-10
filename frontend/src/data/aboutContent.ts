export type AboutMember = {
  name: string;
  detail?: string;
  image?: string;
};

export type FamilyTreeInfo = {
  id: string;
  name: string;
  subtitle: string;
  image?: string;
  download?: string;
  description?: string;
  isAvailable?: boolean;
};

export const AVATAR_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
    <defs>
      <linearGradient id='g' x1='0' x2='1' y1='0' y2='1'>
        <stop offset='0%' stop-color='#f0f9ff'/>
        <stop offset='100%' stop-color='#e0f2fe'/>
      </linearGradient>
    </defs>
    <rect width='64' height='64' fill='url(#g)'/>
    <circle cx='32' cy='24' r='12' fill='#7dd3fc'/>
    <rect x='14' y='40' width='36' height='18' rx='9' fill='#7dd3fc'/>
  </svg>`);

export const founderMembers: AboutMember[] = [
  {
    name: "Smt. Alamelu (Bharani) Venkateswaran (Appapalu)",
    detail: "Joint account holder with Smt. Saroja (HDC account)",
    image:
      "images/Kakkalany-Gramam-Founder-Members-images/Alamelu.jpg",
  },
  {
    name: "Smt. Lakshmi Anand",
    detail: "Daughter of Smt. Alamelu (Appapalu)",
    image:
      "images/Kakkalany-Gramam-Founder-Members-images/Lakshmi_Anand.jpg",
  },
  {
    name: "Shri. Radhakrishnan (Radhu mama)",
    image:
      "images/Kakkalany-Gramam-Founder-Members-images/Radhakrishnan.jpg",
  },
  {
    name: "Smt. Nalini Ganesan",
    image:
      "images/Kakkalany-Gramam-Founder-Members-images/Nalini_Ganesan.jpg",
  },
  {
    name: "Shri. R.S. Mani",
    image: "images/Kakkalany-Gramam-Founder-Members-images/R.S. Mani.jpg",
  },
  {
    name: "Shri. Radhachandran",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Ravichandran.png",
  },
  {
    name: "Shri. Sriram Rajk",
    detail: "Spouse account holder with Smt. Alamelu (HDC account)",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Sriram_Raju.jpg",
  },
  {
    name: "Shri. Rajendran",
    detail: "Spouse Ananthi & Rajendran to send prasadam",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Rajendran.png",
  },
  {
    name: "Shri. Manikanda Gurukkal (Indhur)",
    detail: "Priest",
    image: "images/Kakkalany-Gramam-Founder-Members-images/Sridhar.png",
  },
];

export const managingCommitteeMembers: AboutMember[] = [
  {
    name: "Shri. Radhakrishnan Suriyai",
    detail: "President",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Radhakrishnan_Sastrigal.png",
  },
  {
    name: "Shri. Srinivasan Natarajan",
    detail: "Secretary",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Sriramkumar_Natarajan.jpg",
  },
  {
    name: "Shri. R.S. Mani",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/R S Mani.jpg",
  },
  {
    name: "Smt. Lakshmi Anand",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Lakshmi_Ananad.jpg",
  },
  {
    name: "Shri. Radhakrishnan (Radhu mama)",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Radhakrishnan.jpg",
  },
  {
    name: "Smt. Latha Mani",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Latha_Murali.png",
  },
  {
    name: "Shri. Radhachandran",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Ravichandran.png",
  },
  {
    name: "Shri. Venkataramani",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Venkatramani J.jpg",
  },
  {
    name: "Shri. Swaminathan",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Swaminathan.jpg",
  },
  {
    name: "Shri. Madhusudanan (Madhu)",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Madhusudanan.jpg",
  },
  {
    name: "Shri. Rajendran",
    detail: "Member",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Rajendran.png",
  },
  {
    name: "Shri. Manikanda Gurukkal (Indhur)",
    detail: "Priest",
    image:
      "images/Kakkalany Gramam-Managing-Committee-Members-images/Sridhar.png",
  },
];

export const familyTrees: FamilyTreeInfo[] = [
  {
    id: "arunachalam-sambasiva-iyr",
    name: "Arunachalam-Sambasiva Iyr",
    subtitle: "Arunachalam - Sambasiva Iyer family",
    image: "/assets/family-trees/arunachalam-sambasiva-family-tree.svg",
    download: "/assets/family-trees/arunachalam-sambasiva-iyr.xlsx",
    description:
      "Diagram generated from the latest Arunachalam – Sambasiva Iyer family tree records.",
    isAvailable: true,
  },
  {
    id: "kadakarar-subramani-iyr",
    name: "Kadakarar Subramani Iyr",
    subtitle: "Kadakarar Subramani Iyer family",
    image: "/assets/family-trees/kadakarar-subramani-iyr-family-tree.svg",
    download: "/assets/family-trees/kadakarar-subramani-iyr.xlsx",
    description:
      "Diagram generated from the latest Kadakarar Subramani Iyer family tree records.",
    isAvailable: true,
  },
  {
    id: "sundaresa-iyr-pannai-balu",
    name: "Sundaresa Iyr+ Pannai+Balu Fmly",
    subtitle: "Sundaresa Iyer, Pannai, and Balu family lineage",
    image: "/assets/family-trees/sundaresa-iyr-pannai-balu-family-tree.svg",
    download: "/assets/family-trees/sundaresa-iyr-pannai-balu.xlsx",
    description:
      "Diagram generated from the latest Sundaresa Iyer, Pannai, and Balu family lineage records.",
    isAvailable: true,
  },
  {
    id: "narayanaswamy-family",
    name: "Narayanswamy fmly",
    subtitle: "Narayanswamy family",
    image: "/assets/family-trees/narayanaswamy-fmly-family-tree.svg",
    download: "/assets/family-trees/narayanaswamy-fmly.xlsx",
    description:
      "Diagram generated from the latest Narayanswamy family tree records.",
    isAvailable: true,
  },
  {
    id: "mangalam-periyamma-family",
    name: "Mangalam Periyamma Fmly",
    subtitle: "Mangalam Periyamma family",
    image: "/assets/family-trees/mangalam-periyamma-fmly-family-tree.svg",
    download: "/assets/family-trees/mangalam-periyamma-fmly.xlsx",
    description:
      "Diagram generated from the latest Mangalam Periyamma family tree records.",
    isAvailable: true,
  },
  {
    id: "koorakattu-family",
    name: "Koorakattu Fmly",
    subtitle: "Koorakattu family",
    image: "/assets/family-trees/koorakattu-fmly-family-tree.svg",
    download: "/assets/family-trees/koorakattu-fmly.xlsx",
    description:
      "Diagram generated from the latest Koorakattu family tree records.",
    isAvailable: true,
  },
  {
    id: "ramanisasti-fmly",
    name: "RamaniSastri Fmly",
    subtitle: "Ramani Sastrigal family",
    image: "/assets/family-trees/ramanisasti-fmly-family-tree.svg",
    download: "/assets/family-trees/ramanisasti-fmly.xlsx",
    description:
      "Diagram generated from the latest Ramani Sastrigal family tree records.",
    isAvailable: true,
  },
  {
    id: "pichu-iyr-family",
    name: "Pichu Iyr Fmly",
    subtitle: "Pichu Iyer family",
    image: "/assets/family-trees/pichu-iyr-fmly-family-tree.svg",
    download: "/assets/family-trees/pichu-iyr-fmly.xlsx",
    description:
      "Diagram generated from the latest Pichu Iyer family tree records.",
    isAvailable: true,
  },
  {
    id: "pattamani-iyr-family",
    name: "Pattamani Iyr Fmly",
    subtitle: "Pattamani Iyer family",
    image: "/assets/family-trees/pattamani-iyr-fmly-family-tree.svg",
    download: "/assets/family-trees/pattamani-iyr-fmly.xlsx",
    description:
      "Diagram generated from the latest Pattamani Iyer family tree records.",
    isAvailable: true,
  },
];
