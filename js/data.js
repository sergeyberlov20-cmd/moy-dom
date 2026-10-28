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
    image: "images/flat1.jpg",
    images: [
      "images/flat1.jpg",
      "images/flat2.jpg",
      "images/flat3.jpg"
    ],
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
    image: "images/flat2.jpg",
    images: [
      "images/flat2.jpg",
      "images/flat4.jpg"
    ],
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
    image: "images/flat3.jpg",
    images: [
      "images/flat3.jpg",
      "images/flat1.jpg"
    ],
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
    image: "images/flat4.jpg",
    images: [
      "images/flat4.jpg"
    ],
    description: "Сухой гараж с погребом.",
    date: "2025-05-10"
  }
];

function formatPrice(price, deal) {
  const formatted = new Intl.NumberFormat("ru-RU").format(price) + " ₽";
  return deal === "Аренда" ? formatted + "/мес" : formatted;
}
