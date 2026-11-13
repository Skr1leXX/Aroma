export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
};

export type Dish = {
  id: string;
  slug: string;
  name: string;
  description: string;
  categoryId: string;
  price: number;
  weight: string;
  image: string;
  ingredients: string[];
  allergens: string[];
  popular: boolean;
  available: boolean;
};

export type Review = {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
  approved: boolean;
};

export type GalleryGroup = "dishes" | "interior" | "events" | "team" | "restaurant";

export type GalleryImage = {
  id: string;
  src: string;
  alt: string;
  group: GalleryGroup;
  featured?: boolean;
};

export type TeamMember = {
  name: string;
  role: string;
  image: string;
  bio: string;
};

export type ReservationStatus = "pending" | "confirmed" | "rejected" | "cancelled";

export type Reservation = {
  id: string;
  name: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  guests: number;
  comment?: string;
  status: ReservationStatus;
  createdAt: string;
};

/** Result shape shared by all server actions. */
export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
  /** Submitted values echoed back on failure so the form keeps what the user typed. */
  values?: Record<string, string>;
};
