ALTER TABLE `meal_logs` ADD `portion_id` text REFERENCES prepared_portions(id) ON DELETE set null;
