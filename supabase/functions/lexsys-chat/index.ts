iimport { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function embedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.data[0].embedding as number[];
}

async function chatAnswer(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 500,
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

function buildPlazosText(plazos: any[]): string {
  if (!plazos?.length) return "Sin resultados.";
  return plazos
    .slice(0, 5)
    .map((p) => {
      const dur =
        p.duracion_numero != null
          ? `${p.duracion_numero} ${p.unidad ?? "días"} (${p.tipo_duracion ?? "hábiles"})`
          : p.duracion_plazo ?? "s/duración";
      return ` ${p.accion_procedimiento}  ${dur} Fuero: ${p.fuero || "s/fuero"} | Proceso: ${p.tipo_proceso || "s/proceso"} Art.: ${p.articulo || "N/A"} | Instancia: ${p.instancia || "N/A"} ${p.descripcion ? "Desc: " + p.descripcion : ""}`;
    })
    .join("\n\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pregunta, despacho_id, user_id } = await req.json();

    const vec = await embedding(pregunta);
    let leyes: any[] = [];

    const tryRpc = async (fn: string) =>
      supabase.rpc(fn, { query_embedding: vec, match_count: 5 });

    let r = await tryRpc("match_leyes_vectores");
    if (r.error) r = await tryRpc("match_leyes_local");
    if (r.error) throw r.error;
    leyes = r.data || [];

    const leyesTxt =
      (leyes ?? [])
        .map(
          (x: any) =>
            `${x.fuente ?? "Fuente"}  ${x.articulo ?? "Art."}: ${(x.contenido ?? "").slice(0, 500)}...`
        )
        .join("\n\n") || "Sin resultados.";

    const q = (pregunta || "").trim();
    const orFilter = [
      `accion_procedimiento.ilike.%${q}%`,
      `descripcion.ilike.%${q}%`,
      `articulo.ilike.%${q}%`,
      `fuero.ilike.%${q}%`,
      `tipo_proceso.ilike.%${q}%`,
      `instancia.ilike.%${q}%`,
      `notas.ilike.%${q}%`,
    ].join(",");

    const { data: plazos, error: plazosErr } = await supabase
      .from("plazos_procesales")
      .select(
        "id, fuero, tipo_proceso, accion_procedimiento, articulo, descripcion, instancia, notas, duracion_numero, unidad, tipo_duracion"
      )
      .or(orFilter)
      .limit(10);
    if (plazosErr) throw plazosErr;

    const plazosTxt = buildPlazosText(plazos || []);

    const system =
      "Eres Dr. Roa, abogado paraguayo experto en Derecho Civil, Penal, Procesal y Laboral. Responde citando artículos y plazos procesales si corresponden. No inventes información.";
    const user = `Pregunta: ${pregunta}
Leyes relevantes (leyes_vectores):
${leyesTxt}

Plazos procesales relacionados:
${plazosTxt}

Redacta una respuesta clara, citando fuentes (leyes: fuente/artículo; plazos: acción/duración/artículo). Si hay discrepancias, acláralas.`;

    const respuesta = await chatAnswer(system, user);

    try {
      await supabase.from("chat_historial").insert({
        user_id,
        despacho_id,
        pregunta,
        respuesta,
      });
    } catch (_) {}

    return new Response(JSON.stringify({ respuesta, refs: { leyes, plazos } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});


serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pregunta, despacho_id, user_id } = await req.json();

    const vec = await embedding(pregunta);

    let { data: leyes, error: leyesError } = await supabase.rpc("match_leyes_vectores", {
      query_embedding: vec,
      match_count: 5,
    });

    if (leyesError) {
      ({ data: leyes } = await supabase.rpc("match_leyes_local", {
        query_embedding: vec,
        match_count: 5,
      }));
    }

    const leyesTxt = (leyes || [])
      .map((x: any) => `${x.fuente ?? "Fuente"}  ${x.articulo ?? "Art."}: ${(x.contenido ?? "").slice(0, 500)}...`)
      .join("\n\n") || "Sin resultados.";

    const { data: plazos } = await supabase
      .from("plazos_procesales")
      .select("*")
      .or(
        [
          `accion_procedimiento.ilike.%${pregunta}%`,
          `descripcion.ilike.%${pregunta}%`,
          `articulo.ilike.%${pregunta}%`,
          `fuero.ilike.%${pregunta}%`,
        ].join(",")
      )
      .limit(5);

    const plazosTxt = (plazos || [])
      .map(
        (p: any) =>
          ` ${p.accion_procedimiento}  ${p.duracion_numero || p.duracion_plazo || "s/duración"} ${
            p.unidad || ""
          } (${p.fuero || ""})`
      )
      .join("\n\n") || "Sin resultados.";

    const system =
      "Eres el Dr.
