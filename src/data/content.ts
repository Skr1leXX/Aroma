import type { GalleryImage, Reservation, Review, TeamMember } from "@/types";
import { img } from "./images";

export const reviews: Review[] = [
  { id: "r1", author: "Анна К.", rating: 5, date: "2026-10-28", approved: true,
    text: "Лучшая паста в городе и очень тёплая атмосфера. Официанты ненавязчивые, а десерты — отдельная история." },
  { id: "r2", author: "Дмитрий С.", rating: 5, date: "2026-10-15", approved: true,
    text: "Отмечали юбилей: меню подобрали заранее, лосось был идеальным. Вернёмся обязательно." },
  { id: "r3", author: "Елена В.", rating: 4, date: "2026-09-30", approved: true,
    text: "Красивый интерьер, приятная музыка, отличная винная карта. Хотелось бы больше вегетарианских блюд." },
  { id: "r4", author: "Игорь М.", rating: 5, date: "2026-09-12", approved: false,
    text: "Рёбра — просто огонь! Порции щедрые, подача аккуратная." },
];

export const galleryImages: GalleryImage[] = [
  { id: "g1", src: img.interiorHall, alt: "Главный зал Aroma", group: "interior" },
  { id: "g2", src: img.tagliatelle, alt: "Тальятелле с грибами", group: "dishes" },
  { id: "g3", src: img.terrace, alt: "Летняя терраса", group: "interior" },
  { id: "g4", src: img.salmon, alt: "Лосось с овощами", group: "dishes" },
  { id: "g5", src: img.wine, alt: "Дегустация вина", group: "events" },
  { id: "g6", src: img.interiorDark, alt: "Вечерний зал", group: "interior" },
  { id: "g7", src: img.pannaCotta, alt: "Панна-котта", group: "dishes" },
  { id: "g8", src: img.guests, alt: "Семейный ужин", group: "events" },
  { id: "g9", src: img.brunch, alt: "Воскресный бранч", group: "events" },
  { id: "g10", src: img.grill, alt: "Гриль-сет", group: "dishes" },
  { id: "g11", src: img.interiorCafe, alt: "Зона у окна", group: "interior" },
  { id: "g12", src: img.fishTomato, alt: "Треска с томатным конфи", group: "dishes" },
];

export const team: TeamMember[] = [
  { name: "Марко Росси", role: "Шеф-повар", image: img.chef,
    bio: "15 лет на кухнях Милана и Лиона. Верит, что хорошая еда — это три ингредиента и огонь." },
  { name: "Андрей Волков", role: "Су-шеф", image: img.chefFlame,
    bio: "Отвечает за гриль и сезонное меню, сам выбирает продукты на фермерских рынках." },
];

export const reservations: Reservation[] = [
  { id: "b1", name: "Ольга Петрова", phone: "+7 (916) 111-22-33", email: "olga@example.com",
    date: "2026-11-15", time: "19:00", guests: 4, comment: "День рождения, нужен торт", status: "pending", createdAt: "2026-11-12" },
  { id: "b2", name: "Сергей Иванов", phone: "+7 (903) 222-33-44", email: "sergey@example.com",
    date: "2026-11-15", time: "20:00", guests: 2, status: "confirmed", createdAt: "2026-11-11" },
  { id: "b3", name: "Мария Соколова", phone: "+7 (925) 333-44-55", email: "maria@example.com",
    date: "2026-11-16", time: "13:00", guests: 6, comment: "Детский стул", status: "confirmed", createdAt: "2026-11-10" },
  { id: "b4", name: "Артём Лебедев", phone: "+7 (999) 444-55-66", email: "artem@example.com",
    date: "2026-11-17", time: "21:00", guests: 3, status: "cancelled", createdAt: "2026-11-09" },
  { id: "b5", name: "Игорь Демидов", phone: "+7 (900) 000-00-05", email: "demo5@example.com",
    date: "2026-11-15", time: "13:00", guests: 2, status: "confirmed", createdAt: "2026-11-12" },
  { id: "b6", name: "Вера Лунина", phone: "+7 (900) 000-00-06", email: "demo6@example.com",
    date: "2026-11-15", time: "18:00", guests: 5, comment: "Нужен столик у окна", status: "pending", createdAt: "2026-11-13" },
  { id: "b7", name: "Павел Орлов", phone: "+7 (900) 000-00-07", email: "demo7@example.com",
    date: "2026-11-16", time: "20:00", guests: 4, status: "pending", createdAt: "2026-11-13" },
  { id: "b8", name: "Нина Краснова", phone: "+7 (900) 000-00-08", email: "demo8@example.com",
    date: "2026-11-17", time: "19:00", guests: 8, comment: "Семейный ужин", status: "confirmed", createdAt: "2026-11-13" },
  { id: "b9", name: "Олег Весов", phone: "+7 (900) 000-00-09", email: "demo9@example.com",
    date: "2026-11-18", time: "14:00", guests: 3, status: "rejected", createdAt: "2026-11-13" },
  { id: "b10", name: "Тамара Серова", phone: "+7 (900) 000-00-10", email: "demo10@example.com",
    date: "2026-11-19", time: "19:00", guests: 6, status: "confirmed", createdAt: "2026-11-13" },
];
