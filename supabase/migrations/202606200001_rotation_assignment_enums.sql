-- Enum support for rotating chore assignments.

create type public.chore_rotation_cadence as enum ('daily', 'weekly', 'monthly');
create type public.chore_rotation_child_scope as enum ('all_children', 'selected_children');

alter type public.chore_assignment_mode add value if not exists 'rotation';
