const OBJECTS = [
  {
    id: 1,
    type: "Квартира",
    deal: "Продажа",
    title: "2-комнатная квартира, 62 м²",
    price: 4500000,
    address: "г. Мариуполь, пр. Мира, 15",
    rooms: 2,
    area: 62,
    floor: 5,
    floors: 12,
    image: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
    description: "Светлая квартира с ремонтом в новом доме. Рядом школа, парк, остановка.",
    date: "2025-05-20"
  },
  {
    id: 2,
    type: "Квартира",
    deal: "Продажа",
    title: "3-комнатная квартира, 85 м²",
    price: 6800000,
    address: "г. Мариуполь, ул. Куинджи, 20",
    rooms: 3,
    area: 85,
    floor: 8,
    floors: 16,
    image: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
    description: "Просторная квартира с панорамными окнами и качественным ремонтом.",
    date: "2025-05-25"
  },
  {
    id: 3,
    type: "Дом",
    deal: "Продажа",
    title: "Загородный дом, 180 м²",
    price: 9200000,
    address: "Мариупольский р-н, п. Сосновка",
    rooms: 5,
    area: 180,
    floor: 2,
    floors: 2,
    image: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800",
    description: "Уютный дом с участком 10 соток, гаражом и баней.",
    date: "2025-05-15"
  },
  {
    id: 4,
    type: "Квартира",
    deal: "Аренда",
    title: "1-комнатная квартира, 38 м²",
    price: 25000,
    address: "г. Мариуполь, пр. Строителей, 8",
    rooms: 1,
    area: 38,
    floor: 3,
    floors: 9,
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
    description: "Квартира в центре города, полностью мебелирована, готова к заселению.",
    date: "2025-05-28"
  },
  {
    id: 5,
    type: "Квартира",
    deal: "Продажа",
    title: "Студия, 32 м²",
    price: 2900000,
    address: "г. Мариуполь, ул. Казанцева, 12",
    rooms: 1,
    area: 32,
    floor: 10,
    floors: 15,
    image: "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800",
    description: "Современная студия с ремонтом и мебелью. Отличный вариант для инвестиций.",
    date: "2025-05-10"
  },
  {
    id: 6,
    type: "Дом",
    deal: "Аренда",
    title: "Коттедж, 120 м²",
    price: 45000,
    address: "Мариупольский р-н, п. Заречье",
    rooms: 4,
    area: 120,
    floor: 2,
    floors: 2,
    image: "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
    description: "Коттедж с участком и всеми удобствами. Тихий район, рядом лес.",
    date: "2025-05-01"
  }
];

function formatPrice(price, deal) {
  const formatted = new Intl.NumberFormat("ru-RU").format(price) + " ₽";
  return deal === "Аренда" ? formatted + "/мес" : formatted;
}