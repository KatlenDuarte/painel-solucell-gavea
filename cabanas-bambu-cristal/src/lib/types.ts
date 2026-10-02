// Modelo de dados do site. Tudo que aparece no site público vem daqui
// e pode ser editado pelo painel administrativo.

export interface Cabin {
  id: string;
  slug: string;
  name: string;
  tagline: string; // frase curta exibida no card
  description: string; // texto longo (parágrafos separados por linha em branco)
  capacity: number; // hóspedes
  beds: string; // ex.: "1 cama queen"
  size: string; // ex.: "32 m²"
  priceWeekday: number; // diária de domingo a quinta
  priceWeekend: number; // diária de sexta e sábado
  extraGuestFee: number; // por hóspede extra, por noite (acima de baseGuests)
  baseGuests: number; // hóspedes incluídos na diária
  cleaningFee: number; // taxa única por estadia
  minNights: number;
  images: string[];
  video: string; // YouTube, Vimeo ou link .mp4
  amenities: string[];
  active: boolean;
}

export interface Extra {
  id: string;
  name: string;
  description: string;
  price: number;
  unit: "stay" | "night" | "guest"; // por estadia, por noite ou por hóspede/noite
  active: boolean;
}

export interface Experience {
  id: string;
  title: string;
  text: string;
  image: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
}

export interface Testimonial {
  id: string;
  name: string;
  text: string;
}

export interface SpecialPrice {
  id: string;
  label: string; // ex.: "Réveillon"
  cabinId: string; // "all" = todas as cabanas
  start: string; // YYYY-MM-DD (primeira noite)
  end: string; // YYYY-MM-DD (última noite)
  price: number; // diária no período
  minNights: number; // 0 = usa o mínimo da cabana
}

export interface General {
  name: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  heroVideo: string;
  introTitle: string;
  introText: string;
  aboutTitle: string;
  aboutText: string;
  aboutImage: string;
  whatsapp: string; // somente números com DDI, ex.: 5511999999999
  instagram: string;
  email: string;
  phone: string;
  address: string;
  mapsEmbed: string; // link de incorporação do Google Maps (ou endereço)
  checkInTime: string;
  checkOutTime: string;
  policies: string;
  paymentInfo: string; // ex.: "50% de sinal via Pix para confirmar"
  whatsappIntro: string; // frase de abertura da mensagem
  footerText: string;
  accentColor: string;
}

export interface SiteContent {
  general: General;
  cabins: Cabin[];
  extras: Extra[];
  experiences: Experience[];
  faqs: Faq[];
  testimonials: Testimonial[];
  specialPrices: SpecialPrice[];
  gallery: string[];
  updatedAt?: number;
}

export type DayStatus = "booked" | "blocked";

export interface DayMark {
  status: DayStatus;
  note?: string;
  requestId?: string; // preenchido quando veio de uma pré-reserva confirmada
}

// calendar[cabinId][YYYY-MM-DD] = marcação daquela NOITE
export type Calendar = Record<string, Record<string, DayMark>>;

export type RequestStatus = "new" | "confirmed" | "declined";

export interface BookingRequest {
  id: string;
  cabinId: string;
  cabinName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  name: string;
  phone: string;
  email: string;
  notes: string;
  extras: { name: string; total: number }[];
  total: number;
  status: RequestStatus;
  createdAt: number;
}
