import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface LicenseResponse {
  allowed: boolean;
  status: string;
  daysLeft?: number;
  message: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const { despacho_id, hardware_id } = await req.json();

    if (!despacho_id) {
      return new Response(JSON.stringify({
        allowed: false,
        status: 'ERROR',
        message: 'Falta el ID del despacho.'
      } as LicenseResponse), { headers: corsHeaders, status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Buscar licencia del despacho
    const { data: licencia, error } = await supabaseAdmin
      .from('licencias')
      .select('*')
      .eq('despacho_id', despacho_id)
      .single();

    if (error || !licencia) {
      // No existe licencia - esto no debería pasar si se creó correctamente al registrarse
      return new Response(JSON.stringify({
        allowed: false,
        status: 'NO_LICENSE',
        message: 'No se encontró una licencia válida para este despacho. Contacte soporte.'
      } as LicenseResponse), { headers: corsHeaders, status: 200 });
    }

    // Si está suspendido, bloquear inmediatamente
    if (licencia.estado === 'SUSPENDIDO') {
      return new Response(JSON.stringify({
        allowed: false,
        status: 'SUSPENDIDO',
        message: 'Su licencia ha sido suspendida. Contacte soporte para más información.'
      } as LicenseResponse), { headers: corsHeaders, status: 200 });
    }

    // Si está activo (pagó), permitir acceso
    if (licencia.estado === 'ACTIVO') {
      // Verificar si tiene fecha de expiración (planes mensuales/anuales)
      if (licencia.fecha_expiracion) {
        const expDate = new Date(licencia.fecha_expiracion);
        const now = new Date();
        if (now > expDate) {
          // Plan expirado
          return new Response(JSON.stringify({
            allowed: false,
            status: 'EXPIRADO',
            message: 'Su plan ha expirado. Renueve su suscripción para continuar.'
          } as LicenseResponse), { headers: corsHeaders, status: 200 });
        }
        
        const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return new Response(JSON.stringify({
          allowed: true,
          status: 'ACTIVO',
          daysLeft,
          message: `Licencia activa. ${daysLeft} días restantes.`
        } as LicenseResponse), { headers: corsHeaders, status: 200 });
      }
      
      // Activo sin fecha de expiración = permanente
      return new Response(JSON.stringify({
        allowed: true,
        status: 'ACTIVO',
        message: 'Licencia activa.'
      } as LicenseResponse), { headers: corsHeaders, status: 200 });
    }

    // Si está en período de prueba
    if (licencia.estado === 'PRUEBA') {
      const fechaInicio = new Date(licencia.fecha_inicio);
      const now = new Date();
      const diasTranscurridos = Math.floor((now.getTime() - fechaInicio.getTime()) / (1000 * 60 * 60 * 24));
      const diasRestantes = licencia.dias_prueba - diasTranscurridos;

      if (diasRestantes <= 0) {
        // Período de prueba expirado
        // Actualizar estado a EXPIRADO
        await supabaseAdmin
          .from('licencias')
          .update({ estado: 'EXPIRADO' })
          .eq('id', licencia.id);

        return new Response(JSON.stringify({
          allowed: false,
          status: 'EXPIRADO',
          daysLeft: 0,
          message: 'Su período de prueba de 60 días ha finalizado. Contacte soporte para activar su licencia.'
        } as LicenseResponse), { headers: corsHeaders, status: 200 });
      }

      // Aún en período de prueba
      return new Response(JSON.stringify({
        allowed: true,
        status: 'PRUEBA',
        daysLeft: diasRestantes,
        message: `Período de prueba: ${diasRestantes} días restantes.`
      } as LicenseResponse), { headers: corsHeaders, status: 200 });
    }

    // Estado EXPIRADO
    return new Response(JSON.stringify({
      allowed: false,
      status: 'EXPIRADO',
      message: 'Su licencia ha expirado. Contacte soporte para renovar.'
    } as LicenseResponse), { headers: corsHeaders, status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({
      allowed: false,
      status: 'ERROR',
      message: `Error al verificar licencia: ${err.message}`
    } as LicenseResponse), { headers: corsHeaders, status: 500 });
  }
});
