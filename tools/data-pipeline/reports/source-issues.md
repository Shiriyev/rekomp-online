# TheMealDB source issues found while translating

Found by reading every accepted recipe during translation (task 4). Nutrition only counts
the listed ingredients, so «used but not listed» means the real dish has a bit more kcal.

## Wrong or mismatched recipe
- **mdb_53068 Beef Mechado** — instructions are for grilled beef skewers, not mechado (a stew); vinegar, ginger, sesame oil and sugar are used but not listed. Candidate to drop.
- **mdb_53203 Thai rice noodle salad** — category Vegetarian, but both variants use meat (tags are computed from products, so it is not tagged vegetarian).

## Ingredient mapping to check (`mappings/ingredient-map.json`)
- «Coriander», 1 tsp / ½ tsp (mdb_53010, mdb_53028, mdb_53103) → mapped to fresh coriander leaf, actually ground coriander.
- «Pepper» ½ cup (mdb_53539 Picadillo) → mapped to black pepper (staple), actually bell pepper.
- Fresh sardines (mdb_53041, mdb_53061) → mapped to canned sardines.
- Fermented soybeans (mdb_53418) → dry soybeans; morning glory → amaranth.
- Rice flour (mdb_53043) → wheat flour; ginger-garlic paste (mdb_53453) → ginger.
- Crab meat vs whole boiled crabs (mdb_53509); «tomato sauce» → tomato purée (mdb_53070).

## Used in the steps but not in the ingredient list
mdb_52954 egg · mdb_52995 butter · mdb_52852, mdb_53011 tomatoes · mdb_53010 tomatoes, onion ·
mdb_53061 lemon · mdb_53186 onions · mdb_53281 ras el hanout · mdb_53354 vinegar ·
mdb_53565 lemon, oil, sauce · mdb_53043 onion, lemon juice, mango chutney · mdb_53135 frying oil ·
mdb_53203 mint · mdb_53539 olive oil · mdb_52773 honey · mdb_52818 roasted peppers ·
mdb_52946 vinegar · mdb_52977 olive oil · mdb_53071 potatoes, carrots · mdb_53350 pepper sauce ·
mdb_53510 green peppers · mdb_53070 liver spread · mdb_53050 cloves, cardamom ·
mdb_53028 yogurt-sauce ingredients · mdb_53547 cumin, onion powder · mdb_52997 sugar, butter, mayonnaise, sriracha, oil.

## Servings in the text differ from the computed servings (kept computed)
mdb_52993 (text 2), mdb_53490 (4 peppers, 1 serving), mdb_53343 (8–10), mdb_53497 (4 bowls), mdb_53510 (6 lobsters / 2), mdb_53032 (4 chops / 3).

## Judgement calls (review `prepNightBefore`)
- true: mdb_53533 (3 h or overnight), mdb_53152 (dried beans, soaking implied), mdb_53181 (soak 4 h or overnight), mdb_53023 (2–3 days in the fridge).
- false although overnight is optional: mdb_52806, mdb_53069, mdb_53261, mdb_53264, mdb_53354; mdb_53171 salt cod (soaking not stated).
