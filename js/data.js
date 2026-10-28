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
    description: "Светлая квартира с ремонтом в новом доме.",
    date: "2025-05-20"
  },
  {
    id: 2,
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
    id: 3,
    type: "Офис",
    deal: "Аренда",
    title: "Офис 50 м² в центре",
    price: 35000,
    address: "г. Мариуполь, пр. Ленина, 54",
    rooms: 2,
    area: 50,
    floor: 3,
    floors: 5,
    image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
    description: "Светлый офис с ремонтом, парковка.",
    date: "2025-05-28"
  },
  {
    id: 4,
    type: "Гараж",
    deal: "Продажа",
    title: "Гараж 24 м²",
    price: 800000,
    address: "г. Мариуполь, ГСК Восток",
    rooms: 1,
    area: 24,
    floor: 0,
    floors: 1,
    image: "https://images.unsplash.com/photo-1590521540684-01d3553b4b59?w=800",
    description: "Сухой гараж с погребом.",
    date: "2025-05-10"
  }
];

function formatPrice(price, deal) {
  const formatted = new Intl.NumberFormat("ru-RU").format(price) + " ₽";
  return deal === "Аренда" ? formatted + "/мес" : formatted;
}
