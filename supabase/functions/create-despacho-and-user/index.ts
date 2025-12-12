import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ResponseData {
  message?: string;
  error?: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const { nombreDespacho, nombreCompleto, email, password } = await req.json();

    if (!nombreDespacho || !nombreCompleto || !email || !password) {
      throw new Error('Faltan datos obligatorios en la solicitud.');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: despachoData, error: despachoError } = await supabaseAdmin
      .from('despachos')
      .insert({ nombre: nombreDespacho })
      .select()
      .single();

    if (despachoError) throw despachoError;

    const { error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        nombre_completo: nombreCompleto,
        despacho_id: despachoData.id,
        rol: 'admin',
      },
    });

    if (authError) {
      await supabaseAdmin.from('despachos').delete().eq('id', despachoData.id);
      throw authError;
    }

    // Crear licencia de prueba para el nuevo despacho (60 días)
    const { error: licenciaError } = await supabaseAdmin
      .from('licencias')
      .insert({
        despacho_id: despachoData.id,
        estado: 'PRUEBA',
        plan: 'TRIAL',
        dias_prueba: 60,
        notas: 'Licencia de prueba creada automáticamente al registrarse.'
      });

    if (licenciaError) {
      console.error('Error al crear licencia:', licenciaError);
      // No hacemos rollback porque el despacho y usuario ya están creados
      // La licencia se puede crear manualmente después
    }

    const response: ResponseData = { message: '¡Despacho y usuario administrador creados con éxito!' };
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 200,
    });
  } catch (error) {
    const response: ResponseData = { error: error.message };
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      status: 400,
    });
  }
});
