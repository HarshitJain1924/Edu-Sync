-- Ensure profile creation on signup does not fail due to username uniqueness
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  base_username text;
  final_username text;
  suffix int := 0;
BEGIN
  base_username := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
  final_username := base_username;

  -- ensure unique username by appending a random 4-digit suffix if needed
  WHILE EXISTS(SELECT 1 FROM public.profiles WHERE username = final_username) LOOP
    suffix := floor(random()*9000 + 1000);
    final_username := base_username || '_' || suffix::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
