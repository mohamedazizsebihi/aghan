import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { slugify } from "../src/lib/utils";

type SeedDish = {
  name: string;
  description: string;
  ingredients: string;
  allergens: string;
  price: number;
  spiceLevel: "NONE" | "MILD" | "MEDIUM" | "HOT";
  imageUrl: string | null;
  isPopular?: boolean;
};

// Sourced from Afghania's public dinner menu (https://www.afghaniadc.com/menu-1).
// Dishes with multiple protein choices on the real menu (e.g. "Lawaan" in Veal
// or Chicken) are modeled as separate dishes, since a Dish here has one price.
// Photos are intentionally left blank (imageUrl: null) until real dish photos
// are taken.
const categories: { name: string; sortOrder: number; dishes: SeedDish[] }[] =
  [
    {
      name: "Chef's Specials",
      sortOrder: 0,
      dishes: [
        {
          name: "Dinner for Two with House Red Wine",
          description:
            "A shared feast featuring assorted dumplings (leek & scallion, pumpkin, and beef), slow-cooked chicken thighs in a yogurt-based spinach stew with saffron basmati, and Afghanistan's classic Qabuli Palou (lamb shank) with pistachios and eggplant. Finished with rosewater pudding and baklava, and a bottle of house red wine.",
          ingredients:
            "Assorted dumplings, chicken thighs, spinach yogurt stew, saffron basmati rice, lamb shank qabuli palou, pistachios, eggplant, rosewater pudding, baklava, house red wine",
          allergens: "Gluten, Dairy, Nuts",
          price: 9900,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Dinner for Two with House White Wine",
          description:
            "A shared feast featuring assorted dumplings (leek & scallion, pumpkin, and beef), slow-cooked chicken thighs in a yogurt-based spinach stew with saffron basmati, and Afghanistan's classic Qabuli Palou (lamb shank) with pistachios and eggplant. Finished with rosewater pudding and baklava, and a bottle of house white wine.",
          ingredients:
            "Assorted dumplings, chicken thighs, spinach yogurt stew, saffron basmati rice, lamb shank qabuli palou, pistachios, eggplant, rosewater pudding, baklava, house white wine",
          allergens: "Gluten, Dairy, Nuts",
          price: 9900,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Family Feast for 4",
          description:
            "A generous spread to share: an assortment of dumplings, chicken simmered in a yogurt stew with greens, lamb shank braised in a tomato-based garam masala stew, grilled mushroom kabobs, and Afghan-style chapli kabobs. Finished with rosewater pudding, saffron rice pudding, and baklava.",
          ingredients:
            "Assorted dumplings, chicken yogurt stew, greens, braised lamb shank, garam masala tomato stew, grilled mushroom kabobs, chapli kabobs, rosewater pudding, saffron rice pudding, baklava",
          allergens: "Gluten, Dairy, Nuts",
          price: 12900,
          spiceLevel: "MEDIUM",
          imageUrl: null,
          isPopular: true,
        },
        {
          name: "Family Feast for 4 with House Red Wine",
          description:
            "A generous spread to share: an assortment of dumplings, chicken simmered in a yogurt stew with greens, lamb shank braised in a tomato-based garam masala stew, grilled mushroom kabobs, and Afghan-style chapli kabobs. Finished with rosewater pudding, saffron rice pudding, and baklava, and a bottle of house red wine.",
          ingredients:
            "Assorted dumplings, chicken yogurt stew, greens, braised lamb shank, garam masala tomato stew, grilled mushroom kabobs, chapli kabobs, rosewater pudding, saffron rice pudding, baklava, house red wine",
          allergens: "Gluten, Dairy, Nuts",
          price: 13900,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
      ],
    },
    {
      name: "Mazza (Appetizers)",
      sortOrder: 1,
      dishes: [
        {
          name: "Baadenjaan or Kadoo Bouranee",
          description:
            "Choice of roasted eggplant or butternut squash, topped with garlic yogurt, dried mint & cayenne.",
          ingredients:
            "Roasted eggplant or butternut squash, garlic yogurt, dried mint, cayenne",
          allergens: "Dairy, Gluten-free",
          price: 1400,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Potato & Leek Turnovers",
          description:
            "Stuffed with potatoes & leeks, pan-fried until crisp, with a side of avocado chutney.",
          ingredients: "Potatoes, leeks, pastry dough, avocado chutney",
          allergens: "Gluten",
          price: 1400,
          spiceLevel: "NONE",
          imageUrl: null,
        },
        {
          name: "Sambosa",
          description:
            "Stuffed with minced beef & lentils, pan-fried until crisp, topped off with powdered sugar & ground cardamom.",
          ingredients:
            "Minced beef, lentils, pastry dough, powdered sugar, cardamom",
          allergens: "Gluten",
          price: 1500,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Quroti",
          description:
            "Toasted Afghan bread, topped with minced beef & lentils, walnuts, and fried onions. Finished with a warm yogurt garlic puree, dried mint & cayenne.",
          ingredients:
            "Toasted Afghan bread, minced beef, lentils, walnuts, fried onions, garlic yogurt, dried mint, cayenne",
          allergens: "Gluten, Dairy, Nuts",
          price: 1400,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Carrot Slaw",
          description: "Sweet julienne carrots tossed with fresh citrus.",
          ingredients: "Julienne carrots, fresh citrus",
          allergens: "Gluten-free",
          price: 1200,
          spiceLevel: "NONE",
          imageUrl: null,
        },
        {
          name: "Samarooq Turnovers",
          description: "Stuffed with mushrooms, pan-fried until crisp.",
          ingredients: "Mushrooms, pastry dough",
          allergens: "Vegan, Gluten",
          price: 1400,
          spiceLevel: "NONE",
          imageUrl: null,
        },
      ],
    },
    {
      name: "Dumplings",
      sortOrder: 2,
      dishes: [
        {
          name: "Assortment of Dumplings (For 2)",
          description:
            "Assortment of leek & scallion, pumpkin, and spicy beef dumplings.",
          ingredients:
            "Leek & scallion dumplings, pumpkin dumplings, spicy beef dumplings",
          allergens: "Gluten, Dairy",
          price: 1800,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Assortment of Dumplings (For 3)",
          description:
            "Assortment of leek & scallion, pumpkin, and spicy beef dumplings.",
          ingredients:
            "Leek & scallion dumplings, pumpkin dumplings, spicy beef dumplings",
          allergens: "Gluten, Dairy",
          price: 2200,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Assortment of Dumplings (For 4)",
          description:
            "Assortment of leek & scallion, pumpkin, and spicy beef dumplings.",
          ingredients:
            "Leek & scallion dumplings, pumpkin dumplings, spicy beef dumplings",
          allergens: "Gluten, Dairy",
          price: 2600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Pumpkin Dumplings",
          description:
            "Steamed and stuffed with pumpkin, topped with garlic yogurt, dried mint, & cayenne.",
          ingredients:
            "Steamed dumplings, pumpkin, garlic yogurt, dried mint, cayenne",
          allergens: "Vegetarian, Gluten, Dairy",
          price: 1600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Leek & Scallion Dumplings (Aushak)",
          description:
            "Steamed & stuffed with leeks & scallions, topped with minced beef & lentil qorma, garlic yogurt, dried mint & cayenne.",
          ingredients:
            "Steamed dumplings, leeks, scallions, minced beef & lentil qorma, garlic yogurt, dried mint, cayenne",
          allergens: "Gluten, Dairy",
          price: 1600,
          spiceLevel: "MILD",
          imageUrl: null,
          isPopular: true,
        },
        {
          name: "Spicy Beef Dumplings (Mantu)",
          description:
            "Steamed & stuffed with spicy beef, topped with carrots & peas qorma, garlic yogurt, dried mint, & cayenne.",
          ingredients:
            "Steamed dumplings, spicy beef, carrots & peas qorma, garlic yogurt, dried mint, cayenne",
          allergens: "Gluten, Dairy",
          price: 1600,
          spiceLevel: "MEDIUM",
          imageUrl: null,
          isPopular: true,
        },
        {
          name: "Samarooq Dumplings",
          description:
            "Steamed and stuffed with mushrooms, topped with a spicy bean medley qorma, garlic non-dairy yogurt, dried mint, and cayenne.",
          ingredients:
            "Steamed dumplings, mushrooms, spicy bean medley qorma, garlic non-dairy yogurt, dried mint, cayenne",
          allergens: "Vegan, Gluten",
          price: 1600,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
      ],
    },
    {
      name: "Grilled Meats to Start",
      sortOrder: 3,
      dishes: [
        {
          name: "Lamb Shoulder Skewer (Starter)",
          description:
            "Marinated in our house spices, charbroiled to perfection, served with cucumber & dill yogurt.",
          ingredients: "Lamb shoulder, house spices, cucumber & dill yogurt",
          allergens: "Dairy, Gluten-free",
          price: 1700,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Afghania Signature Mix Grill Mazza",
          description:
            "Marinated & charbroiled lamb shoulder, rib chops, lamb & beef tenderloin, served with fresh herb chutney.",
          ingredients:
            "Lamb shoulder, lamb rib chops, lamb tenderloin, beef tenderloin, fresh herb chutney",
          allergens: "Gluten-free",
          price: 3000,
          spiceLevel: "MILD",
          imageUrl: null,
          isPopular: true,
        },
        {
          name: "Lamb Tenderloin Skewer (Starter)",
          description:
            "Marinated in our house spices, charbroiled to perfection, served with cucumber & dill yogurt.",
          ingredients: "Lamb tenderloin, house spices, cucumber & dill yogurt",
          allergens: "Dairy, Gluten-free",
          price: 1700,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Seekh Kabob",
          description:
            "Ground beef marinated in our house spices, charbroiled to perfection, served with cucumber & dill yogurt.",
          ingredients: "Ground beef, house spices, cucumber & dill yogurt",
          allergens: "Dairy, Gluten-free",
          price: 1500,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Beef Tenderloin Skewer (Starter)",
          description:
            "Marinated in our house spices, charbroiled to perfection, served with cucumber & dill yogurt.",
          ingredients: "Beef tenderloin, house spices, cucumber & dill yogurt",
          allergens: "Dairy, Gluten-free",
          price: 1600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
      ],
    },
    {
      name: "Soups & Salads",
      sortOrder: 4,
      dishes: [
        {
          name: "Aush",
          description:
            "Classical noodle soup with chickpeas, kidney beans, minced beef, topped with yogurt, dried mint, and cayenne pepper.",
          ingredients:
            "Noodles, chickpeas, kidney beans, minced beef, yogurt, dried mint, cayenne",
          allergens: "Gluten, Dairy",
          price: 1400,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Omache",
          description:
            "Traditional vegetable soup prepared with oats, tomatoes, spinach, kidney beans and chickpeas. Topped with dried mint and cayenne pepper.",
          ingredients:
            "Oats, tomatoes, spinach, kidney beans, chickpeas, dried mint, cayenne",
          allergens: "Vegetarian, Gluten-free",
          price: 1400,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Afghania Salad",
          description:
            "Mixed greens, bell peppers, tomatoes, croutons, walnuts and dates tossed with our house made balsamic vinaigrette.",
          ingredients:
            "Mixed greens, bell peppers, tomatoes, croutons, walnuts, dates, balsamic vinaigrette",
          allergens: "Gluten, Nuts",
          price: 1300,
          spiceLevel: "NONE",
          imageUrl: null,
        },
      ],
    },
    {
      name: "Chops & Kabobs",
      sortOrder: 5,
      dishes: [
        {
          name: "Lamb Tenderloin",
          description:
            "Served with seasoned basmati rice, topped with julienne carrots & raisins, with a side of baadenjaan.",
          ingredients:
            "Lamb tenderloin, seasoned basmati rice, julienne carrots, raisins, baadenjaan (roasted eggplant)",
          allergens: "Gluten-free",
          price: 3800,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Beef Tenderloin",
          description:
            "Served with seasoned basmati rice, with a side of nakhoud.",
          ingredients:
            "Beef tenderloin, seasoned basmati rice, nakhoud (chickpeas)",
          allergens: "Gluten-free",
          price: 3400,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Frenched Rack of Lamb (Chopaan)",
          description:
            "Rib chops, served with seasoned basmati rice, with a side of nakhoud.",
          ingredients:
            "Lamb rib chops, seasoned basmati rice, nakhoud (chickpeas)",
          allergens: "Gluten-free",
          price: 3800,
          spiceLevel: "MILD",
          imageUrl: null,
          isPopular: true,
        },
        {
          name: "Beef Tenderloin & Chicken",
          description:
            "Served with a combination of both palou & chalou, with a side of nakhoud.",
          ingredients:
            "Beef tenderloin, chicken, palou rice, chalou rice, nakhoud (chickpeas)",
          allergens: "Gluten-free",
          price: 3200,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Lamb Shoulder Chops",
          description:
            "Served with seasoned basmati rice, topped with julienne carrots & raisins, with a side of baadenjaan.",
          ingredients:
            "Lamb shoulder chops, seasoned basmati rice, julienne carrots, raisins, baadenjaan",
          allergens: "Gluten-free",
          price: 3700,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Ground Beef (Seekh)",
          description:
            "Served with saffron & cumin infused basmati rice, with a side of nakhoud.",
          ingredients:
            "Ground beef, saffron & cumin basmati rice, nakhoud (chickpeas)",
          allergens: "Gluten-free",
          price: 2600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Lamb Chop Duo",
          description:
            "Rib & shoulder chops, served with seasoned basmati rice topped with julienne carrots & raisins, with a side of baadenjaan.",
          ingredients:
            "Lamb rib chops, lamb shoulder chops, seasoned basmati rice, julienne carrots, raisins, baadenjaan",
          allergens: "Gluten-free",
          price: 3700,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Chicken & Ground Beef",
          description:
            "Served with a combination of both palou & chalou, with a side of nakhoud.",
          ingredients:
            "Chicken, ground beef, palou rice, chalou rice, nakhoud (chickpeas)",
          allergens: "Gluten-free",
          price: 2600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Afghania Lamb Platter",
          description:
            "Shoulder chops, rib chops, and tenderloin, served with seasoned basmati rice topped with julienne carrots & raisins, with a side of baadenjaan.",
          ingredients:
            "Lamb shoulder chops, lamb rib chops, lamb tenderloin, seasoned basmati rice, julienne carrots, raisins, baadenjaan",
          allergens: "Gluten-free",
          price: 5000,
          spiceLevel: "MILD",
          imageUrl: null,
          isPopular: true,
        },
        {
          name: "Boneless Juicy Chicken Thigh",
          description:
            "Served with saffron & cumin infused basmati rice, with a side of nakhoud.",
          ingredients:
            "Chicken thigh, saffron & cumin basmati rice, nakhoud (chickpeas)",
          allergens: "Gluten-free",
          price: 2600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Afghania Signature Lamb Chops & Beef Tenderloin",
          description:
            "Rib chops and beef tenderloin, served with qabuli rice, with a side of kadoo.",
          ingredients:
            "Lamb rib chops, beef tenderloin, qabuli rice, kadoo (butternut squash)",
          allergens: "Gluten-free",
          price: 4300,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Chicken Breast",
          description:
            "Served with saffron & cumin infused basmati rice, with a side of nakhoud.",
          ingredients:
            "Chicken breast, saffron & cumin basmati rice, nakhoud (chickpeas)",
          allergens: "Gluten-free",
          price: 2600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Salmon",
          description:
            "Served with saffron and cumin infused basmati rice, with a side of sabzi topped with fresh dill.",
          ingredients:
            "Salmon, saffron & cumin basmati rice, sabzi (greens), fresh dill",
          allergens: "Gluten-free",
          price: 3000,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Lamb & Beef Tenderloin",
          description:
            "Served with seasoned basmati rice, topped with julienne carrots & raisins, with a side of baadenjaan.",
          ingredients:
            "Lamb tenderloin, beef tenderloin, seasoned basmati rice, julienne carrots, raisins, baadenjaan",
          allergens: "Gluten-free",
          price: 3600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Chapli Kabob",
          description:
            "Authentic frontier dish made of ground beef marinated with spices, tomatoes, onions, shaped in the form of a patty and lightly fried.",
          ingredients: "Ground beef, house spices, tomatoes, onions",
          allergens: "",
          price: 2600,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Ribeye Kabob",
          description:
            "Beef ribeye kabob marinated overnight served with qabuli rice and a side of baadenjaan.",
          ingredients: "Beef ribeye, qabuli rice, baadenjaan (roasted eggplant)",
          allergens: "Gluten-free",
          price: 3800,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Afghania Burger",
          description:
            "Authentic frontier dish made of ground beef marinated with spices, tomatoes, onions, shaped in the form of a patty and lightly fried on a brioche bun with herb chutney, pickled onions and a side of nakhoud.",
          ingredients:
            "Ground beef patty, brioche bun, herb chutney, pickled onions, nakhoud (chickpeas)",
          allergens: "Gluten",
          price: 2200,
          spiceLevel: "MILD",
          imageUrl: null,
        },
      ],
    },
    {
      name: "Qormas & Entrees",
      sortOrder: 6,
      dishes: [
        {
          name: "Lawaan – Veal",
          description:
            "Slow cooked in a garlic yogurt based stew, topped with cilantro, and served with saffron infused basmati rice.",
          ingredients:
            "Veal, garlic yogurt stew, cilantro, saffron basmati rice",
          allergens: "Dairy, Gluten-free",
          price: 3800,
          spiceLevel: "MILD",
          imageUrl: "/images/dishes/lawaan.png",
        },
        {
          name: "Lawaan – Chicken",
          description:
            "Slow cooked in a garlic yogurt based stew, topped with cilantro, and served with saffron infused basmati rice.",
          ingredients:
            "Chicken, garlic yogurt stew, cilantro, saffron basmati rice",
          allergens: "Dairy, Gluten-free",
          price: 2800,
          spiceLevel: "MILD",
          imageUrl: "/images/dishes/lawaan.png",
        },
        {
          name: "Afghania Palou – Lamb Shank",
          description:
            "Our signature smoked bone-in shank served with seasoned basmati rice topped with julienne carrots, raisins, and crushed pistachios, accompanied with baadenjaan.",
          ingredients:
            "Smoked lamb shank, seasoned basmati rice, julienne carrots, raisins, pistachios, baadenjaan",
          allergens: "Nuts, Gluten-free",
          price: 3600,
          spiceLevel: "MILD",
          imageUrl: "/images/dishes/afghania-palou.png",
          isPopular: true,
        },
        {
          name: "Afghania Palou – Lamb Leg",
          description:
            "Our signature smoked bone-in leg served with seasoned basmati rice topped with julienne carrots, raisins, and crushed pistachios, accompanied with baadenjaan.",
          ingredients:
            "Smoked lamb leg, seasoned basmati rice, julienne carrots, raisins, pistachios, baadenjaan",
          allergens: "Nuts, Gluten-free",
          price: 3600,
          spiceLevel: "MILD",
          imageUrl: "/images/dishes/afghania-palou.png",
        },
        {
          name: "Afghania Palou – Veal Shank",
          description:
            "Our signature smoked bone-in veal shank served with seasoned basmati rice topped with julienne carrots, raisins, and crushed pistachios, accompanied with baadenjaan.",
          ingredients:
            "Smoked veal shank, seasoned basmati rice, julienne carrots, raisins, pistachios, baadenjaan",
          allergens: "Nuts, Gluten-free",
          price: 3800,
          spiceLevel: "MILD",
          imageUrl: "/images/dishes/afghania-palou.png",
        },
        {
          name: "Sabzi Lawaan – Veal",
          description:
            "Sabzi (greens) slow cooked in a garlic yogurt based stew, topped with cilantro, and served with saffron infused basmati rice.",
          ingredients:
            "Veal, sabzi (greens), garlic yogurt stew, cilantro, saffron basmati rice",
          allergens: "Dairy, Gluten-free",
          price: 3600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Sabzi Lawaan – Chicken",
          description:
            "Sabzi (greens) slow cooked in a garlic yogurt based stew, topped with cilantro, and served with saffron infused basmati rice.",
          ingredients:
            "Chicken, sabzi (greens), garlic yogurt stew, cilantro, saffron basmati rice",
          allergens: "Dairy, Gluten-free",
          price: 2800,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Braised Lamb & Greens – Lamb Shank",
          description:
            "Braised bone-in shank, served with slow cooked spinach, kale, mustard greens, collard greens, turnip leaves, dill & cilantro, accompanied with saffron infused basmati rice.",
          ingredients:
            "Braised lamb shank, spinach, kale, mustard greens, collard greens, turnip leaves, dill, cilantro, saffron basmati rice",
          allergens: "Gluten-free",
          price: 3600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Braised Lamb & Greens – Lamb Leg",
          description:
            "Braised bone-in leg, served with slow cooked spinach, kale, mustard greens, collard greens, turnip leaves, dill & cilantro, accompanied with saffron infused basmati rice.",
          ingredients:
            "Braised lamb leg, spinach, kale, mustard greens, collard greens, turnip leaves, dill, cilantro, saffron basmati rice",
          allergens: "Gluten-free",
          price: 3600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Braised Lamb & Greens – Veal Shank",
          description:
            "Braised bone-in veal shank, served with slow cooked spinach, kale, mustard greens, collard greens, turnip leaves, dill & cilantro, accompanied with saffron infused basmati rice.",
          ingredients:
            "Braised veal shank, spinach, kale, mustard greens, collard greens, turnip leaves, dill, cilantro, saffron basmati rice",
          allergens: "Gluten-free",
          price: 3800,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Qorma Afghania – Veal",
          description:
            "Spicy tomato based stew with eggplant. Infused with garlic & yogurt, topped with cilantro, and served with saffron infused basmati rice.",
          ingredients:
            "Veal, spicy tomato stew, eggplant, garlic yogurt, cilantro, saffron basmati rice",
          allergens: "Dairy, Gluten-free",
          price: 3800,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Qorma Afghania – Lamb Leg",
          description:
            "Spicy tomato based stew with eggplant. Infused with garlic & yogurt, topped with cilantro, and served with saffron infused basmati rice.",
          ingredients:
            "Lamb leg, spicy tomato stew, eggplant, garlic yogurt, cilantro, saffron basmati rice",
          allergens: "Dairy, Gluten-free",
          price: 3600,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Qorma Afghania – Chicken",
          description:
            "Spicy tomato based stew with eggplant. Infused with garlic & yogurt, topped with cilantro, and served with saffron infused basmati rice.",
          ingredients:
            "Chicken, spicy tomato stew, eggplant, garlic yogurt, cilantro, saffron basmati rice",
          allergens: "Dairy, Gluten-free",
          price: 2800,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Ghorbandee – Lamb Shank",
          description:
            "Slow cooked short grain rice, chickpeas, kidney beans served with qorma cooked in a spicy tomato based stew. Topped with fried onions, yogurt garlic drizzle, dried mint, and cayenne pepper.",
          ingredients:
            "Lamb shank, short grain rice, chickpeas, kidney beans, spicy tomato stew, fried onions, yogurt garlic drizzle, dried mint, cayenne",
          allergens: "Dairy, Gluten-free",
          price: 3600,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Ghorbandee – Lamb Leg",
          description:
            "Slow cooked short grain rice, chickpeas, kidney beans served with qorma cooked in a spicy tomato based stew. Topped with fried onions, yogurt garlic drizzle, dried mint, and cayenne pepper.",
          ingredients:
            "Lamb leg, short grain rice, chickpeas, kidney beans, spicy tomato stew, fried onions, yogurt garlic drizzle, dried mint, cayenne",
          allergens: "Dairy, Gluten-free",
          price: 3600,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Ghorbandee – Veal Shank",
          description:
            "Slow cooked short grain rice, chickpeas, kidney beans served with qorma cooked in a spicy tomato based stew. Topped with fried onions, yogurt garlic drizzle, dried mint, and cayenne pepper.",
          ingredients:
            "Veal shank, short grain rice, chickpeas, kidney beans, spicy tomato stew, fried onions, yogurt garlic drizzle, dried mint, cayenne",
          allergens: "Dairy, Gluten-free",
          price: 3800,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Rumi's – Veal",
          description:
            "Sweet & spicy tomato based stew infused with garlic, topped with cilantro, served with saffron infused basmati rice.",
          ingredients:
            "Veal, sweet & spicy tomato stew, garlic, cilantro, saffron basmati rice",
          allergens: "Gluten-free",
          price: 3800,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Rumi's – Lamb Leg",
          description:
            "Sweet & spicy tomato based stew infused with garlic, topped with cilantro, served with saffron infused basmati rice.",
          ingredients:
            "Lamb leg, sweet & spicy tomato stew, garlic, cilantro, saffron basmati rice",
          allergens: "Gluten-free",
          price: 3600,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Rumi's – Chicken",
          description:
            "Sweet & spicy tomato based stew infused with garlic, topped with cilantro, served with saffron infused basmati rice.",
          ingredients:
            "Chicken, sweet & spicy tomato stew, garlic, cilantro, saffron basmati rice",
          allergens: "Gluten-free",
          price: 2800,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Dopiaza – Chicken",
          description:
            "Traditional meat stew slow cooked with split peas, served over bread and topped with pickled onions.",
          ingredients: "Chicken, split peas stew, bread, pickled onions",
          allergens: "Gluten",
          price: 2800,
          spiceLevel: "MILD",
          imageUrl: "/images/dishes/dopiaza.png",
        },
        {
          name: "Dopiaza – Lamb Leg",
          description:
            "Traditional meat stew slow cooked with split peas, served over bread and topped with pickled onions.",
          ingredients: "Lamb leg, split peas stew, bread, pickled onions",
          allergens: "Gluten",
          price: 3600,
          spiceLevel: "MILD",
          imageUrl: "/images/dishes/dopiaza.png",
        },
        {
          name: "Dopiaza – Veal",
          description:
            "Traditional meat stew slow cooked with split peas, served over bread and topped with pickled onions.",
          ingredients: "Veal, split peas stew, bread, pickled onions",
          allergens: "Gluten",
          price: 3800,
          spiceLevel: "MILD",
          imageUrl: "/images/dishes/dopiaza.png",
        },
        {
          name: "Moghuli – Veal",
          description:
            "Spicy tomato based and eggplant infused with garam masala, topped with cilantro, and served with saffron infused basmati rice.",
          ingredients:
            "Veal, spicy tomato stew, eggplant, garam masala, cilantro, saffron basmati rice",
          allergens: "Gluten-free",
          price: 3800,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Moghuli – Lamb Shank",
          description:
            "Spicy tomato based and eggplant infused with garam masala, topped with cilantro, and served with saffron infused basmati rice.",
          ingredients:
            "Lamb shank, spicy tomato stew, eggplant, garam masala, cilantro, saffron basmati rice",
          allergens: "Gluten-free",
          price: 3600,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Moghuli – Chicken",
          description:
            "Spicy tomato based and eggplant infused with garam masala, topped with cilantro, and served with saffron infused basmati rice.",
          ingredients:
            "Chicken, spicy tomato stew, eggplant, garam masala, cilantro, saffron basmati rice",
          allergens: "Gluten-free",
          price: 2800,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Spicy Shinwari Karahi – Chicken",
          description:
            "Smoked and slow cooked in a spicy tomato qorma infused with garam masala, ginger, fresh tomatoes, and topped with cilantro. Served with pickled onions over toasted Afghan bread.",
          ingredients:
            "Chicken, spicy tomato qorma, garam masala, ginger, fresh tomatoes, cilantro, pickled onions, toasted Afghan bread",
          allergens: "Gluten",
          price: 2800,
          spiceLevel: "HOT",
          imageUrl: null,
        },
        {
          name: "Spicy Shinwari Karahi – Lamb Shank",
          description:
            "Smoked and slow cooked in a spicy tomato qorma infused with garam masala, ginger, fresh tomatoes, and topped with cilantro. Served with pickled onions over toasted Afghan bread.",
          ingredients:
            "Lamb shank, spicy tomato qorma, garam masala, ginger, fresh tomatoes, cilantro, pickled onions, toasted Afghan bread",
          allergens: "Gluten",
          price: 3600,
          spiceLevel: "HOT",
          imageUrl: null,
        },
        {
          name: "Spicy Shinwari Karahi – Lamb Shoulder",
          description:
            "Smoked and slow cooked in a spicy tomato qorma infused with garam masala, ginger, fresh tomatoes, and topped with cilantro. Served with pickled onions over toasted Afghan bread.",
          ingredients:
            "Lamb shoulder, spicy tomato qorma, garam masala, ginger, fresh tomatoes, cilantro, pickled onions, toasted Afghan bread",
          allergens: "Gluten",
          price: 3800,
          spiceLevel: "HOT",
          imageUrl: null,
        },
        {
          name: "Spicy Shinwari Karahi – Veal Shank",
          description:
            "Smoked and slow cooked in a spicy tomato qorma infused with garam masala, ginger, fresh tomatoes, and topped with cilantro. Served with pickled onions over toasted Afghan bread.",
          ingredients:
            "Veal shank, spicy tomato qorma, garam masala, ginger, fresh tomatoes, cilantro, pickled onions, toasted Afghan bread",
          allergens: "Gluten",
          price: 3800,
          spiceLevel: "HOT",
          imageUrl: null,
        },
        {
          name: "Risotto & Lamb (Sholah) – Lamb Shank",
          description:
            "Braised bone-in shank served over top of mildly spiced slow cooked short grain rice infused with fresh herbs and bean medley.",
          ingredients:
            "Braised lamb shank, short grain rice, fresh herbs, bean medley",
          allergens: "Gluten-free",
          price: 3600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Risotto & Lamb (Sholah) – Lamb Leg",
          description:
            "Braised bone-in leg served over top of mildly spiced slow cooked short grain rice infused with fresh herbs and bean medley.",
          ingredients:
            "Braised lamb leg, short grain rice, fresh herbs, bean medley",
          allergens: "Gluten-free",
          price: 3600,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Risotto & Lamb (Sholah) – Veal Shank",
          description:
            "Braised bone-in veal shank served over top of mildly spiced slow cooked short grain rice infused with fresh herbs and bean medley.",
          ingredients:
            "Braised veal shank, short grain rice, fresh herbs, bean medley",
          allergens: "Gluten-free",
          price: 3800,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Shorwa Watanee – Chicken",
          description:
            "Traditional soup with slow cooked beans, carrots, potatoes, and cilantro over top of Afghan bread. Served with pickled onions.",
          ingredients:
            "Chicken, slow cooked beans, carrots, potatoes, cilantro, Afghan bread, pickled onions",
          allergens: "Gluten",
          price: 2800,
          spiceLevel: "MILD",
          imageUrl: "/images/dishes/shorwa-watanee.png",
        },
        {
          name: "Shorwa Watanee – Lamb Shank",
          description:
            "Traditional soup with slow cooked beans, carrots, potatoes, and cilantro over top of Afghan bread. Served with pickled onions.",
          ingredients:
            "Lamb shank, slow cooked beans, carrots, potatoes, cilantro, Afghan bread, pickled onions",
          allergens: "Gluten",
          price: 3600,
          spiceLevel: "MILD",
          imageUrl: "/images/dishes/shorwa-watanee.png",
        },
        {
          name: "Shorwa Watanee – Veal",
          description:
            "Traditional soup with slow cooked beans, carrots, potatoes, and cilantro over top of Afghan bread. Served with pickled onions.",
          ingredients:
            "Veal, slow cooked beans, carrots, potatoes, cilantro, Afghan bread, pickled onions",
          allergens: "Gluten",
          price: 3800,
          spiceLevel: "MILD",
          imageUrl: "/images/dishes/shorwa-watanee.png",
        },
      ],
    },
    {
      name: "Vegetarian & Vegan",
      sortOrder: 7,
      dishes: [
        {
          name: "Nakhoud Chalou",
          description:
            "Spicy tomato-based chickpea stew slow cooked with cinnamon and garam masala, topped with cilantro, served with a side of saffron infused basmati rice.",
          ingredients:
            "Chickpeas, spicy tomato stew, cinnamon, garam masala, cilantro, saffron basmati rice",
          allergens: "Vegetarian, Vegan",
          price: 2000,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Kandahari Vegetarian Flight",
          description:
            "Seasoned basmati rice with julienne carrots and raisins served with baadenjaan (roasted eggplant), bamya (okra), daal (lentils), kadoo (butternut squash), sabzi (greens), and nakhoud (chickpeas).",
          ingredients:
            "Seasoned basmati rice, julienne carrots, raisins, baadenjaan, bamya, daal, kadoo, sabzi, nakhoud",
          allergens: "Vegetarian, Vegan",
          price: 2900,
          spiceLevel: "MILD",
          imageUrl: null,
          isPopular: true,
        },
        {
          name: "Baadenjaan Chalou",
          description:
            "Roasted eggplant bouranee topped with garlic yogurt, dried mint & cayenne, with a side of saffron infused basmati rice.",
          ingredients:
            "Roasted eggplant, garlic yogurt, dried mint, cayenne, saffron basmati rice",
          allergens: "Vegetarian, Vegan",
          price: 2200,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Kadoo Chalou",
          description:
            "Roasted butternut squash topped with garlic yogurt, dried mint & cayenne, with a side of saffron infused basmati rice.",
          ingredients:
            "Roasted butternut squash, garlic yogurt, dried mint, cayenne, saffron basmati rice",
          allergens: "Vegan",
          price: 2200,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Sabzi Chalou",
          description:
            "Slow cooked spinach, kale, mustard greens, collard greens, turnip leaves, dill & cilantro, with a side of saffron infused basmati rice.",
          ingredients:
            "Spinach, kale, mustard greens, collard greens, turnip leaves, dill, cilantro, saffron basmati rice",
          allergens: "Vegetarian, Vegan",
          price: 2200,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Bamya Chalou",
          description:
            "Okra slow cooked in a tomato based stew topped with cilantro. Served with saffron infused basmati rice.",
          ingredients: "Okra, tomato stew, cilantro, saffron basmati rice",
          allergens: "Vegetarian, Vegan",
          price: 2200,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Sabzi Lawaan (Vegan)",
          description:
            "Slow cooked sabzi (greens) in a garlic non-dairy yogurt based stew topped with cilantro. Served with saffron infused basmati rice.",
          ingredients:
            "Sabzi (greens), garlic non-dairy yogurt stew, cilantro, saffron basmati rice",
          allergens: "Vegetarian, Vegan",
          price: 2300,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Baadenjaan Moghuli",
          description:
            "Spicy tomato based eggplant stew infused with garam masala and topped with cilantro. Served with saffron infused basmati rice.",
          ingredients:
            "Eggplant, spicy tomato stew, garam masala, cilantro, saffron basmati rice",
          allergens: "Vegetarian, Vegan",
          price: 2400,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Nakhoud & Mushroom Sabzi Lawaan",
          description:
            "Spicy tomato chickpeas, mushrooms, and sabzi (greens) all slow cooked together in a garlic yogurt based stew, topped with cilantro. Served with saffron infused basmati rice.",
          ingredients:
            "Chickpeas, mushrooms, sabzi (greens), garlic yogurt stew, cilantro, saffron basmati rice",
          allergens: "Vegetarian, Vegan",
          price: 2500,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Baadenjaan Rumi",
          description:
            "Sweet and spicy tomato based stew with eggplant and fresh garlic, topped with cilantro, and served over saffron infused basmati rice.",
          ingredients:
            "Eggplant, sweet & spicy tomato stew, garlic, cilantro, saffron basmati rice",
          allergens: "Vegetarian, Vegan",
          price: 2400,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Spicy Risotto with Eggplant & Butternut Squash",
          description:
            "Risotto with chickpeas, lentils, and mung beans topped with dill, sides of both eggplant & butternut squash bouranee topped with garlic yogurt, dried mint & cayenne.",
          ingredients:
            "Risotto, chickpeas, lentils, mung beans, dill, eggplant bouranee, butternut squash bouranee, garlic yogurt, dried mint, cayenne",
          allergens: "Vegetarian, Vegan",
          price: 2500,
          spiceLevel: "MEDIUM",
          imageUrl: null,
        },
        {
          name: "Kabob-E-Samarooq",
          description:
            "Portobello mushrooms marinated in our house spices and grilled to perfection. Served with basmati rice, grilled onion, tomatoes, and zucchini.",
          ingredients:
            "Portobello mushrooms, house spices, basmati rice, grilled onion, tomatoes, zucchini",
          allergens: "Vegetarian, Vegan, Gluten-free",
          price: 2700,
          spiceLevel: "MILD",
          imageUrl: null,
        },
        {
          name: "Afghania Combination",
          description:
            "Nakhoud (chickpeas), kadoo (squash), banjaan (eggplant), sabzi (greens), bamya (okra), daal (lentils), served with qabuli rice, contains non-dairy garlic yogurt.",
          ingredients:
            "Nakhoud, kadoo, banjaan, sabzi, bamya, daal, qabuli rice, non-dairy garlic yogurt",
          allergens: "Vegan",
          price: 2900,
          spiceLevel: "MILD",
          imageUrl: null,
        },
      ],
    },
    {
      name: "Sides",
      sortOrder: 8,
      dishes: [
        {
          name: "Qabuli Rice",
          description:
            "Seasoned long basmati rice topped with julienne carrots & raisins.",
          ingredients: "Basmati rice, julienne carrots, raisins",
          allergens: "Vegan, Gluten-free",
          price: 900,
          spiceLevel: "NONE",
          imageUrl: null,
        },
        {
          name: "Baadenjaan",
          description: "Roasted eggplant.",
          ingredients: "Roasted eggplant",
          allergens: "Vegan, Gluten-free",
          price: 1000,
          spiceLevel: "NONE",
          imageUrl: "/images/dishes/baadenjaan.png",
        },
        {
          name: "Kadoo",
          description: "Roasted butternut squash.",
          ingredients: "Roasted butternut squash",
          allergens: "Vegan, Gluten-free",
          price: 1000,
          spiceLevel: "NONE",
          imageUrl: null,
        },
        {
          name: "Nakhoud",
          description: "Chickpeas.",
          ingredients: "Chickpeas",
          allergens: "Vegan, Gluten-free",
          price: 900,
          spiceLevel: "NONE",
          imageUrl: null,
        },
        {
          name: "Sabzi",
          description: "Slow cooked greens.",
          ingredients:
            "Spinach, kale, mustard greens, collard greens, turnip leaves, dill, cilantro",
          allergens: "Vegan, Gluten-free",
          price: 1000,
          spiceLevel: "NONE",
          imageUrl: null,
        },
        {
          name: "Chalou",
          description:
            "Long grain basmati rice infused with saffron and cumin.",
          ingredients: "Basmati rice, saffron, cumin",
          allergens: "Vegan, Gluten-free",
          price: 800,
          spiceLevel: "NONE",
          imageUrl: null,
        },
        {
          name: "Yogurt with Cucumber & Dill",
          description: "Yogurt with cucumber & dill.",
          ingredients: "Yogurt, cucumber, dill",
          allergens: "Vegetarian, Dairy, Gluten-free",
          price: 800,
          spiceLevel: "NONE",
          imageUrl: null,
        },
      ],
    },
  ];

const reviews = [
  {
    customerName: "Amina R.",
    rating: 5,
    comment:
      "The Qabuli Palaw tasted exactly like my grandmother's — rich, fragrant, and full of love. This is the real deal.",
  },
  {
    customerName: "James T.",
    rating: 5,
    comment:
      "Best kebabs in the city. The smoky char and the fresh naan were incredible. I'll be back every week.",
  },
  {
    customerName: "Sara K.",
    rating: 5,
    comment:
      "The Mantu was a revelation — delicate dumplings, perfect sauce. The whole team was so warm and welcoming.",
  },
  {
    customerName: "David L.",
    rating: 4,
    comment:
      "Beautiful atmosphere and even better food. The Firni dessert was the perfect finish to the meal.",
  },
  {
    customerName: "Laila H.",
    rating: 5,
    comment:
      "Finally, authentic Afghan food done right. The Banjaan Borani is out of this world.",
  },
];

async function main() {
  const currentSlugs = categories.map((category) => slugify(category.name));

  /**
   * This script is NOT safe to re-run against a live menu, whatever the README
   * used to say. Below it deletes categories and dishes the owner added from the
   * admin, and every dish upsert resets name, description, price, spice level
   * and imageUrl to the seeded value — clearing the photo on 90 of the 97.
   *
   * The guard exists because the deployment docs sent people here to change the
   * admin password (that is now `scripts/set-admin.ts`), and because "re-run the
   * seed" is such ordinary advice.
   */
  const existingOrders = await prisma.order.count();
  if (existingOrders > 0 && !process.argv.includes("--force")) {
    console.error(
      `Refusing to seed: this database already has ${existingOrders} order(s), so it is in use.\n\n` +
        "Seeding REPLACES the menu — dishes and categories added from the admin are\n" +
        "deleted, and prices and photos are reset to their seeded values.\n\n" +
        "To change the admin password instead:  npx tsx scripts/set-admin.ts\n" +
        "If you really do want to reset the menu:  npx tsx prisma/seed.ts --force",
    );
    process.exit(1);
  }

  // Replace any previously seeded demo menu (different category set) so the
  // catalog always matches `categories` above rather than accumulating stale
  // rows from earlier seed runs.
  await prisma.dish.deleteMany({
    where: { category: { slug: { notIn: currentSlugs } } },
  });
  await prisma.category.deleteMany({
    where: { slug: { notIn: currentSlugs } },
  });

  for (const category of categories) {
    const slug = slugify(category.name);
    const savedCategory = await prisma.category.upsert({
      where: { slug },
      update: { name: category.name, sortOrder: category.sortOrder },
      create: { name: category.name, slug, sortOrder: category.sortOrder },
    });

    let dishSortOrder = 0;
    for (const dish of category.dishes) {
      const dishSlug = slugify(dish.name);
      await prisma.dish.upsert({
        where: { slug: dishSlug },
        update: {
          name: dish.name,
          description: dish.description,
          ingredients: dish.ingredients,
          allergens: dish.allergens,
          price: dish.price,
          spiceLevel: dish.spiceLevel,
          imageUrl: dish.imageUrl,
          isPopular: dish.isPopular ?? false,
          categoryId: savedCategory.id,
          sortOrder: dishSortOrder,
        },
        create: {
          name: dish.name,
          slug: dishSlug,
          description: dish.description,
          ingredients: dish.ingredients,
          allergens: dish.allergens,
          price: dish.price,
          spiceLevel: dish.spiceLevel,
          imageUrl: dish.imageUrl,
          isPopular: dish.isPopular ?? false,
          categoryId: savedCategory.id,
          sortOrder: dishSortOrder,
        },
      });
      dishSortOrder += 1;
    }
  }

  const existingReviews = await prisma.review.count();
  if (existingReviews === 0) {
    await prisma.review.createMany({ data: reviews });
  }

  // Creating the admin only on a fresh install. Updating an existing password
  // is `scripts/set-admin.ts`, so that nobody has to run this destructive
  // script to do it — which is what the deployment docs used to tell them.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = await prisma.admin.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await prisma.admin.create({ data: { email: adminEmail, passwordHash } });
    } else {
      console.log(
        `Admin ${adminEmail} already exists — left untouched. ` +
          "Use `npx tsx scripts/set-admin.ts` to change its password.",
      );
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    // better-sqlite3 connections close with the process; nothing to await here.
  });
