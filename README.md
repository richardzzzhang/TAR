# TAR

Run the local invitation prototype with `node server.mjs` and open
http://localhost:4173. Local messages are stored in `.data/messages.json`.

GitHub Pages is static, so the public guestbook uses Supabase:

1. Create a Supabase project and run `supabase.sql` in its SQL Editor.
2. Copy the project URL and public anon/publishable key from the project API settings.
3. Set `supabaseUrl` and `supabasePublicKey` near the top of the script in `index.html`.
4. Commit and push `index.html` to publish the configured guestbook.

The public key is intended for browser use; never use a service-role key here.
Anyone can read and post messages on this public guestbook.