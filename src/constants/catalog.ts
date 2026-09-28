import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";

export type IconName = ComponentProps<typeof Ionicons>["name"];

export type Category = {
  id: string;
  slug?: string;
  name: string;
  icon: IconName;
  description: string;
};

export type Store = {
  id: string;
  name: string;
  categoryIds: string[];
  description: string;
  location: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: string;
  productCount?: number;
  categoryIcon?: IconName;
  currency?: "SYP" | "USD";
  deliveryMode?: "store" | "platform";
  storeDeliveryFee?: number;
  featured?: boolean;
};

export type Product = {
  id: string;
  storeId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  currency?: "SYP" | "USD";
  storeProductId?: string;
  minimumQuantity?: number;
  quantityStep?: number;
  imageUrl?: string | null;
  unit: string;
  available: boolean;
  popular?: boolean;
  offer?: boolean;
};

/* -------------------------------------------------------------------------- */
/* التصنيفات                                                                  */
/* -------------------------------------------------------------------------- */

export const categories: Category[] = [
  {
    id: "supermarkets",
    name: "سوبرماركت",
    icon: "cart-outline",
    description: "مواد غذائية ومستلزمات المنزل",
  },
  {
    id: "vegetables",
    name: "خضار وفواكه",
    icon: "leaf-outline",
    description: "خضار وفواكه طازجة",
  },
  {
    id: "meat",
    name: "ملاحم",
    icon: "restaurant-outline",
    description: "لحوم ودجاج",
  },
  {
    id: "roastery",
    name: "محامص",
    icon: "flame-outline",
    description: "مكسرات وقهوة وتسلية",
  },
  {
    id: "bakery",
    name: "مخابز",
    icon: "nutrition-outline",
    description: "خبز ومعجنات ومخبوزات",
  },
  {
    id: "coffee",
    name: "قهوة ومشروبات",
    icon: "cafe-outline",
    description: "قهوة ومشروبات ساخنة وباردة",
  },
  {
    id: "juice",
    name: "عصائر وحلويات",
    icon: "wine-outline",
    description: "عصائر وحلويات",
  },
  {
    id: "restaurants",
    name: "مطاعم",
    icon: "fast-food-outline",
    description: "وجبات ومأكولات متنوعة",
  },
  {
    id: "pharmacy",
    name: "صيدليات",
    icon: "medkit-outline",
    description: "منتجات العناية والصحة",
  },
  {
    id: "cosmetics",
    name: "عناية وتجميل",
    icon: "sparkles-outline",
    description: "عناية شخصية وتجميل",
  },
  {
    id: "perfume",
    name: "عطور",
    icon: "flask-outline",
    description: "عطور ومنتجات عطرية",
  },
  {
    id: "clothing",
    name: "ألبسة",
    icon: "shirt-outline",
    description: "ملابس رجالية ونسائية وأطفال",
  },
  {
    id: "shoes",
    name: "أحذية",
    icon: "walk-outline",
    description: "أحذية وحقائب",
  },
  {
    id: "electronics",
    name: "إلكترونيات",
    icon: "phone-portrait-outline",
    description: "هواتف وإكسسوارات وأجهزة",
  },
  {
    id: "home",
    name: "منزل وأدوات",
    icon: "home-outline",
    description: "أدوات منزلية ومستلزمات",
  },
  {
    id: "hardware",
    name: "عدد وأدوات",
    icon: "hammer-outline",
    description: "أدوات ومستلزمات صيانة",
  },
  {
    id: "stationery",
    name: "قرطاسية",
    icon: "pencil-outline",
    description: "قرطاسية ومستلزمات مدرسية",
  },
  {
    id: "books",
    name: "كتب",
    icon: "book-outline",
    description: "كتب ومراجع وقراءة",
  },
  {
    id: "flowers",
    name: "ورد وهدايا",
    icon: "flower-outline",
    description: "هدايا وورود ومناسبات",
  },
  {
    id: "mobile",
    name: "موبايلات",
    icon: "call-outline",
    description: "هواتف وشرائح وإكسسوارات",
  },
  {
    id: "auto",
    name: "سيارات",
    icon: "car-outline",
    description: "زيوت وقطع وإكسسوارات",
  },
  {
    id: "laundry",
    name: "مغاسل",
    icon: "water-outline",
    description: "غسيل وكي وتنظيف",
  },
  {
    id: "pets",
    name: "مستلزمات الحيوانات",
    icon: "paw-outline",
    description: "طعام ومستلزمات الحيوانات",
  },
  {
    id: "baby",
    name: "أطفال وأمومة",
    icon: "happy-outline",
    description: "مستلزمات الأطفال والأمهات",
  },
];

/* -------------------------------------------------------------------------- */
/* المتاجر                                                                    */
/* -------------------------------------------------------------------------- */

export const stores: Store[] = [
  {
    id: "karak-market",
    name: "أسواق الكرك",
    categoryIds: ["supermarkets", "home"],
    description: "متجر شامل للمواد الغذائية والمنزلية",
    location: "الكرك الشرقي",
    rating: 4.8,
    deliveryTime: "25–40 دقيقة",
    deliveryFee: "10,000 ل.س",
    featured: true,
  },
  {
    id: "al-baraka",
    name: "ماركت البركة",
    categoryIds: ["supermarkets"],
    description: "مواد غذائية ومشروبات ومستلزمات يومية",
    location: "الكرك الشرقي",
    rating: 4.6,
    deliveryTime: "20–35 دقيقة",
    deliveryFee: "8,000 ل.س",
    featured: true,
  },
  {
    id: "green-basket",
    name: "السلة الخضراء",
    categoryIds: ["vegetables", "supermarkets"],
    description: "خضار وفواكه طازجة يومياً",
    location: "الكرك الشرقي",
    rating: 4.9,
    deliveryTime: "20–30 دقيقة",
    deliveryFee: "7,000 ل.س",
    featured: true,
  },
  {
    id: "butcher-house",
    name: "ملحمة دار الكرم",
    categoryIds: ["meat"],
    description: "لحوم ودجاج وتجهيز حسب الطلب",
    location: "الكرك الشرقي",
    rating: 4.8,
    deliveryTime: "30–45 دقيقة",
    deliveryFee: "10,000 ل.س",
    featured: true,
  },
  {
    id: "al-sham-roastery",
    name: "محامص الشام",
    categoryIds: ["roastery", "coffee"],
    description: "مكسرات وقهوة وتشكيلة تسالي",
    location: "الكرك الشرقي",
    rating: 4.7,
    deliveryTime: "20–35 دقيقة",
    deliveryFee: "8,000 ل.س",
  },
  {
    id: "karak-roastery",
    name: "محامص الكرك",
    categoryIds: ["roastery"],
    description: "قهوة عربية ومكسرات وحلويات جافة",
    location: "الكرك الشرقي",
    rating: 4.9,
    deliveryTime: "20–30 دقيقة",
    deliveryFee: "7,000 ل.س",
  },
  {
    id: "golden-bakery",
    name: "مخبز السنابل",
    categoryIds: ["bakery"],
    description: "خبز ومعجنات ومخبوزات طازجة",
    location: "الكرك الشرقي",
    rating: 4.8,
    deliveryTime: "15–25 دقيقة",
    deliveryFee: "5,000 ل.س",
    featured: true,
  },
  {
    id: "morning-cafe",
    name: "قهوة الصباح",
    categoryIds: ["coffee"],
    description: "قهوة مختصة ومشروبات ساخنة وباردة",
    location: "الكرك الشرقي",
    rating: 4.7,
    deliveryTime: "15–25 دقيقة",
    deliveryFee: "6,000 ل.س",
    featured: true,
  },
  {
    id: "fresh-juice",
    name: "عصير البلد",
    categoryIds: ["juice"],
    description: "عصائر طبيعية وحلويات",
    location: "الكرك الشرقي",
    rating: 4.8,
    deliveryTime: "15–25 دقيقة",
    deliveryFee: "6,000 ل.س",
  },
  {
    id: "taste-restaurant",
    name: "مطعم المذاق",
    categoryIds: ["restaurants"],
    description: "وجبات شرقية ومشاوي",
    location: "الكرك الشرقي",
    rating: 4.6,
    deliveryTime: "35–50 دقيقة",
    deliveryFee: "12,000 ل.س",
    featured: true,
  },
  {
    id: "health-pharmacy",
    name: "صيدلية الصحة",
    categoryIds: ["pharmacy", "baby"],
    description: "منتجات صحية وعناية شخصية",
    location: "الكرك الشرقي",
    rating: 4.8,
    deliveryTime: "20–35 دقيقة",
    deliveryFee: "7,000 ل.س",
  },
  {
    id: "beauty-house",
    name: "بيت الجمال",
    categoryIds: ["cosmetics", "perfume"],
    description: "مستحضرات تجميل وعناية وعطور",
    location: "الكرك الشرقي",
    rating: 4.7,
    deliveryTime: "25–40 دقيقة",
    deliveryFee: "8,000 ل.س",
  },
  {
    id: "elegance-perfume",
    name: "أناقة للعطور",
    categoryIds: ["perfume"],
    description: "عطور شرقية وغربية",
    location: "الكرك الشرقي",
    rating: 4.9,
    deliveryTime: "25–35 دقيقة",
    deliveryFee: "7,000 ل.س",
  },
  {
    id: "fashion-house",
    name: "دار الأناقة",
    categoryIds: ["clothing", "shoes"],
    description: "ألبسة وأحذية للعائلة",
    location: "الكرك الشرقي",
    rating: 4.5,
    deliveryTime: "30–45 دقيقة",
    deliveryFee: "10,000 ل.س",
  },
  {
    id: "smart-tech",
    name: "سمارت تك",
    categoryIds: ["electronics", "mobile"],
    description: "هواتف وإكسسوارات وأجهزة إلكترونية",
    location: "الكرك الشرقي",
    rating: 4.8,
    deliveryTime: "25–40 دقيقة",
    deliveryFee: "8,000 ل.س",
    featured: true,
  },
  {
    id: "home-center",
    name: "مركز البيت",
    categoryIds: ["home"],
    description: "أدوات منزلية ومستلزمات مطبخ",
    location: "الكرك الشرقي",
    rating: 4.6,
    deliveryTime: "30–45 دقيقة",
    deliveryFee: "10,000 ل.س",
  },
  {
    id: "tool-world",
    name: "عالم العدد",
    categoryIds: ["hardware"],
    description: "عدد وأدوات صيانة منزلية",
    location: "الكرك الشرقي",
    rating: 4.7,
    deliveryTime: "30–45 دقيقة",
    deliveryFee: "10,000 ل.س",
  },
  {
    id: "student-library",
    name: "مكتبة الطالب",
    categoryIds: ["stationery", "books"],
    description: "قرطاسية وكتب ومستلزمات مدرسية",
    location: "الكرك الشرقي",
    rating: 4.8,
    deliveryTime: "20–35 دقيقة",
    deliveryFee: "6,000 ل.س",
  },
  {
    id: "gift-garden",
    name: "حديقة الهدايا",
    categoryIds: ["flowers"],
    description: "ورود وهدايا وتنسيقات للمناسبات",
    location: "الكرك الشرقي",
    rating: 4.9,
    deliveryTime: "25–40 دقيقة",
    deliveryFee: "8,000 ل.س",
  },
  {
    id: "mobile-zone",
    name: "موبايل زون",
    categoryIds: ["mobile", "electronics"],
    description: "هواتف وشواحن وسماعات وإكسسوارات",
    location: "الكرك الشرقي",
    rating: 4.6,
    deliveryTime: "20–35 دقيقة",
    deliveryFee: "7,000 ل.س",
  },
  {
    id: "auto-care",
    name: "أوتو كير",
    categoryIds: ["auto"],
    description: "زيوت وفلاتر وإكسسوارات سيارات",
    location: "الكرك الشرقي",
    rating: 4.7,
    deliveryTime: "30–45 دقيقة",
    deliveryFee: "10,000 ل.س",
  },
  {
    id: "clean-care",
    name: "النظافة الحديثة",
    categoryIds: ["laundry"],
    description: "غسيل وكي وتنظيف الملابس",
    location: "الكرك الشرقي",
    rating: 4.8,
    deliveryTime: "حسب الموعد",
    deliveryFee: "15,000 ل.س",
  },
  {
    id: "pet-house",
    name: "بيت الحيوان",
    categoryIds: ["pets"],
    description: "طعام ومستلزمات الحيوانات الأليفة",
    location: "الكرك الشرقي",
    rating: 4.5,
    deliveryTime: "30–45 دقيقة",
    deliveryFee: "9,000 ل.س",
  },
  {
    id: "baby-world",
    name: "عالم الطفل",
    categoryIds: ["baby"],
    description: "مستلزمات الأطفال والأمهات",
    location: "الكرك الشرقي",
    rating: 4.8,
    deliveryTime: "25–40 دقيقة",
    deliveryFee: "8,000 ل.س",
  },
];

/* -------------------------------------------------------------------------- */
/* المنتجات                                                                   */
/* -------------------------------------------------------------------------- */

export const products: Product[] = [
  /* أسواق الكرك */
  {
    id: "milk-1",
    storeId: "karak-market",
    categoryId: "supermarkets",
    name: "حليب كامل الدسم",
    description: "حليب طازج كامل الدسم",
    price: 9000,
    unit: "1 لتر",
    available: true,
    popular: true,
  },
  {
    id: "sugar-1",
    storeId: "karak-market",
    categoryId: "supermarkets",
    name: "سكر أبيض",
    description: "سكر أبيض ناعم",
    price: 12000,
    unit: "1 كغ",
    available: true,
  },
  {
    id: "rice-1",
    storeId: "karak-market",
    categoryId: "supermarkets",
    name: "أرز طويل الحبة",
    description: "أرز عالي الجودة",
    price: 24000,
    unit: "1 كغ",
    available: true,
    popular: true,
  },
  {
    id: "oil-1",
    storeId: "karak-market",
    categoryId: "supermarkets",
    name: "زيت دوار الشمس",
    description: "زيت نباتي للطبخ",
    price: 28000,
    unit: "1.5 لتر",
    available: true,
  },
  {
    id: "tea-1",
    storeId: "karak-market",
    categoryId: "supermarkets",
    name: "شاي أسود",
    description: "شاي أسود فاخر",
    price: 22000,
    unit: "450 غ",
    available: true,
  },

  /* البركة */
  {
    id: "water-1",
    storeId: "al-baraka",
    categoryId: "supermarkets",
    name: "مياه معدنية",
    description: "عبوة مياه معدنية",
    price: 5000,
    unit: "1.5 لتر",
    available: true,
  },
  {
    id: "juice-1",
    storeId: "al-baraka",
    categoryId: "supermarkets",
    name: "عصير برتقال",
    description: "عصير برتقال طبيعي",
    price: 12000,
    unit: "1 لتر",
    available: true,
  },
  {
    id: "cheese-1",
    storeId: "al-baraka",
    categoryId: "supermarkets",
    name: "جبنة بيضاء",
    description: "جبنة بيضاء طرية",
    price: 32000,
    unit: "500 غ",
    available: true,
    popular: true,
  },

  /* السلة الخضراء */
  {
    id: "tomato-1",
    storeId: "green-basket",
    categoryId: "vegetables",
    name: "بندورة",
    description: "بندورة طازجة",
    price: 7000,
    unit: "1 كغ",
    available: true,
    popular: true,
  },
  {
    id: "cucumber-1",
    storeId: "green-basket",
    categoryId: "vegetables",
    name: "خيار",
    description: "خيار طازج",
    price: 8000,
    unit: "1 كغ",
    available: true,
  },
  {
    id: "potato-1",
    storeId: "green-basket",
    categoryId: "vegetables",
    name: "بطاطا",
    description: "بطاطا محلية",
    price: 9000,
    unit: "1 كغ",
    available: true,
  },
  {
    id: "apple-1",
    storeId: "green-basket",
    categoryId: "vegetables",
    name: "تفاح",
    description: "تفاح طازج",
    price: 16000,
    unit: "1 كغ",
    available: true,
    popular: true,
  },
  {
    id: "banana-1",
    storeId: "green-basket",
    categoryId: "vegetables",
    name: "موز",
    description: "موز طازج",
    price: 18000,
    unit: "1 كغ",
    available: true,
  },

  /* الملحمة */
  {
    id: "beef-1",
    storeId: "butcher-house",
    categoryId: "meat",
    name: "لحم غنم",
    description: "لحم غنم طازج",
    price: 95000,
    unit: "1 كغ",
    available: true,
    popular: true,
  },
  {
    id: "beef-2",
    storeId: "butcher-house",
    categoryId: "meat",
    name: "لحم عجل",
    description: "لحم عجل طازج",
    price: 85000,
    unit: "1 كغ",
    available: true,
  },
  {
    id: "chicken-1",
    storeId: "butcher-house",
    categoryId: "meat",
    name: "دجاج كامل",
    description: "دجاج طازج منظف",
    price: 55000,
    unit: "1 كغ",
    available: true,
  },

  /* المحامص */
  {
    id: "coffee-1",
    storeId: "al-sham-roastery",
    categoryId: "roastery",
    name: "قهوة عربية",
    description: "قهوة عربية محمصة",
    price: 35000,
    unit: "500 غ",
    available: true,
    popular: true,
  },
  {
    id: "pistachio-1",
    storeId: "al-sham-roastery",
    categoryId: "roastery",
    name: "فستق حلبي",
    description: "فستق حلبي محمص",
    price: 75000,
    unit: "500 غ",
    available: true,
  },
  {
    id: "cashew-1",
    storeId: "karak-roastery",
    categoryId: "roastery",
    name: "كاجو محمص",
    description: "كاجو فاخر محمص",
    price: 65000,
    unit: "500 غ",
    available: true,
    popular: true,
  },
  {
    id: "almond-1",
    storeId: "karak-roastery",
    categoryId: "roastery",
    name: "لوز محمص",
    description: "لوز محمص ومملح",
    price: 58000,
    unit: "500 غ",
    available: true,
  },

  /* المخبز */
  {
    id: "bread-1",
    storeId: "golden-bakery",
    categoryId: "bakery",
    name: "خبز عربي",
    description: "خبز عربي طازج",
    price: 5000,
    unit: "ربطة",
    available: true,
    popular: true,
  },
  {
    id: "croissant-1",
    storeId: "golden-bakery",
    categoryId: "bakery",
    name: "كرواسون",
    description: "كرواسون طازج",
    price: 7000,
    unit: "قطعة",
    available: true,
  },
  {
    id: "cheese-pastry-1",
    storeId: "golden-bakery",
    categoryId: "bakery",
    name: "معجنات جبنة",
    description: "معجنات محشوة بالجبنة",
    price: 9000,
    unit: "قطعة",
    available: true,
  },

  /* القهوة */
  {
    id: "latte-1",
    storeId: "morning-cafe",
    categoryId: "coffee",
    name: "لاتيه",
    description: "إسبريسو مع حليب مبخر",
    price: 18000,
    unit: "كوب",
    available: true,
    popular: true,
  },
  {
    id: "americano-1",
    storeId: "morning-cafe",
    categoryId: "coffee",
    name: "أمريكانو",
    description: "قهوة إسبريسو مع الماء",
    price: 15000,
    unit: "كوب",
    available: true,
  },
  {
    id: "mocha-1",
    storeId: "morning-cafe",
    categoryId: "coffee",
    name: "موكا",
    description: "قهوة وشوكولاتة وحليب",
    price: 20000,
    unit: "كوب",
    available: true,
  },

  /* العصائر */
  {
    id: "orange-juice-1",
    storeId: "fresh-juice",
    categoryId: "juice",
    name: "عصير برتقال طبيعي",
    description: "برتقال طازج معصور عند الطلب",
    price: 18000,
    unit: "كوب كبير",
    available: true,
    popular: true,
  },
  {
    id: "mango-juice-1",
    storeId: "fresh-juice",
    categoryId: "juice",
    name: "عصير مانغا",
    description: "مانغا طازجة",
    price: 22000,
    unit: "كوب كبير",
    available: true,
  },
  {
    id: "cheesecake-1",
    storeId: "fresh-juice",
    categoryId: "juice",
    name: "تشيز كيك",
    description: "قطعة تشيز كيك",
    price: 25000,
    unit: "قطعة",
    available: true,
  },

  /* المطعم */
  {
    id: "shawarma-1",
    storeId: "taste-restaurant",
    categoryId: "restaurants",
    name: "شاورما دجاج",
    description: "شاورما دجاج مع البطاطا",
    price: 30000,
    unit: "وجبة",
    available: true,
    popular: true,
  },
  {
    id: "mixed-grill-1",
    storeId: "taste-restaurant",
    categoryId: "restaurants",
    name: "مشاوي مشكلة",
    description: "تشكيلة مشاوي مشكلة",
    price: 85000,
    unit: "وجبة",
    available: true,
  },

  /* الصيدلية */
  {
    id: "shampoo-1",
    storeId: "health-pharmacy",
    categoryId: "pharmacy",
    name: "شامبو للشعر",
    description: "شامبو للعناية اليومية",
    price: 28000,
    unit: "عبوة",
    available: true,
  },
  {
    id: "baby-care-1",
    storeId: "health-pharmacy",
    categoryId: "baby",
    name: "مناديل أطفال",
    description: "مناديل مبللة للأطفال",
    price: 18000,
    unit: "عبوة",
    available: true,
    popular: true,
  },

  /* التجميل */
  {
    id: "cream-1",
    storeId: "beauty-house",
    categoryId: "cosmetics",
    name: "كريم مرطب",
    description: "كريم ترطيب يومي",
    price: 35000,
    unit: "عبوة",
    available: true,
  },
  {
    id: "perfume-1",
    storeId: "beauty-house",
    categoryId: "perfume",
    name: "عطر شرقي",
    description: "عطر بنفحات شرقية",
    price: 85000,
    unit: "50 مل",
    available: true,
    offer: true,
  },

  /* الألبسة */
  {
    id: "shirt-1",
    storeId: "fashion-house",
    categoryId: "clothing",
    name: "قميص رجالي",
    description: "قميص رجالي أنيق",
    price: 65000,
    unit: "قطعة",
    available: true,
  },
  {
    id: "dress-1",
    storeId: "fashion-house",
    categoryId: "clothing",
    name: "فستان نسائي",
    description: "فستان بتصميم عصري",
    price: 120000,
    unit: "قطعة",
    available: true,
    offer: true,
  },

  /* الإلكترونيات */
  {
    id: "charger-1",
    storeId: "smart-tech",
    categoryId: "electronics",
    name: "شاحن سريع",
    description: "شاحن USB-C سريع",
    price: 45000,
    unit: "قطعة",
    available: true,
    popular: true,
  },
  {
    id: "earbuds-1",
    storeId: "smart-tech",
    categoryId: "electronics",
    name: "سماعات لاسلكية",
    description: "سماعات Bluetooth",
    price: 95000,
    unit: "قطعة",
    available: true,
  },
  {
    id: "phone-1",
    storeId: "smart-tech",
    categoryId: "mobile",
    name: "هاتف ذكي",
    description: "هاتف ذكي متوسط الفئة",
    price: 1850000,
    unit: "جهاز",
    available: true,
    offer: true,
  },

  /* المنزل */
  {
    id: "pan-1",
    storeId: "home-center",
    categoryId: "home",
    name: "مقلاة غير لاصقة",
    description: "مقلاة للاستخدام اليومي",
    price: 65000,
    unit: "قطعة",
    available: true,
  },
  {
    id: "storage-1",
    storeId: "home-center",
    categoryId: "home",
    name: "علب حفظ الطعام",
    description: "مجموعة علب حفظ",
    price: 45000,
    unit: "مجموعة",
    available: true,
  },

  /* القرطاسية */
  {
    id: "notebook-1",
    storeId: "student-library",
    categoryId: "stationery",
    name: "دفتر جامعي",
    description: "دفتر مسطر عالي الجودة",
    price: 12000,
    unit: "دفتر",
    available: true,
    popular: true,
  },
  {
    id: "pens-1",
    storeId: "student-library",
    categoryId: "stationery",
    name: "أقلام حبر",
    description: "مجموعة أقلام حبر",
    price: 10000,
    unit: "5 أقلام",
    available: true,
  },
  {
    id: "book-1",
    storeId: "student-library",
    categoryId: "books",
    name: "كتاب تطوير الذات",
    description: "كتاب في تطوير المهارات الشخصية",
    price: 35000,
    unit: "كتاب",
    available: true,
  },

  /* الهدايا */
  {
    id: "flowers-1",
    storeId: "gift-garden",
    categoryId: "flowers",
    name: "باقة ورد",
    description: "باقة ورد مشكلة",
    price: 85000,
    unit: "باقة",
    available: true,
    popular: true,
  },
  {
    id: "gift-box-1",
    storeId: "gift-garden",
    categoryId: "flowers",
    name: "صندوق هدايا",
    description: "صندوق هدايا للمناسبات",
    price: 110000,
    unit: "صندوق",
    available: true,
  },

  /* السيارات */
  {
    id: "engine-oil-1",
    storeId: "auto-care",
    categoryId: "auto",
    name: "زيت محرك",
    description: "زيت محرك للسيارات",
    price: 75000,
    unit: "4 لتر",
    available: true,
  },
  {
    id: "air-filter-1",
    storeId: "auto-care",
    categoryId: "auto",
    name: "فلتر هواء",
    description: "فلتر هواء للسيارة",
    price: 35000,
    unit: "قطعة",
    available: true,
  },

  /* الحيوانات */
  {
    id: "pet-food-1",
    storeId: "pet-house",
    categoryId: "pets",
    name: "طعام قطط",
    description: "طعام جاف للقطط",
    price: 55000,
    unit: "2 كغ",
    available: true,
  },

  /* الأطفال */
  {
    id: "diapers-1",
    storeId: "baby-world",
    categoryId: "baby",
    name: "حفاضات أطفال",
    description: "حفاضات ناعمة للاستخدام اليومي",
    price: 65000,
    unit: "عبوة",
    available: true,
    popular: true,
  },
];
