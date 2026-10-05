# Чистка каталога (FIXES_v2.1, задача 3)

Сгенерировано `npm run catalog`. Ручные решения: `mappings/recipe-blocklist.json`,
`mappings/recipe-allowlist.json` (id рецепта), `mappings/ingredient-allowlist.json`,
`mappings/ingredient-blocklist.json` (id продукта). 16 рецептов v1 не трогаются.

Критерий «есть в Lidl»: данные Open Food Facts удалены из каталога в v7, поэтому вместо них —
список `mappings/ingredient-lidl.json`, составленный вручную (что обычно продаётся в Lidl Венгрии).
Его стоит проверить: всё, что в нём, не считается редким.

## Итог

| | до | после |
|---|---:|---:|
| Рецептов | 146 | 75 |
| — Завтрак | 17 | 13 |
| — Обед | 65 | 27 |
| — Ужин | 42 | 18 |
| — Перекус | 24 | 17 |
| Продуктов | 418 | 157 |

Удалено рецептов: 71 (гриль 25, редкие продукты 46, вручную 0).
Удалено продуктов: 261.

Число использований считается один раз, по рецептам после шага «гриль» (порядок спеки:
посчитать → убрать блюда → убрать неиспользуемые продукты). После чистки у оставшихся
блюд продуктов вне белого списка и Lidl с < 3 использованиями: 5 (каскадный пересчёт — `prune.cascade` в конфиге — оставил бы только свои блюда).

## Удалённые рецепты

| id | Название | Приёмы пищи | Причина |
|---|---|---|---|
| own_s_chicken_skewers | Куриные шашлычки с перцем (Chicken and pepper skewers) | snack | гриль («skewer») |
| mdb_52780 | Картофельный гратен с курицей (Potato Gratin with Chicken) | lunch | гриль («grill») · можно адаптировать |
| mdb_52806 | Курица тандури (Tandoori chicken) | dinner | гриль («grill») · можно адаптировать |
| mdb_52845 | Мясной рулет из индейки с фасолью (Turkey Meatloaf) | lunch | гриль («grill») · можно адаптировать |
| mdb_52995 | Слоппи джо со свининой барбекю (BBQ Pork Sloppy Joes) | dinner | гриль («grill») · можно адаптировать |
| mdb_53006 | Мусака (Moussaka) | lunch | гриль («grill») · можно адаптировать |
| mdb_53010 | Бургеры из баранины с соусом дзадзики (Lamb Tzatziki Burgers) | dinner | гриль («barbecue») |
| mdb_53011 | Греческий салат с киноа и курицей (Chicken Quinoa Greek Salad) | dinner | гриль («griddle») · можно адаптировать |
| mdb_53028 | Шаурма с курицей (Shawarma) | lunch | гриль («grill») |
| mdb_53041 | Сардины на гриле по-португальски (Grilled Portuguese sardines) | dinner | гриль («grill») |
| mdb_53055 | Чевапчичи (Cevapi Sausages) | lunch | гриль («grill») |
| mdb_53099 | Австралийские бургеры на лепёшках наан (Aussie Burgers) | dinner | гриль («griddle») |
| mdb_53103 | Баррамунди с марокканскими специями (Barramundi with Moroccan spices) | lunch | гриль («grill») |
| mdb_53105 | Пряная курица на гриле с дымком трав (Spiced smoky barbecued chicken) | lunch | гриль («barbecue») |
| mdb_53108 | Быстрый кальмар с солью и перцем (Quick salt & pepper squid) | lunch | гриль («barbecue») |
| mdb_53140 | Матамбре а-ля пицца (Matambre a la Pizza) | dinner | гриль («grill») · можно адаптировать |
| mdb_53142 | Пряная испанская тортилья (Spiced tortilla) | snack | гриль («grill») · можно адаптировать |
| mdb_53171 | Тортилья с солёной треской (Salt cod tortilla) | breakfast, lunch | гриль («grill») · можно адаптировать |
| mdb_53204 | Куриные шашлычки с красной пастой карри (Red curry chicken kebabs) | lunch | гриль («barbecue») |
| mdb_53253 | Имам баялды с бараниной на гриле и дзадзики (Imam bayildi with BBQ lamb & tzatziki) | lunch | гриль («bbq») |
| mdb_53261 | Куриные крылышки с зирой, лимоном и чесноком (Chicken wings with cumin, lemon & garlic) | lunch | гриль («barbecue») |
| mdb_53264 | Куриные шашлычки с копчёной паприкой (Smoky chicken skewers) | dinner | гриль («skewer») |
| mdb_53265 | Бараньи котлеты на кости с чили и имбирём (Chilli ginger lamb chops) | lunch | гриль («barbecue») |
| mdb_53465 | Лягушачьи лапки в чесночном масле (Frog Legs Recipe in Garlic Butter) | dinner | гриль («grill») · можно адаптировать |
| mdb_53547 | Кубинский сэндвич (Cuban Sandwich) | lunch | гриль («grill») · можно адаптировать |
| own_b_burrito | Буррито с яйцами и фасолью (Breakfast burrito with eggs and beans) | breakfast | редкий продукт: Чёрная фасоль (консерв.) (Black beans (canned)) ×1 |
| mdb_52765 | Запеканка с курицей по-мексикански (энчилада) (Chicken Enchilada Casserole) | lunch | редкий продукт: Соус для энчилады (Enchilada sauce) ×1, Кукурузная тортилья (Corn tortilla) ×1 |
| mdb_52773 | Лосось в медовом соусе терияки (Honey Teriyaki Salmon) | lunch | редкий продукт: Саке / рисовое вино (Sake / rice wine) ×1 |
| mdb_52802 | Рыбный пирог с картофельным пюре (Fish pie) | lunch | редкий продукт: Топинамбур (Jerusalem artichoke) ×1 |
| mdb_52808 | Роган-джош из баранины (Lamb Rogan josh) | dinner | редкий продукт: Индийская паста карри (Indian curry paste) ×1, Баранина (Lamb) ×2 |
| mdb_52834 | Бефстроганов (Beef stroganoff) | dinner | редкий продукт: Крем-фреш (Crème fraîche) ×2 |
| mdb_52836 | Фидеуа с морепродуктами (Seafood fideuà) | lunch | редкий продукт: Мидии (Mussels) ×1, Кальмар (Squid) ×2, Рыбный бульон (Fish stock) ×2 |
| mdb_52852 | Салат нисуаз с тунцом (Tuna Nicoise) | lunch | редкий продукт: Каперсы (Capers) ×1 |
| mdb_52882 | Рыбная запеканка из трёх видов рыбы (Three Fish Pie) | lunch | редкий продукт: Пикша (Haddock) ×2, Копчёная пикша (Smoked haddock) ×2 |
| mdb_52946 | Креветки гунбао (Kung Po Prawns) | lunch | редкий продукт: Водяной орех (консерв.) (Water chestnuts) ×1 |
| mdb_52948 | Вонтоны со свининой (Wontons) | snack | редкий продукт: Тесто для вонтонов (Wonton / spring roll wrappers) ×1 |
| mdb_52954 | Кисло-острый суп (Hot and Sour Soup) | lunch | редкий продукт: Шиитаке (Shiitake mushrooms) ×2 |
| mdb_52959 | Запечённый лосось с фенхелем и помидорами (Baked salmon with fennel & tomatoes) | dinner | редкий продукт: Фенхель (Fennel) ×2 |
| mdb_52964 | Кеджери с копчёной пикшей (Smoked Haddock Kedgeree) | breakfast | редкий продукт: Копчёная пикша (Smoked haddock) ×2 |
| mdb_53032 | Тонкацу — свиная отбивная в панко (Tonkatsu pork) | lunch | редкий продукт: Вустерширский соус (Worcestershire sauce) ×2, Устричный соус (Oyster sauce) ×2 |
| mdb_53043 | Рыбные крокеты фофос (Fish fofos) | lunch | редкий продукт: Пикша (Haddock) ×2 |
| mdb_53050 | Аям перчик (курица в пряном кокосовом соусе) (Ayam Percik) | lunch | редкий продукт: Фенхель (Fennel) ×2, Паста тамаринда (Tamarind paste) ×1 |
| mdb_53096 | Хэш из солонины с картофелем (Corned Beef Hash) | breakfast, lunch | редкий продукт: Солонина (консерв.) (Corned beef (canned)) ×2 |
| mdb_53126 | Брун лапскаус (норвежское рагу из говядины с овощами) (Brun Lapskaus (Norwegian Beef Vegetable Stew)) | dinner | редкий продукт: Брюква (Swede) ×1 |
| mdb_53143 | Курица по-испански с чоризо (Easy Spanish chicken) | dinner | редкий продукт: Фасоль лима (консерв.) (Butter beans (canned)) ×1 |
| mdb_53181 | Испанская фасоль с курицей и чоризо (Spanish beans with chicken & chorizo) | lunch | редкий продукт: Фасоль пинто (консерв.) (Pinto beans (canned)) ×1 |
| mdb_53186 | Курица с шафраном, изюмом и кедровыми орехами (Chicken with saffron, raisins & pine nuts) | lunch | редкий продукт: Кедровые орехи (Pine nuts) ×1 |
| mdb_53194 | Том ям с креветками (Tom yum soup with prawns) | snack | редкий продукт: Вёшенки (Oyster mushrooms) ×1 |
| mdb_53203 | Тайский салат с рисовой лапшой (Thai rice noodle salad) | dinner | редкий продукт: Ростки маша (Bean sprouts) ×2 |
| mdb_53228 | Форель в карамели по-вьетнамски (Vietnamese caramel trout) | dinner | редкий продукт: Пак-чой (Pak choi) ×2 |
| mdb_53233 | Жареные кальмары с солью и перцем (Salt & pepper squid) | lunch | редкий продукт: Кальмар (Squid) ×2 |
| mdb_53234 | Суп с лососем и рисовой лапшой (Salmon noodle soup) | dinner | редкий продукт: Шиитаке (Shiitake mushrooms) ×2 |
| mdb_53240 | Тофу с зеленью и кешью в воке (Tofu, greens & cashew stir-fry) | lunch | редкий продукт: Соевые бобы (сухие) (Soybeans (dry)) ×2, Пак-чой (Pak choi) ×2, Соус хойсин (Hoisin sauce) ×1 |
| mdb_53241 | Вьетнамские роллы в рисовой бумаге (Vietnamese veg parcels) | snack | редкий продукт: Рисовая бумага (Rice paper sheets) ×2 |
| mdb_53243 | Вьетнамские роллы с креветками и овощами (Vietnamese prawn spiralized rolls) | dinner | редкий продукт: Рисовая бумага (Rice paper sheets) ×2 |
| mdb_53247 | Сибас с хрустящим имбирём, чили и зелёным луком (Sea bass with sizzled ginger, chilli & spring onions) | lunch | редкий продукт: Сибас (Sea bass) ×1 |
| mdb_53328 | Карне мечада (венесуэльская рваная говядина) (Venezuelan Shredded Beef) | dinner | редкий продукт: Говяжья пашина (фланк) (Flank / skirt steak) ×2, Вустерширский соус (Worcestershire sauce) ×2 |
| mdb_53349 | Острые креветки по-ямайски (Jamaican Pepper Shrimp) | snack | редкий продукт: Рыбный бульон (Fish stock) ×2 |
| mdb_53350 | Солонина с капустой по-ямайски (Corned Beef and Cabbage – Jamaican Style) | lunch | редкий продукт: Солонина (консерв.) (Corned beef (canned)) ×2 |
| mdb_53354 | Ямайское карри из козлятины (Jamaican Curry Goat) | dinner | редкий продукт: Козлятина (Goat meat) ×1 |
| mdb_53366 | Говядина с брокколи в воке (Beef and Broccoli Stir-Fry) | lunch | редкий продукт: Устричный соус (Oyster sauce) ×2 |
| mdb_53369 | Шёлковый тофу с соевым соусом и кунжутом (Silken Tofu with Sesame Soy Sauce) | snack | редкий продукт: Шёлковый тофу (Silken tofu) ×1, Тахини (Tahini) ×1 |
| mdb_53376 | Курица в кисло-сладком соусе (Sweet and Sour Chicken) | lunch | редкий продукт: Ананасовый сок (Pineapple juice) ×1 |
| mdb_53404 | Тава коси (баранина, запечённая с йогуртом) (Tavë Kosi Baked Lamb and Yogurt) | lunch | редкий продукт: Баранина (Lamb) ×2 |
| mdb_53418 | Водяной шпинат со свининой, соевыми бобами и чесноком по-камбоджийски (Cambodian Stir-fried Morning Glory with Pork, Fermented Soybeans, and Garlic) | dinner | редкий продукт: Листовая зелень (амарант) (Leafy greens (callaloo / jute)) ×1, Соевые бобы (сухие) (Soybeans (dry)) ×2 |
| mdb_53451 | Бангладешское рыбное карри с дайконом (Bangladeshi fish curry with daikon) | dinner | редкий продукт: Дайкон (Daikon) ×1 |
| mdb_53497 | Ном бань чок — камбоджийский суп с лапшой (Nom Banh Chok – Cambodian Noodle Soup) | lunch | редкий продукт: Ростки маша (Bean sprouts) ×2 |
| mdb_53509 | Жареный краб с острым перцем (Fried Crab) | dinner | редкий продукт: Крабовое мясо (Crab meat) ×1 |
| mdb_53510 | Омар по-каймански (Cayman-Style Lobster) | dinner | редкий продукт: Омар (Lobster) ×1 |
| mdb_53539 | Пикадильо из стручковой фасоли с говядиной (Picadillo de Vainicas (Green Beans Picadillo)) | lunch | редкий продукт: Говяжья пашина (фланк) (Flank / skirt steak) ×2 |
| mdb_53549 | Куриный салат с грибами и беконом (Chicken Salad With Mushrooms and Bacon) | lunch | редкий продукт: Крем-фреш (Crème fraîche) ×2 |

## Гриль: можно адаптировать на сковороде

Исключены, не адаптированы. Чтобы вернуть, добавь id в `recipe-allowlist.json`
(и поправь шаги в `recipe-overrides.json`).

- mdb_52780 — Картофельный гратен с курицей (Potato Gratin with Chicken)
- mdb_52806 — Курица тандури (Tandoori chicken)
- mdb_52845 — Мясной рулет из индейки с фасолью (Turkey Meatloaf)
- mdb_52995 — Слоппи джо со свининой барбекю (BBQ Pork Sloppy Joes)
- mdb_53006 — Мусака (Moussaka)
- mdb_53011 — Греческий салат с киноа и курицей (Chicken Quinoa Greek Salad)
- mdb_53140 — Матамбре а-ля пицца (Matambre a la Pizza)
- mdb_53142 — Пряная испанская тортилья (Spiced tortilla)
- mdb_53171 — Тортилья с солёной треской (Salt cod tortilla)
- mdb_53465 — Лягушачьи лапки в чесночном масле (Frog Legs Recipe in Garlic Butter)
- mdb_53547 — Кубинский сэндвич (Cuban Sandwich)

## Убраны необязательные продукты (рецепт остался)

- mdb_52819 — Тако с рыбой в каджунских специях: Каджунская приправа (Cajun seasoning)
- mdb_52915 — Французский омлет: Эстрагон (Tarragon)
- mdb_53343 — Туртьер (канадский мясной пирог): Чабер (Summer savory)
- mdb_53495 — Амок трей (камбоджийское рыбное карри): Банановый лист (Banana leaf (wrapper)), Листья каффир-лайма (Kaffir lime leaf)

## На грани

Остались, но обязательный продукт используется ровно на пороге `minRecipeUses` —
удаление ещё одного блюда с ним уберёт и эти.

- mdb_52818 — Макароны с сыром и курицей в стиле фахитос: Макароны (сухие) (Pasta (dry)) ×3
- mdb_52837 — Паста путтанеска с сардинами: Макароны (сухие) (Pasta (dry)) ×3, Маслины (Black olives) ×3
- mdb_52915 — Французский омлет: Грюйер (Gruyère) ×3
- mdb_52920 — Курица «Маренго»: Маслины (Black olives) ×3
- mdb_52949 — Свинина в кисло-сладком соусе: Свинина (Pork) ×3
- mdb_52993 — Курица в медово-бальзамической глазури с хрустящей брокколи и картофелем: Брокколи (Broccoli) ×3
- mdb_53040 — Эмпанадас с креветками и зелёным луком: Винный уксус (Wine vinegar) ×3
- mdb_53071 — Говядина асадо по-филиппински: Винный уксус (Wine vinegar) ×3
- mdb_53152 — Жареный хек в бульоне с белой фасолью и чоризо: Чоризо (Chorizo) ×3
- mdb_53180 — Креветки с чесноком и хересом: Херес (Sherry) ×3
- mdb_53201 — Курица с чили и базиликом в воке: Курица (Chicken (whole / pieces)) ×3, Лук-шалот (Shallot) ×3
- mdb_53212 — Куриные голени по-тайски: Сладкий соус чили (Sweet chilli sauce) ×3, Тайская красная паста карри (Thai red curry paste) ×3
- mdb_53232 — Вьетнамский салат с курицей и рисовой лапшой: Арахис (Peanuts) ×3
- mdb_53280 — Запечённая курица по-алжирски: Курица (Chicken (whole / pieces)) ×3
- mdb_53343 — Туртьер (канадский мясной пирог): Свиной фарш (Minced pork) ×3
- mdb_53412 — Лакра ме миш — капуста, тушённая с говядиной: Белокочанная капуста (White cabbage) ×3
- mdb_53488 — Тушёная капуста с говяжьим фаршем: Белокочанная капуста (White cabbage) ×3
- mdb_53495 — Амок трей (камбоджийское рыбное карри): Кокосовое молоко (Coconut milk) ×3, Тайская красная паста карри (Thai red curry paste) ×3

## Оставшиеся рецепты по приёмам пищи

### Завтрак (13)

- Z1 — Творог с ягодами и овсянкой · свой
- Z2 — Овсянка со скиром и яйцами · свой
- Z3 — Яйца с творогом и хлебом · свой
- Z4 — Йогурт с творогом и мюсли · свой
- own_b_syrniki — Сырники с ягодами · свой
- own_b_ham_omelette — Омлет с ветчиной, сыром и тостом · свой
- own_b_skyr_oats — Овсянка на молоке со скиром и бананом · свой
- own_b_skyr_bowl — Скир-боул с мюсли и ягодами · свой
- own_b_egg_muffins — Яичные маффины со шпинатом и фетой · свой
- own_b_salmon_toast — Тост с копчёным лососем и яйцами · свой
- own_b_casserole — Творожная запеканка · свой
- own_b_buckwheat — Гречка с яйцами и зернёным творогом · свой
- own_b_oat_pancake — Овсяноблин с творогом и ветчиной из индейки · свой

### Обед (27)

- O1 — Курица с рисом и овощами (как плов) · свой
- O2 — Чечевица с курицей и томатами · свой
- O3 — Пенне с фаршем индейки · свой
- O4 — Курица по-венгерски с картошкой · свой
- mdb_52818 — Макароны с сыром и курицей в стиле фахитос
- mdb_52837 — Паста путтанеска с сардинами
- mdb_52920 — Курица «Маренго»
- mdb_52949 — Свинина в кисло-сладком соусе
- mdb_52996 — Курица с карамелизованным луком, запечённой морковью и пюре
- mdb_53023 — Сельдь в масле по-польски
- mdb_53069 — Бистек по-филиппински
- mdb_53070 — Кальдерета из говядины
- mdb_53071 — Говядина асадо по-филиппински
- mdb_53125 — Карбонадер (норвежские говяжьи котлеты) с карамелизованным луком
- mdb_53135 — Миланеса по-аргентински
- mdb_53152 — Жареный хек в бульоне с белой фасолью и чоризо
- mdb_53164 — Курица по-испански
- mdb_53180 — Креветки с чесноком и хересом
- mdb_53201 — Курица с чили и базиликом в воке
- mdb_53206 — Тайские куриные котлетки со сладким соусом чили
- mdb_53232 — Вьетнамский салат с курицей и рисовой лапшой
- mdb_53268 — Запечённая курица с ореховым соусом
- mdb_53345 — Курица карри по-ямайски
- mdb_53453 — Бенгальское куриное карри с картофелем
- mdb_53488 — Тушёная капуста с говяжьим фаршем
- mdb_53490 — Перцы, фаршированные зернёным творогом и фетой
- mdb_53533 — Говядина в панировке (ломо де рес апанадо)

### Ужин (18)

- U1 — Омлет с овощами и сыром · свой
- U2 — Пенне с тунцом · свой
- U3 — Салат с тунцом и яйцами · свой
- U4 — Шакшука · свой
- mdb_52819 — Тако с рыбой в каджунских специях
- mdb_52851 — Курица карри с арахисовой пастой
- mdb_52993 — Курица в медово-бальзамической глазури с хрустящей брокколи и картофелем
- mdb_52997 — Боул бан-ми с говядиной, майонезом шрирача, морковью и маринованным огурцом
- mdb_53040 — Эмпанадас с креветками и зелёным луком
- mdb_53209 — Острая тайская лапша с креветками
- mdb_53212 — Куриные голени по-тайски
- mdb_53280 — Запечённая курица по-алжирски
- mdb_53281 — Алжирская кефта (тефтели в томатном соусе)
- mdb_53343 — Туртьер (канадский мясной пирог)
- mdb_53412 — Лакра ме миш — капуста, тушённая с говядиной
- mdb_53495 — Амок трей (камбоджийское рыбное карри)
- mdb_53528 — Свиные отбивные по-креольски
- mdb_53565 — Куриные лоллипопы

### Перекус (17)

- P1 — Скир + яблоко · свой
- P2 — Творог с ягодами · свой
- P3 — Яйца и овощи · свой
- P4 — Йогурт + банан · свой
- own_s_cottage_cucumber — Зернёный творог с огурцом и зеленью · свой
- own_s_tuna_rye — Тунец на ржаном хлебе · свой
- own_s_greek_yogurt — Греческий йогурт с орехами и ягодами · свой
- own_s_turkey_rolls — Рулетики из ветчины индейки с сыром · свой
- own_s_berry_smoothie — Ягодный смузи со скиром · свой
- own_s_tvorog_apple — Творог с яблоком и корицей · свой
- own_s_white_omelette — Белковый омлет со шпинатом · свой
- own_s_salmon_cucumber — Копчёный лосось с огурцом на ржаном хлебе · свой
- mdb_52915 — Французский омлет
- mdb_52955 — Китайский суп с яйцом
- mdb_52977 — Чорба — турецкий чечевичный суп
- mdb_53061 — Жареные сардины
- mdb_53248 — Лосось с рисовой лапшой в пергаменте

## Удалённые продукты

- chicken_liver — Куриная печень (Chicken liver)
- turkey — Индейка (Turkey meat)
- duck_leg — Утиная ножка (Duck leg)
- goat — Козлятина (Goat meat)
- frog_legs — Лягушачьи лапки (Frog legs)
- beef_flank — Говяжья пашина (фланк) (Flank / skirt steak)
- beef_brisket — Говяжья грудинка (Beef brisket)
- corned_beef — Солонина (консерв.) (Corned beef (canned))
- oxtail — Бычий хвост (Oxtail)
- lamb — Баранина (Lamb)
- lamb_shoulder — Баранья лопатка (Lamb shoulder)
- lamb_chop — Бараньи котлеты на кости (Lamb chop)
- lamb_mince — Бараний фарш (Minced lamb)
- lamb_kidney — Бараньи почки (Lamb kidney)
- pork_shoulder — Свиная лопатка (Pork shoulder)
- pork_tenderloin — Свиная вырезка (Pork tenderloin)
- pork_belly — Свиная грудинка (Pork belly)
- pork_ribs — Свиные рёбра (Pork ribs)
- pork_hock — Свиная рулька / ножки (Pork knuckle / trotters)
- bacon — Бекон (Bacon)
- cured_ham — Сыровяленая ветчина (Dry-cured ham)
- sausage — Свиные колбаски (Pork sausages)
- kabanos — Кабанос (копчёные колбаски) (Kabanos / smoked sausage)
- black_pudding — Кровяная колбаса (Black pudding)
- cod — Треска (Cod)
- haddock — Пикша (Haddock)
- smoked_haddock — Копчёная пикша (Smoked haddock)
- salt_cod — Солёная треска (Salt cod)
- sea_bass — Сибас (Sea bass)
- mackerel — Скумбрия (Mackerel)
- trout — Форель (Trout)
- dried_shrimp — Сушёные креветки (Dried shrimp)
- seafood_mix — Морской коктейль (замороженный) (Seafood mix (frozen))
- squid — Кальмар (Squid)
- mussel — Мидии (Mussels)
- clam — Моллюски (клэмы) (Clams)
- oyster — Устрицы (Oysters)
- conch — Конх (морская улитка) (Conch)
- lobster — Омар (Lobster)
- crab — Крабовое мясо (Crab meat)
- egg_yolk — Яичный желток (Egg yolk)
- buttermilk — Пахта (Buttermilk)
- evaporated_milk — Сгущённое молоко без сахара (Evaporated milk)
- condensed_milk — Сгущёнка (Sweetened condensed milk)
- clotted_cream — Топлёные сливки (clotted cream) (Clotted cream)
- creme_fraiche — Крем-фреш (Crème fraîche)
- vegan_butter — Растительное масло-спред (Plant-based butter)
- yogurt — Натуральный йогурт (Natural yogurt)
- pecorino — Пекорино (Pecorino)
- swiss_cheese — Эмменталь (Swiss cheese (Emmental))
- manchego — Манчего (Manchego)
- goat_cheese — Козий сыр (Goat cheese)
- brie — Бри (Brie)
- blue_cheese — Сыр с плесенью (голубой) (Blue cheese)
- ricotta — Рикотта (Ricotta)
- mascarpone — Маскарпоне (Mascarpone)
- paneer — Панир (Paneer)
- queso_fresco — Кесо фреско (свежий сыр) (Queso fresco)
- cheese_sauce — Сырный соус (Cheese sauce)
- brown_rice — Бурый рис (сухой) (Brown rice (dry))
- egg_noodles — Яичная лапша (сухая) (Egg noodles (dry))
- udon_noodles — Лапша удон (Udon / wheat noodles (dry))
- couscous — Кускус (сухой) (Couscous (dry))
- quinoa — Киноа (сухая) (Quinoa (dry))
- bulgur — Булгур (сухой) (Bulgur (dry))
- tapioca — Тапиока (Tapioca pearls)
- wheat_grain — Пшеница (зерно) (Wheat berries)
- rye_grain — Рожь (зерно) (Rye grain)
- cornmeal — Кукурузная крупа (Cornmeal / polenta)
- masa_harina — Кукурузная мука (маса) (Pre-cooked corn flour (masa))
- self_raising_flour — Мука с разрыхлителем (Self-raising flour)
- bread_flour — Хлебопекарная мука (Strong bread flour)
- wholemeal_flour — Цельнозерновая мука (Wholemeal flour)
- rye_flour — Ржаная мука (Rye flour)
- buckwheat_flour — Гречневая мука (Buckwheat flour)
- rice_flour — Рисовая мука (Rice flour)
- glutinous_rice_flour — Клейкая рисовая мука (Glutinous rice flour)
- chickpea_flour — Нутовая мука (Chickpea flour)
- cassava_flour — Мука из маниоки (Cassava flour)
- chickpeas — Нут (консерв.) (Chickpeas (canned))
- kidney_beans — Красная фасоль (консерв.) (Kidney beans (canned))
- black_beans — Чёрная фасоль (консерв.) (Black beans (canned))
- cannellini_beans — Белая фасоль (консерв.) (Cannellini / white beans (canned))
- butter_beans — Фасоль лима (консерв.) (Butter beans (canned))
- pinto_beans — Фасоль пинто (консерв.) (Pinto beans (canned))
- soybeans — Соевые бобы (сухие) (Soybeans (dry))
- broad_beans — Бобы (Broad beans)
- split_peas — Колотый горох (сухой) (Split peas (dry))
- refried_beans — Фасолевое пюре (рефрито) (Refried beans)
- baked_beans — Фасоль в томатном соусе (Baked beans)
- mung_bean_paste — Паста из маша (Mung bean paste)
- tofu — Тофу (Tofu)
- silken_tofu — Шёлковый тофу (Silken tofu)
- tempeh — Темпе (Tempeh)
- hummus — Хумус (Hummus)
- falafel — Фалафель (Falafel)
- leek — Лук-порей (Leek)
- celery — Стебель сельдерея (Celery)
- celeriac — Корень сельдерея (Celeriac)
- fennel — Фенхель (Fennel)
- jalapeno — Халапеньо (Jalapeño)
- aubergine — Баклажан (Aubergine)
- courgette — Кабачок (цукини) (Courgette)
- butternut_squash — Тыква баттернат (Butternut squash / pumpkin)
- pumpkin — Тыква (Pumpkin)
- pumpkin_puree — Тыквенное пюре (консерв.) (Pumpkin purée (canned))
- red_cabbage — Краснокочанная капуста (Red cabbage)
- chinese_cabbage — Пекинская капуста (Chinese cabbage)
- pak_choi — Пак-чой (Pak choi)
- kale — Кале (кудрявая капуста) (Kale)
- leafy_greens — Листовая зелень (амарант) (Leafy greens (callaloo / jute))
- rocket — Руккола (Rocket)
- shiitake — Шиитаке (Shiitake mushrooms)
- oyster_mushroom — Вёшенки (Oyster mushrooms)
- green_beans — Стручковая фасоль (Green beans)
- snap_peas — Сахарный горошек (стручки) (Sugar snap / snow peas)
- sweetcorn — Кукуруза (консерв.) (Sweetcorn (canned))
- corn_on_the_cob — Кукуруза в початках (Corn on the cob)
- creamed_corn — Кукуруза кремовая (консерв.) (Creamed corn)
- asparagus — Спаржа (Asparagus)
- beetroot — Свёкла (Beetroot)
- daikon — Дайкон (Daikon)
- turnip — Репа (Turnip)
- swede — Брюква (Swede)
- parsnip — Пастернак (Parsnip)
- jerusalem_artichoke — Топинамбур (Jerusalem artichoke)
- sweet_potato — Батат (Sweet potato)
- cassava — Маниок (Cassava)
- taro — Таро (Taro)
- breadfruit — Хлебное дерево (плод) (Breadfruit)
- plantain — Плантан (овощной банан) (Plantain)
- bean_sprouts — Ростки маша (Bean sprouts)
- bamboo_shoots — Побеги бамбука (Bamboo shoots)
- water_chestnut — Водяной орех (консерв.) (Water chestnuts)
- palm_heart — Пальмовая сердцевина (Hearts of palm)
- grape_leaves — Виноградные листья (маринованные) (Vine leaves (pickled))
- dill_pickle — Маринованный огурец (Pickled cucumber)
- sauerkraut — Квашеная капуста (Sauerkraut)
- capers — Каперсы (Capers)
- green_olives — Зелёные оливки (Green olives)
- fries — Картофель фри (замороженный) (French fries (frozen))
- banana_leaf — Банановый лист (Banana leaf (wrapper))
- grapefruit — Грейпфрут (Grapefruit)
- mango — Манго (Mango)
- pineapple — Ананас (Pineapple)
- papaya — Папайя (Papaya)
- pomegranate — Гранат (Pomegranate)
- strawberry — Клубника (Strawberries)
- raspberry — Малина (Raspberries)
- blackberry — Ежевика (Blackberries)
- cherry — Черешня (Cherries)
- cranberry — Клюква (Cranberries)
- apricot — Абрикос (Apricot)
- dried_apricot — Курага (Dried apricots)
- prune — Чернослив (Prunes)
- longan — Лонган (Longan)
- coconut — Кокос (мякоть) (Coconut (fresh))
- desiccated_coconut — Кокосовая стружка (Desiccated coconut)
- lime_juice — Сок лайма (Lime juice)
- orange_juice — Апельсиновый сок (Orange juice)
- pineapple_juice — Ананасовый сок (Pineapple juice)
- lemon_zest — Цедра лимона (Lemon zest)
- orange_zest — Цедра апельсина (Orange zest)
- baguette — Багет (Baguette / crusty loaf)
- naan — Наан (Naan bread)
- corn_tortilla — Кукурузная тортилья (Corn tortilla)
- taco_shell — Тако (хрустящая лепёшка) (Taco shell)
- burger_bun — Булочка (Bread roll / bun)
- english_muffin — Английский маффин (English muffin)
- pretzel — Брецель (Soft pretzel)
- casabe — Касабе (лепёшка из маниоки) (Cassava flatbread (casabe))
- puff_pastry — Слоёное тесто (Puff pastry)
- filo_pastry — Тесто фило (Filo pastry)
- wonton_wrapper — Тесто для вонтонов (Wonton / spring roll wrappers)
- rice_paper — Рисовая бумага (Rice paper sheets)
- egg_roll — Яичные роллы (заморож.) (Egg rolls (frozen))
- fish_stock — Рыбный бульон (Fish stock)
- oyster_sauce — Устричный соус (Oyster sauce)
- hoisin_sauce — Соус хойсин (Hoisin sauce)
- plum_sauce — Сливовый соус (Plum / duck sauce)
- worcestershire_sauce — Вустерширский соус (Worcestershire sauce)
- hot_sauce — Острый соус (Hot sauce)
- sriracha — Шрирача (Sriracha)
- chilli_sauce — Соус чили (Chilli sauce)
- bbq_sauce — Соус барбекю (Barbecue sauce)
- ketchup — Кетчуп (Ketchup)
- mayonnaise — Майонез (Mayonnaise)
- horseradish — Хрен (Horseradish (prepared))
- enchilada_sauce — Соус для энчилады (Enchilada sauce)
- vinaigrette — Заправка винегрет (Vinaigrette)
- beef_gravy — Мясная подливка (Beef gravy)
- rice_vinegar — Рисовый уксус (Rice vinegar)
- tahini — Тахини (Tahini)
- thai_green_curry_paste — Тайская зелёная паста карри (Thai green curry paste)
- curry_paste — Индийская паста карри (Indian curry paste)
- chilli_bean_paste — Острая бобовая паста (доубанцзян) (Chilli bean paste)
- red_pepper_paste — Перечная паста (Red pepper paste)
- tamarind_paste — Паста тамаринда (Tamarind paste)
- pomegranate_molasses — Гранатовый соус (наршараб) (Pomegranate molasses)
- pickle_brine — Огуречный рассол (Pickle brine)
- peanut_oil — Арахисовое масло (Peanut oil)
- coconut_oil — Кокосовое масло (Coconut oil)
- lard — Смалец (Lard)
- goose_fat — Гусиный жир (Goose fat)
- tallow — Говяжий / бараний жир (Beef / lamb fat (tallow))
- shortening — Кулинарный жир (Vegetable shortening)
- sage — Шалфей (Sage)
- tarragon — Эстрагон (Tarragon)
- wild_garlic — Черемша (Wild garlic)
- summer_savory — Чабер (Summer savory)
- lime_leaf — Листья каффир-лайма (Kaffir lime leaf)
- lemongrass — Лемонграсс (Lemongrass)
- pandan_leaf — Лист пандана (Pandan leaf)
- cardamom — Кардамон (Cardamom)
- five_spice — Смесь «пять специй» (Chinese five spice)
- star_anise — Бадьян (Star anise)
- fennel_seed — Семена фенхеля (Fennel seeds)
- mustard_powder — Горчичный порошок (Mustard powder)
- saffron — Шафран (Saffron)
- sumac — Сумах (Sumac)
- sichuan_pepper — Сычуаньский перец (Sichuan pepper)
- ras_el_hanout — Рас-эль-ханут (Ras el hanout)
- harissa_spice — Харисса (сухая смесь) (Harissa spice mix)
- cajun_seasoning — Каджунская приправа (Cajun seasoning)
- jerk_seasoning — Приправа джерк (Jerk seasoning)
- annatto — Аннато (ачиоте) (Annatto (achiote))
- mahleb — Махлеб (Mahleb)
- dried_sorrel — Каркаде (сушёный гибискус) (Dried sorrel (hibiscus))
- vanilla_extract — Ванильный экстракт (Vanilla extract)
- vanilla_pod — Стручок ванили (Vanilla pod)
- almond_extract — Миндальный экстракт (Almond extract)
- rose_water — Розовая вода (Rose water)
- pine_nut — Кедровые орехи (Pine nuts)
- cashew — Кешью (Cashews)
- pistachio — Фисташки (Pistachios)
- hazelnut — Фундук (Hazelnuts)
- chestnut — Каштаны (Chestnuts)
- sesame_seed — Кунжут (Sesame seeds)
- sunflower_seed — Семечки подсолнечника (Sunflower seeds)
- poppy_seed — Мак (Poppy seeds)
- white_wine — Белое вино (White wine)
- red_wine — Красное вино (Red wine)
- sake — Саке / рисовое вино (Sake / rice wine)
- mirin — Мирин (Mirin)
- brandy — Бренди (Brandy)
- beer — Пиво (Beer)
- cider — Сидр (Cider (alcoholic))
- coconut_cream — Кокосовые сливки (Coconut cream)
- soya_milk — Соевое молоко (Soy milk)
- almond_milk — Миндальное молоко (Almond milk)
- icing_sugar — Сахарная пудра (Icing sugar)
- sugar_syrup — Сахарный сироп (Sugar syrup)
- maple_syrup — Кленовый сироп (Maple syrup)
- molasses — Меласса (патока) (Molasses / black treacle)
- jam — Джем (Jam)
- mincemeat — Фруктовая начинка минсмит (Mincemeat (sweet fruit filling))
- cocoa — Какао-порошок (Cocoa powder)
- baking_powder — Разрыхлитель (Baking powder)
- baking_soda — Пищевая сода (Baking soda)
- yeast — Дрожжи (Yeast)
- flax_egg — Льняное «яйцо» (Flax egg (vegan egg substitute))
