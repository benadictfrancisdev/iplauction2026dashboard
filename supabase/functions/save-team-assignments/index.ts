import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Assignment {
  team_id: string;
  player_name: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { assignments }: { assignments: Assignment[] } = await req.json();
    if (!assignments?.length) throw new Error('No assignments provided');

    // Delete old OWNER rows
    const { error: delErr } = await supabase.from('retained_players').delete().eq('role', 'OWNER');
    if (delErr) throw new Error(`Delete failed: ${delErr.message}`);

    // Insert new
    const rows = assignments.map(a => ({
      team_id: a.team_id,
      player_name: a.player_name,
      role: 'OWNER',
      nationality: 'India',
      retention_price: 0,
    }));
    const { error: insErr } = await supabase.from('retained_players').insert(rows);
    if (insErr) throw new Error(`Insert failed: ${insErr.message}`);

    return new Response(JSON.stringify({ success: true, count: rows.length }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
