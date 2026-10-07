/**
 * ⚠️ DEMO MENU — not Pizza Tasty's real menu, names, prices or availability.
 *
 * Replace this file with real content (or a CMS adapter returning the same `Menu` type)
 * and every page, the cart and the WhatsApp message update with no component changes.
 * Images in /public/food are illustrated placeholders until real photos exist.
 * Allergens are deliberately left undefined: the UI then says "ask the restaurant".
 */
import type { Category, Localized, Menu, ModifierGroup, Product, Variant } from '@/domain/types';

const L = (fr: string, en: string, es: string): Localized => ({ fr, en, es });
const img = (id: string) => `/food/${id}.svg`;

export const categories: Category[] = [
  { id: 'pizza', name: L('Pizzas', 'Pizzas', 'Pizzas'), tagline: L('Cuites minute, bord doré', 'Baked to order, golden crust', 'Al momento, borde dorado'), image: img('margherita'), tint: '#FBE3DD' },
  { id: 'tacos', name: L('Tacos', 'Tacos', 'Tacos'), tagline: L('Le french tacos grillé', 'Grilled French tacos', 'El french tacos a la plancha'), image: img('tacos-classique'), tint: '#FCEFD2' },
  { id: 'burgers', name: L('Burgers', 'Burgers', 'Hamburguesas'), tagline: L('Smashés, juteux, généreux', 'Smashed, juicy, generous', 'Smash, jugosas, generosas'), image: img('cheeseburger'), tint: '#F7E2CC' },
  { id: 'sandwiches', name: L('Sandwichs', 'Sandwiches', 'Bocadillos'), tagline: L('Kebab, américain & co', 'Kebab, américain & co', 'Kebab, americano y más'), image: img('kebab'), tint: '#F3EADB' },
  { id: 'panini', name: L('Panini', 'Panini', 'Paninis'), tagline: L('Pressés et dorés', 'Pressed and golden', 'Prensados y dorados'), image: img('panini-trois-fromages'), tint: '#F4E6D4' },
  { id: 'salads', name: L('Salades', 'Salads', 'Ensaladas'), tagline: L('Fraîches et copieuses', 'Fresh and filling', 'Frescas y completas'), image: img('cesar'), tint: '#E3EFE0' },
  { id: 'drinks', name: L('Boissons', 'Drinks', 'Bebidas'), tagline: L('Bien fraîches', 'Ice cold', 'Bien frías'), image: img('limonade'), tint: '#E4EEF0' },
  { id: 'desserts', name: L('Desserts', 'Desserts', 'Postres'), tagline: L('Pour finir en douceur', 'A sweet finish', 'Para terminar dulce'), image: img('tiramisu'), tint: '#F1E4E8' },
];

const SAUCES = [
  ['algerienne', L('Algérienne', 'Algerian', 'Argelina')],
  ['samourai', L('Samouraï', 'Samurai', 'Samurái')],
  ['blanche', L('Blanche', 'White garlic', 'Blanca')],
  ['harissa', L('Harissa', 'Harissa', 'Harissa')],
  ['bbq', L('Barbecue', 'Barbecue', 'Barbacoa')],
  ['ketchup', L('Ketchup', 'Ketchup', 'Kétchup')],
] as const;

export const modifierGroups: ModifierGroup[] = [
  {
    id: 'pizza-crust',
    label: L('Pâte', 'Crust', 'Masa'),
    min: 1,
    max: 1,
    options: [
      { id: 'crust-classic', label: L('Classique', 'Classic', 'Clásica'), price: 0 },
      { id: 'crust-thin', label: L('Fine et croustillante', 'Thin & crispy', 'Fina y crujiente'), price: 0 },
      { id: 'crust-stuffed', label: L('Bord farci au fromage', 'Cheese-stuffed crust', 'Borde relleno de queso'), price: 250 },
    ],
  },
  {
    id: 'pizza-extras',
    label: L('Suppléments', 'Extra toppings', 'Extras'),
    min: 0,
    max: 4,
    options: [
      { id: 'x-mozza', label: L('Mozzarella', 'Mozzarella', 'Mozzarella'), price: 150 },
      { id: 'x-chevre', label: L('Chèvre', 'Goat cheese', 'Queso de cabra'), price: 150 },
      { id: 'x-jambon', label: L('Jambon', 'Ham', 'Jamón'), price: 200 },
      { id: 'x-poulet', label: L('Poulet', 'Chicken', 'Pollo'), price: 200 },
      { id: 'x-pepperoni', label: L('Pepperoni', 'Pepperoni', 'Pepperoni'), price: 200 },
      { id: 'x-champignons', label: L('Champignons', 'Mushrooms', 'Champiñones'), price: 100 },
      { id: 'x-olives', label: L('Olives', 'Olives', 'Aceitunas'), price: 100 },
      { id: 'x-oeuf', label: L('Œuf', 'Egg', 'Huevo'), price: 100 },
    ],
  },
  {
    id: 'tacos-meats',
    label: L('Viandes', 'Meats', 'Carnes'),
    min: 1,
    max: 1,
    limitsByVariant: { m: { min: 1, max: 1 }, l: { min: 2, max: 2 }, xl: { min: 3, max: 3 }, giant: { min: 3, max: 3 } },
    options: [
      { id: 'm-poulet', label: L('Poulet mariné', 'Marinated chicken', 'Pollo marinado'), price: 0 },
      { id: 'm-hachee', label: L('Viande hachée', 'Minced beef', 'Carne picada'), price: 0 },
      { id: 'm-merguez', label: L('Merguez', 'Merguez', 'Merguez'), price: 0 },
      { id: 'm-nuggets', label: L('Nuggets', 'Nuggets', 'Nuggets'), price: 0 },
      { id: 'm-cordon', label: L('Cordon bleu', 'Cordon bleu', 'Cordon bleu'), price: 100 },
      { id: 'm-kebab', label: L('Kebab', 'Kebab', 'Kebab'), price: 0 },
    ],
  },
  {
    id: 'tacos-sauces',
    label: L('Sauces', 'Sauces', 'Salsas'),
    min: 1,
    max: 2,
    options: SAUCES.map(([id, label]) => ({ id: `s-${id}`, label, price: 0 })),
  },
  {
    id: 'tacos-extras',
    label: L('Suppléments', 'Extras', 'Extras'),
    min: 0,
    max: 3,
    options: [
      { id: 't-cheddar', label: L('Cheddar', 'Cheddar', 'Cheddar'), price: 100 },
      { id: 't-oeuf', label: L('Œuf', 'Egg', 'Huevo'), price: 100 },
      { id: 't-bacon', label: L('Bacon de bœuf', 'Beef bacon', 'Bacon de ternera'), price: 150 },
      { id: 't-galette', label: L('Galette de pomme de terre', 'Hash brown', 'Rösti de patata'), price: 150 },
    ],
  },
  {
    id: 'sauces-optional',
    label: L('Sauces', 'Sauces', 'Salsas'),
    min: 0,
    max: 2,
    options: SAUCES.map(([id, label]) => ({ id: `so-${id}`, label, price: 0 })),
  },
  {
    id: 'burger-extras',
    label: L('Suppléments', 'Extras', 'Extras'),
    min: 0,
    max: 3,
    options: [
      { id: 'b-cheddar', label: L('Cheddar', 'Cheddar', 'Cheddar'), price: 100 },
      { id: 'b-bacon', label: L('Bacon de bœuf', 'Beef bacon', 'Bacon de ternera'), price: 150 },
      { id: 'b-oeuf', label: L('Œuf', 'Egg', 'Huevo'), price: 100 },
      { id: 'b-oignons', label: L('Oignons caramélisés', 'Caramelised onions', 'Cebolla caramelizada'), price: 50 },
      { id: 'b-jalapenos', label: L('Jalapeños', 'Jalapeños', 'Jalapeños'), price: 50 },
    ],
  },
  {
    id: 'menu-drink',
    label: L('Boisson du menu', 'Meal drink', 'Bebida del menú'),
    min: 0,
    max: 0,
    limitsByVariant: { menu: { min: 1, max: 1 } },
    options: [
      { id: 'd-cola', label: L('Cola 33 cl', 'Cola 33 cl', 'Cola 33 cl'), price: 0 },
      { id: 'd-the', label: L('Thé glacé pêche 33 cl', 'Peach iced tea 33 cl', 'Té helado de melocotón 33 cl'), price: 0 },
      { id: 'd-eau', label: L('Eau minérale 50 cl', 'Still water 50 cl', 'Agua mineral 50 cl'), price: 0 },
      { id: 'd-limonade', label: L('Limonade maison', 'Homemade lemonade', 'Limonada casera'), price: 100 },
    ],
  },
  {
    id: 'salad-dressing',
    label: L('Sauce', 'Dressing', 'Aliño'),
    min: 1,
    max: 1,
    options: [
      { id: 'dr-house', label: L('Vinaigrette maison', 'House vinaigrette', 'Vinagreta de la casa'), price: 0 },
      { id: 'dr-caesar', label: L('Sauce césar', 'Caesar dressing', 'Salsa césar'), price: 0 },
      { id: 'dr-lemon', label: L('Citron & huile d’olive', 'Lemon & olive oil', 'Limón y aceite de oliva'), price: 0 },
    ],
  },
  {
    id: 'salad-extras',
    label: L('Suppléments', 'Extras', 'Extras'),
    min: 0,
    max: 3,
    options: [
      { id: 'sx-poulet', label: L('Poulet grillé', 'Grilled chicken', 'Pollo a la plancha'), price: 200 },
      { id: 'sx-oeuf', label: L('Œuf dur', 'Boiled egg', 'Huevo duro'), price: 100 },
      { id: 'sx-avocat', label: L('Avocat', 'Avocado', 'Aguacate'), price: 150 },
      { id: 'sx-parmesan', label: L('Parmesan', 'Parmesan', 'Parmesano'), price: 100 },
    ],
  },
];

const pizzaSizes = (senior: number, mega: number): Variant[] => [
  { id: 'senior', label: L('Senior', 'Medium', 'Mediana'), detail: L('29 cm · 1 personne', '29 cm · serves 1', '29 cm · 1 persona'), price: senior },
  { id: 'mega', label: L('Méga', 'Large', 'Grande'), detail: L('40 cm · 2 personnes', '40 cm · serves 2', '40 cm · 2 personas'), price: mega },
];
const tacosSizes = (m: number, l: number, xl: number): Variant[] => [
  { id: 'm', label: L('M', 'M', 'M'), detail: L('1 viande', '1 meat', '1 carne'), price: m },
  { id: 'l', label: L('L', 'L', 'L'), detail: L('2 viandes', '2 meats', '2 carnes'), price: l },
  { id: 'xl', label: L('XL', 'XL', 'XL'), detail: L('3 viandes', '3 meats', '3 carnes'), price: xl },
];
const burgerFormats = (solo: number): Variant[] => [
  { id: 'solo', label: L('Seul', 'Burger only', 'Solo'), price: solo },
  { id: 'menu', label: L('En menu', 'As a meal', 'En menú'), detail: L('+ frites + boisson', '+ fries + drink', '+ patatas + bebida'), price: solo + 350 },
];
const single = (price: number): Variant[] => [{ id: 'std', label: L('Standard', 'Regular', 'Normal'), price }];
const drinkSizes = (small: number, large: number): Variant[] => [
  { id: '33', label: L('33 cl', '33 cl', '33 cl'), price: small },
  { id: '50', label: L('50 cl', '50 cl', '50 cl'), price: large },
];

const PIZZA_GROUPS = ['pizza-crust', 'pizza-extras'];
const TACOS_GROUPS = ['tacos-meats', 'tacos-sauces', 'tacos-extras'];
const BURGER_GROUPS = ['burger-extras', 'menu-drink'];
const SALAD_GROUPS = ['salad-dressing', 'salad-extras'];

export const products: Product[] = [
  // Pizzas
  { id: 'margherita', categoryId: 'pizza', image: img('margherita'), variants: pizzaSizes(950, 1450), modifierGroupIds: PIZZA_GROUPS, badges: ['veggie'], featured: true, available: true, allowNote: true,
    name: L('Margherita', 'Margherita', 'Margarita'),
    description: L('Sauce tomate, mozzarella fondante, basilic frais, filet d’huile d’olive.', 'Tomato sauce, melting mozzarella, fresh basil, a drizzle of olive oil.', 'Salsa de tomate, mozzarella fundida, albahaca fresca y aceite de oliva.') },
  { id: 'reine', categoryId: 'pizza', image: img('reine'), variants: pizzaSizes(1050, 1550), modifierGroupIds: PIZZA_GROUPS, available: true, allowNote: true,
    name: L('Reine', 'Reine', 'Reina'),
    description: L('Sauce tomate, mozzarella, jambon, champignons frais.', 'Tomato sauce, mozzarella, ham, fresh mushrooms.', 'Salsa de tomate, mozzarella, jamón y champiñones frescos.') },
  { id: 'quatre-fromages', categoryId: 'pizza', image: img('quatre-fromages'), variants: pizzaSizes(1150, 1650), modifierGroupIds: PIZZA_GROUPS, badges: ['veggie'], available: true, allowNote: true,
    name: L('4 Fromages', 'Four Cheese', '4 Quesos'),
    description: L('Crème, mozzarella, chèvre, bleu et emmental gratiné.', 'Cream base, mozzarella, goat cheese, blue cheese and golden emmental.', 'Base de nata, mozzarella, cabra, queso azul y emmental gratinado.') },
  { id: 'pepperoni', categoryId: 'pizza', image: img('pepperoni'), variants: pizzaSizes(1100, 1600), modifierGroupIds: PIZZA_GROUPS, badges: ['popular'], featured: true, available: true, allowNote: true,
    name: L('Pepperoni', 'Pepperoni', 'Pepperoni'),
    description: L('Sauce tomate, mozzarella et pepperoni qui croustille sur les bords.', 'Tomato sauce, mozzarella and pepperoni that crisps at the edges.', 'Salsa de tomate, mozzarella y pepperoni crujiente en los bordes.') },
  { id: 'vegetarienne', categoryId: 'pizza', image: img('vegetarienne'), variants: pizzaSizes(1050, 1550), modifierGroupIds: PIZZA_GROUPS, badges: ['veggie'], available: true, allowNote: true,
    name: L('Végétarienne', 'Vegetarian', 'Vegetariana'),
    description: L('Tomate, mozzarella, poivrons, oignons rouges, champignons, olives.', 'Tomato, mozzarella, peppers, red onion, mushrooms, olives.', 'Tomate, mozzarella, pimientos, cebolla morada, champiñones y aceitunas.') },
  { id: 'chicken-bbq', categoryId: 'pizza', image: img('chicken-bbq'), variants: pizzaSizes(1200, 1700), modifierGroupIds: PIZZA_GROUPS, badges: ['popular'], featured: true, available: true, allowNote: true,
    name: L('Chicken BBQ', 'Chicken BBQ', 'Chicken BBQ'),
    description: L('Sauce barbecue, mozzarella, poulet rôti, oignons rouges.', 'Barbecue sauce, mozzarella, roast chicken, red onion.', 'Salsa barbacoa, mozzarella, pollo asado y cebolla morada.') },
  { id: 'orientale', categoryId: 'pizza', image: img('orientale'), variants: pizzaSizes(1150, 1650), modifierGroupIds: PIZZA_GROUPS, badges: ['spicy'], available: true, allowNote: true,
    name: L('Orientale', 'Oriental', 'Oriental'),
    description: L('Tomate, mozzarella, merguez, poivrons et un œuf au centre.', 'Tomato, mozzarella, merguez sausage, peppers and an egg in the middle.', 'Tomate, mozzarella, merguez, pimientos y un huevo en el centro.') },
  { id: 'saumon', categoryId: 'pizza', image: img('saumon'), variants: pizzaSizes(1300, 1800), modifierGroupIds: PIZZA_GROUPS, badges: ['new'], available: false, allowNote: true,
    name: L('Saumon', 'Salmon', 'Salmón'),
    description: L('Crème fraîche, mozzarella, saumon fumé, aneth, zeste de citron.', 'Crème fraîche, mozzarella, smoked salmon, dill, lemon zest.', 'Crème fraîche, mozzarella, salmón ahumado, eneldo y ralladura de limón.') },

  // Tacos
  { id: 'tacos-classique', categoryId: 'tacos', image: img('tacos-classique'), variants: tacosSizes(750, 950, 1250), modifierGroupIds: TACOS_GROUPS, badges: ['popular'], featured: true, available: true, allowNote: true,
    name: L('Tacos Classique', 'Classic French Tacos', 'Tacos Francés Clásico'),
    description: L('Tortilla grillée, frites, sauce fromagère maison et viande au choix.', 'Grilled tortilla, fries, house cheese sauce and your choice of meat.', 'Tortilla a la plancha, patatas, salsa de queso casera y carne a elegir.') },
  { id: 'tacos-gratine', categoryId: 'tacos', image: img('tacos-gratine'), variants: tacosSizes(850, 1050, 1350), modifierGroupIds: TACOS_GROUPS, badges: ['new'], available: true, allowNote: true,
    name: L('Tacos Gratiné', 'Gratin Tacos', 'Tacos Gratinado'),
    description: L('Le classique, gratiné au four avec cheddar et mozzarella sur le dessus.', 'The classic, oven-baked with cheddar and mozzarella melted on top.', 'El clásico, gratinado al horno con cheddar y mozzarella por encima.') },
  { id: 'tacos-xl', categoryId: 'tacos', image: img('tacos-xl'), variants: [{ id: 'giant', label: L('Géant', 'Giant', 'Gigante'), detail: L('3 viandes · double frites', '3 meats · double fries', '3 carnes · doble patatas'), price: 1490 }], modifierGroupIds: TACOS_GROUPS, badges: ['spicy'], available: true, allowNote: true,
    name: L('Tacos Géant', 'Giant Tacos', 'Tacos Gigante'),
    description: L('Pour les grosses faims : trois viandes, double frites, double sauce fromagère.', 'For big appetites: three meats, double fries, double cheese sauce.', 'Para mucha hambre: tres carnes, doble de patatas y doble salsa de queso.') },

  // Burgers
  { id: 'cheeseburger', categoryId: 'burgers', image: img('cheeseburger'), variants: burgerFormats(890), modifierGroupIds: BURGER_GROUPS, badges: ['popular'], featured: true, available: true, allowNote: true,
    name: L('Cheese Tasty', 'Cheese Tasty', 'Cheese Tasty'),
    description: L('Steak haché 150 g, cheddar, salade, tomate, pickles, sauce maison.', '150 g beef patty, cheddar, lettuce, tomato, pickles, house sauce.', 'Carne de 150 g, cheddar, lechuga, tomate, pepinillos y salsa de la casa.') },
  { id: 'double-smash', categoryId: 'burgers', image: img('double-smash'), variants: burgerFormats(1190), modifierGroupIds: BURGER_GROUPS, badges: ['new'], featured: true, available: true, allowNote: true,
    name: L('Double Smash', 'Double Smash', 'Double Smash'),
    description: L('Deux steaks smashés, double cheddar, oignons caramélisés.', 'Two smashed patties, double cheddar, caramelised onions.', 'Dos carnes smash, doble cheddar y cebolla caramelizada.') },
  { id: 'chicken-crispy', categoryId: 'burgers', image: img('chicken-crispy'), variants: burgerFormats(990), modifierGroupIds: BURGER_GROUPS, available: true, allowNote: true,
    name: L('Chicken Crispy', 'Chicken Crispy', 'Chicken Crispy'),
    description: L('Filet de poulet croustillant, salade, mayonnaise, pain brioché.', 'Crispy chicken fillet, lettuce, mayonnaise, brioche bun.', 'Filete de pollo crujiente, lechuga, mayonesa y pan brioche.') },
  { id: 'veggie-burger', categoryId: 'burgers', image: img('veggie-burger'), variants: burgerFormats(990), modifierGroupIds: BURGER_GROUPS, badges: ['veggie'], available: true, allowNote: true,
    name: L('Veggie', 'Veggie', 'Veggie'),
    description: L('Galette de légumes, avocat, salade, tomate, oignon rouge.', 'Vegetable patty, avocado, lettuce, tomato, red onion.', 'Hamburguesa de verduras, aguacate, lechuga, tomate y cebolla morada.') },

  // Sandwiches
  { id: 'kebab', categoryId: 'sandwiches', image: img('kebab'), modifierGroupIds: ['sauces-optional'], badges: ['popular'], available: true, allowNote: true,
    variants: [
      { id: 'pain', label: L('Pain', 'Pitta bread', 'Pan de pita'), price: 790 },
      { id: 'galette', label: L('Galette', 'Wrap', 'Wrap'), price: 790 },
    ],
    name: L('Kebab', 'Kebab', 'Kebab'),
    description: L('Viande grillée émincée, salade, tomate, oignons, sauce au choix.', 'Sliced grilled meat, lettuce, tomato, onion, your choice of sauce.', 'Carne a la parrilla en tiras, lechuga, tomate, cebolla y salsa a elegir.') },
  { id: 'americain', categoryId: 'sandwiches', image: img('americain'), variants: single(850), modifierGroupIds: ['sauces-optional'], available: true, allowNote: true,
    name: L('Américain', 'Américain', 'Americano'),
    description: L('Demi-baguette, deux steaks, frites, cheddar, sauce au choix.', 'Half baguette, two beef patties, fries, cheddar, your choice of sauce.', 'Media baguette, dos carnes, patatas, cheddar y salsa a elegir.') },
  { id: 'poulet-curry', categoryId: 'sandwiches', image: img('poulet-curry'), variants: single(790), available: true,
    name: L('Poulet Curry', 'Curry Chicken', 'Pollo al Curry'),
    description: L('Baguette, poulet mariné au curry, salade, tomate, sauce blanche.', 'Baguette, curry-marinated chicken, lettuce, tomato, white sauce.', 'Baguette, pollo marinado al curry, lechuga, tomate y salsa blanca.') },

  // Panini
  { id: 'panini-trois-fromages', categoryId: 'panini', image: img('panini-trois-fromages'), variants: single(590), badges: ['veggie'], available: true,
    name: L('Panini 3 Fromages', 'Three Cheese Panini', 'Panini 3 Quesos'),
    description: L('Mozzarella, emmental et chèvre, pressé jusqu’à être bien doré.', 'Mozzarella, emmental and goat cheese, pressed until golden.', 'Mozzarella, emmental y queso de cabra, prensado hasta dorar.') },
  { id: 'panini-poulet', categoryId: 'panini', image: img('panini-poulet'), variants: single(650), available: true,
    name: L('Panini Poulet', 'Chicken Panini', 'Panini de Pollo'),
    description: L('Poulet, tomate, mozzarella et pesto.', 'Chicken, tomato, mozzarella and pesto.', 'Pollo, tomate, mozzarella y pesto.') },
  { id: 'panini-choco', categoryId: 'panini', image: img('panini-choco'), variants: single(490), badges: ['veggie'], available: true,
    name: L('Panini Choco-Banane', 'Choc-Banana Panini', 'Panini Choco-Plátano'),
    description: L('Chocolat fondant et banane, pour finir en douceur.', 'Melting chocolate and banana for a sweet finish.', 'Chocolate fundido y plátano para un final dulce.') },

  // Salads
  { id: 'cesar', categoryId: 'salads', image: img('cesar'), variants: single(990), modifierGroupIds: SALAD_GROUPS, featured: true, available: true, allowNote: true,
    name: L('César', 'Caesar', 'César'),
    description: L('Romaine, poulet grillé, croûtons, copeaux de parmesan.', 'Romaine, grilled chicken, croutons, parmesan shavings.', 'Lechuga romana, pollo a la plancha, picatostes y lascas de parmesano.') },
  { id: 'chevre-chaud', categoryId: 'salads', image: img('chevre-chaud'), variants: single(1050), modifierGroupIds: SALAD_GROUPS, badges: ['veggie'], available: true, allowNote: true,
    name: L('Chèvre Chaud', 'Warm Goat Cheese', 'Queso de Cabra Caliente'),
    description: L('Mesclun, toasts de chèvre gratinés, miel, noix, tomates cerises.', 'Mixed leaves, grilled goat cheese toasts, honey, walnuts, cherry tomatoes.', 'Mezclum, tostas de queso de cabra gratinado, miel, nueces y tomates cherry.') },
  { id: 'salade-thon', categoryId: 'salads', image: img('salade-thon'), variants: single(950), modifierGroupIds: SALAD_GROUPS, available: true, allowNote: true,
    name: L('Thon & Œuf', 'Tuna & Egg', 'Atún y Huevo'),
    description: L('Salade verte, thon, œuf dur, tomates cerises, olives, maïs.', 'Green salad, tuna, boiled egg, cherry tomatoes, olives, sweetcorn.', 'Ensalada verde, atún, huevo duro, tomates cherry, aceitunas y maíz.') },

  // Drinks
  { id: 'cola', categoryId: 'drinks', image: img('cola'), variants: drinkSizes(250, 350), available: true,
    name: L('Cola', 'Cola', 'Cola'),
    description: L('Bien frais, avec ou sans glaçons.', 'Ice cold, with or without ice.', 'Bien fría, con o sin hielo.') },
  { id: 'the-glace', categoryId: 'drinks', image: img('the-glace'), variants: drinkSizes(250, 350), available: true,
    name: L('Thé glacé pêche', 'Peach Iced Tea', 'Té Helado de Melocotón'),
    description: L('Thé noir infusé, notes de pêche.', 'Brewed black tea with peach notes.', 'Té negro con notas de melocotón.') },
  { id: 'eau', categoryId: 'drinks', image: img('eau'), variants: single(200), available: true,
    name: L('Eau minérale 50 cl', 'Still Water 50 cl', 'Agua Mineral 50 cl'),
    description: L('Plate, bien fraîche.', 'Still and chilled.', 'Sin gas, bien fría.') },
  { id: 'limonade', categoryId: 'drinks', image: img('limonade'), variants: single(350), badges: ['new'], available: true,
    name: L('Limonade maison', 'Homemade Lemonade', 'Limonada Casera'),
    description: L('Citron pressé, menthe fraîche, un peu de sucre de canne.', 'Squeezed lemon, fresh mint, a touch of cane sugar.', 'Limón exprimido, hierbabuena y un toque de azúcar de caña.') },
  { id: 'jus-orange', categoryId: 'drinks', image: img('jus-orange'), variants: single(400), available: true,
    name: L('Jus d’orange pressé', 'Fresh Orange Juice', 'Zumo de Naranja Natural'),
    description: L('Pressé à la commande.', 'Squeezed to order.', 'Exprimido al momento.') },

  // Desserts
  { id: 'tiramisu', categoryId: 'desserts', image: img('tiramisu'), variants: single(450), badges: ['popular'], featured: true, available: true,
    name: L('Tiramisu', 'Tiramisu', 'Tiramisú'),
    description: L('Mascarpone, biscuit imbibé de café, cacao.', 'Mascarpone, coffee-soaked sponge, cocoa.', 'Mascarpone, bizcocho empapado en café y cacao.') },
  { id: 'brownie', categoryId: 'desserts', image: img('brownie'), variants: single(390), available: true,
    name: L('Brownie', 'Brownie', 'Brownie'),
    description: L('Chocolat noir et noix, cœur fondant.', 'Dark chocolate and walnuts, gooey centre.', 'Chocolate negro y nueces, centro fundente.') },
  { id: 'pizza-choco-banane', categoryId: 'desserts', image: img('pizza-choco-banane'), available: true,
    variants: [
      { id: 'senior', label: L('Senior', 'Medium', 'Mediana'), detail: L('29 cm', '29 cm', '29 cm'), price: 890 },
      { id: 'mega', label: L('Méga', 'Large', 'Grande'), detail: L('40 cm · à partager', '40 cm · to share', '40 cm · para compartir'), price: 1290 },
    ],
    name: L('Pizza Choco-Banane', 'Choc-Banana Pizza', 'Pizza Choco-Plátano'),
    description: L('Pâte à pizza, pâte à tartiner, banane, sucre glace.', 'Pizza dough, chocolate spread, banana, icing sugar.', 'Masa de pizza, crema de cacao, plátano y azúcar glas.') },
];

export const demoMenu: Menu = { categories, products, modifierGroups };
