-- Expanded starter catalog for household chore setup. This migration is
-- idempotent so existing deployments receive the richer preset list.

insert into public.chore_template_presets (
  slug,
  category,
  display_order,
  title,
  description,
  suggested_schedule_type,
  suggested_weekly_weekdays,
  suggested_interval_days,
  suggested_due_time_start,
  suggested_due_time_end,
  suggested_assignment_mode,
  suggested_value_model,
  suggested_amount_cents,
  suggested_photo_required,
  suggested_approval_required,
  active
)
values
  ('unload-dishwasher', 'kitchen', 10, 'Unload dishwasher', 'Put clean dishes, cups, and silverware away.', 'daily', null, null, '07:00', '20:00', 'selected_children', 'fixed', 150, true, true, true),
  ('load-dishwasher', 'kitchen', 20, 'Load dishwasher', 'Clear dishes from the sink or counter and start the dishwasher if full.', 'daily', null, null, '17:00', '21:00', 'selected_children', 'fixed', 150, true, true, true),
  ('wipe-counters', 'kitchen', 30, 'Wipe counters', 'Clear crumbs and wipe kitchen counters after meals.', 'daily', null, null, '17:00', '20:00', 'selected_children', 'fixed', 100, true, true, true),
  ('clear-table', 'kitchen', 40, 'Clear table', 'Bring dishes to the kitchen and wipe the table after a meal.', 'daily', null, null, '17:00', '20:30', 'selected_children', 'allowance_included', 0, false, false, true),
  ('sweep-kitchen-floor', 'kitchen', 50, 'Sweep kitchen floor', 'Sweep crumbs and visible dirt from the kitchen floor.', 'weekly', array[2, 5], null, '16:00', '20:00', 'selected_children', 'fixed', 200, true, true, true),
  ('take-out-trash', 'kitchen', 60, 'Take out trash', 'Tie the bag, take it outside, and replace the liner.', 'weekly', array[0, 3], null, '16:00', '20:00', 'selected_children', 'fixed', 200, true, true, true),
  ('pack-lunch', 'kitchen', 70, 'Pack lunch', 'Pack lunch items, water bottle, and snack for the next school day.', 'weekly', array[1, 2, 3, 4], null, '18:00', '21:00', 'selected_children', 'allowance_included', 0, false, true, true),

  ('make-bed', 'bedroom', 10, 'Make bed', 'Pull up sheets and blankets and arrange pillows.', 'daily', null, null, '06:00', '10:00', 'selected_children', 'allowance_included', 0, false, false, true),
  ('tidy-bedroom', 'bedroom', 20, 'Tidy bedroom', 'Put clothes, toys, books, and floor items where they belong.', 'weekly', array[6], null, '09:00', '17:00', 'selected_children', 'fixed', 300, true, true, true),
  ('put-away-clean-clothes', 'bedroom', 30, 'Put away clean clothes', 'Put folded clothes into drawers or closets.', 'interval', null, 3, '16:00', '20:30', 'selected_children', 'fixed', 200, true, true, true),
  ('collect-bedroom-laundry', 'bedroom', 40, 'Collect bedroom laundry', 'Put dirty clothes and towels into the laundry basket.', 'weekly', array[5], null, '16:00', '20:00', 'selected_children', 'allowance_included', 0, false, false, true),
  ('reset-school-bag', 'bedroom', 50, 'Reset school bag', 'Empty old papers, pack needed items, and place the bag by the door.', 'weekly', array[0, 1, 2, 3, 4], null, '18:00', '21:00', 'selected_children', 'allowance_included', 0, false, true, true),

  ('clean-bathroom-sink', 'bathroom', 10, 'Clean bathroom sink', 'Wipe the sink, faucet, counter, and mirror area.', 'weekly', array[6], null, '09:00', '17:00', 'selected_children', 'fixed', 250, true, true, true),
  ('empty-bathroom-trash', 'bathroom', 20, 'Empty bathroom trash', 'Empty the bathroom trash can and replace the liner.', 'weekly', array[6], null, '09:00', '17:00', 'selected_children', 'fixed', 150, true, true, true),
  ('restock-toilet-paper', 'bathroom', 30, 'Restock toilet paper', 'Check bathrooms and refill toilet paper where needed.', 'weekly', array[0], null, '09:00', '18:00', 'selected_children', 'allowance_included', 0, false, false, true),
  ('replace-hand-towel', 'bathroom', 40, 'Replace hand towel', 'Swap used bathroom hand towels for clean ones.', 'weekly', array[3, 6], null, '09:00', '18:00', 'selected_children', 'allowance_included', 0, false, false, true),
  ('quick-toilet-clean', 'bathroom', 50, 'Quick toilet clean', 'Use cleaner and brush for a quick toilet clean.', 'weekly', array[6], null, '09:00', '17:00', 'selected_children', 'fixed', 300, true, true, true),

  ('sort-laundry', 'laundry', 10, 'Sort laundry', 'Sort clothes into lights, darks, towels, or household loads.', 'weekly', array[5], null, '09:00', '18:00', 'selected_children', 'allowance_included', 0, false, true, true),
  ('move-wash-to-dryer', 'laundry', 20, 'Move wash to dryer', 'Move washed laundry to the dryer or drying rack.', 'interval', null, 3, '16:00', '20:00', 'selected_children', 'allowance_included', 0, false, true, true),
  ('fold-laundry', 'laundry', 30, 'Fold laundry', 'Fold clean laundry and place it in the right rooms.', 'interval', null, 3, '16:00', '20:00', 'selected_children', 'fixed', 300, true, true, true),
  ('put-away-laundry', 'laundry', 40, 'Put away laundry', 'Put clean laundry away in drawers, closets, or towel shelves.', 'interval', null, 3, '16:00', '20:30', 'selected_children', 'fixed', 250, true, true, true),
  ('match-socks', 'laundry', 50, 'Match socks', 'Match clean socks and place them with the right laundry pile.', 'weekly', array[6], null, '09:00', '18:00', 'up_for_grabs', 'fixed', 100, true, true, true),

  ('feed-pet', 'pets', 10, 'Feed pet', 'Give the pet the right food and refill water.', 'daily', null, null, '06:00', '20:00', 'selected_children', 'allowance_included', 0, false, false, true),
  ('refill-pet-water', 'pets', 20, 'Refill pet water', 'Wash or refill the pet water bowl.', 'daily', null, null, '06:00', '20:00', 'selected_children', 'allowance_included', 0, false, false, true),
  ('walk-pet', 'pets', 30, 'Walk pet', 'Take the pet for a planned walk and return gear to its place.', 'daily', null, null, '06:00', '20:00', 'selected_children', 'fixed', 300, true, true, true),
  ('scoop-litter', 'pets', 40, 'Scoop litter', 'Scoop the litter box and wash hands afterward.', 'daily', null, null, '16:00', '20:00', 'selected_children', 'fixed', 200, true, true, true),
  ('clean-pet-area', 'pets', 50, 'Clean pet area', 'Tidy the pet feeding, sleeping, or play area.', 'weekly', array[6], null, '09:00', '18:00', 'selected_children', 'fixed', 250, true, true, true),

  ('bring-bins-to-curb', 'outdoor', 10, 'Bring bins to curb', 'Move trash or recycling bins to the curb on pickup night.', 'weekly', array[0], null, '16:00', '21:00', 'selected_children', 'fixed', 200, true, true, true),
  ('bring-bins-back', 'outdoor', 20, 'Bring bins back', 'Return empty trash or recycling bins to their normal place.', 'weekly', array[1], null, '12:00', '20:00', 'selected_children', 'fixed', 150, true, true, true),
  ('sweep-porch', 'outdoor', 30, 'Sweep porch', 'Sweep dirt and leaves from the porch or entryway.', 'weekly', array[6], null, '09:00', '18:00', 'selected_children', 'fixed', 250, true, true, true),
  ('water-plants', 'outdoor', 40, 'Water plants', 'Water assigned indoor or outdoor plants.', 'interval', null, 2, '07:00', '19:00', 'selected_children', 'allowance_included', 0, false, true, true),
  ('pick-up-yard-toys', 'outdoor', 50, 'Pick up yard toys', 'Return yard toys, balls, and outdoor gear to storage.', 'weekly', array[5, 6], null, '16:00', '20:00', 'selected_children', 'fixed', 150, true, true, true),

  ('set-table', 'family', 10, 'Set table', 'Put out plates, napkins, silverware, and cups before dinner.', 'daily', null, null, '16:00', '18:30', 'selected_children', 'allowance_included', 0, false, false, true),
  ('room-reset', 'family', 20, 'Ten-minute room reset', 'Spend ten focused minutes resetting a shared room.', 'daily', null, null, '17:00', '20:30', 'up_for_grabs', 'allowance_included', 0, false, true, true),
  ('help-with-groceries', 'family', 30, 'Help with groceries', 'Carry in groceries and put assigned items away.', 'weekly', array[6], null, '09:00', '20:00', 'up_for_grabs', 'fixed', 200, true, true, true),
  ('put-away-shoes-coats', 'family', 40, 'Put away shoes and coats', 'Return shoes, coats, and bags near the entry to their spots.', 'daily', null, null, '17:00', '21:00', 'selected_children', 'allowance_included', 0, false, false, true),
  ('help-prep-dinner', 'family', 50, 'Help prep dinner', 'Help with a parent-approved dinner prep task.', 'weekly', array[1, 2, 3, 4, 5], null, '16:00', '19:00', 'up_for_grabs', 'fixed', 200, false, true, true)
on conflict (slug) do update set
  category = excluded.category,
  display_order = excluded.display_order,
  title = excluded.title,
  description = excluded.description,
  suggested_schedule_type = excluded.suggested_schedule_type,
  suggested_weekly_weekdays = excluded.suggested_weekly_weekdays,
  suggested_interval_days = excluded.suggested_interval_days,
  suggested_due_time_start = excluded.suggested_due_time_start,
  suggested_due_time_end = excluded.suggested_due_time_end,
  suggested_assignment_mode = excluded.suggested_assignment_mode,
  suggested_value_model = excluded.suggested_value_model,
  suggested_amount_cents = excluded.suggested_amount_cents,
  suggested_photo_required = excluded.suggested_photo_required,
  suggested_approval_required = excluded.suggested_approval_required,
  active = excluded.active;
