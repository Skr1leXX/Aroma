export const siteConfig = {
  name: "Aroma",
  tagline: "Современная европейская кухня",
  description:
    "Aroma — ресторан современной европейской кухни: сезонные продукты, живой огонь и спокойная тёплая атмосфера.",
  phone: "+7 (495) 123-45-67",
  email: "hello@aroma-restaurant.ru",
  address: "Москва, Столешников пер., 12",
  coordinates: { lat: 55.7648, lng: 37.6196 },
  hours: [
    { days: "Пн–Чт", time: "12:00 – 23:00" },
    { days: "Пт–Сб", time: "12:00 – 01:00" },
    { days: "Вс", time: "12:00 – 22:00" },
  ],
  social: [
    { label: "Instagram", href: "https://instagram.com" },
    { label: "Telegram", href: "https://t.me" },
  ],
} as const;

export const publicNav = [
  { href: "/", label: "Главная" },
  { href: "/about", label: "О ресторане" },
  { href: "/menu", label: "Меню" },
  { href: "/gallery", label: "Галерея" },
  { href: "/contacts", label: "Контакты" },
] as const;

export const adminNav = [
  { href: "/admin", label: "Dashboard", icon: "layout" },
  { href: "/admin/bookings", label: "Бронирования", icon: "calendar" },
  { href: "/admin/menu", label: "Меню", icon: "utensils" },
  { href: "/admin/categories", label: "Категории", icon: "tags" },
  { href: "/admin/reviews", label: "Отзывы", icon: "message" },
  { href: "/admin/gallery", label: "Галерея", icon: "image" },
  { href: "/admin/settings", label: "Настройки", icon: "settings" },
  { href: "/admin/audit", label: "Журнал", icon: "history" },
] as const;

